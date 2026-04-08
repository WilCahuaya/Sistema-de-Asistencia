-- ============================================
-- Corrige contar_estudiantes_por_aula_fecha: períodos con fecha_fin NULL
-- (vigentes) no coincidían con ep.fecha_fin >= fecha, lo que subcontaba
-- estudiantes y desincronizaba el reporte respecto a dias_incompletos_por_aula.
-- Eso podía mostrar alertas de “días incompletos” incoherentes con la realidad.
-- ============================================

CREATE OR REPLACE FUNCTION public.contar_estudiantes_por_aula_fecha(
  p_aula_ids UUID[],
  p_fecha_inicio DATE,
  p_fecha_fin DATE
)
RETURNS TABLE(aula_id UUID, fecha DATE, total BIGINT) AS $$
  WITH fechas AS (
    SELECT generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval)::date AS fecha
  ),
  aulas AS (
    SELECT unnest(p_aula_ids) AS id
  ),
  combinaciones AS (
    SELECT a.id AS aula_id, f.fecha
    FROM aulas a
    CROSS JOIN fechas f
  )
  SELECT
    c.aula_id,
    c.fecha,
    COUNT(DISTINCT ep.estudiante_id)::BIGINT AS total
  FROM combinaciones c
  LEFT JOIN public.estudiante_periodos ep
    ON ep.aula_id = c.aula_id
    AND ep.fecha_inicio <= c.fecha
    AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= c.fecha)
  GROUP BY c.aula_id, c.fecha;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.contar_estudiantes_por_aula_fecha IS
  'Total de estudiantes con período activo en (aula, fecha). Incluye períodos abiertos (fecha_fin NULL). Alineado con dias_incompletos_por_aula.';
