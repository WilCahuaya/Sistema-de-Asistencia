-- ============================================
-- RPC: Contar estudiantes por aula y fecha (para reportes)
-- Usa SECURITY DEFINER para evitar problemas de RLS con facilitadores
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
    AND ep.fecha_fin >= c.fecha
  GROUP BY c.aula_id, c.fecha;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.contar_estudiantes_por_aula_fecha IS 'Devuelve el total de estudiantes con período activo por (aula_id, fecha). Usado en reportes para detectar días completos. SECURITY DEFINER para que facilitadores puedan leer.';
