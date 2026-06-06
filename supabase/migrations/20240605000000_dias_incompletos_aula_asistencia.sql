-- ============================================
-- Fix dias_incompletos_por_aula: no mezclar asistencias regular e intervención.
-- Antes contaba cualquier asistencia del estudiante en la fecha, aunque fuera
-- de otra aula (p. ej. intervención marcada como 2/25 en aula regular).
-- ============================================

CREATE OR REPLACE FUNCTION public.dias_incompletos_por_aula(
  p_aula_ids UUID[],
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_fcp_id UUID
)
RETURNS TABLE(
  aula_id UUID,
  aula_nombre TEXT,
  fecha DATE,
  marcados BIGINT,
  total BIGINT
) AS $$
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
  ),
  totales AS (
    SELECT 
      c.aula_id,
      c.fecha,
      COUNT(DISTINCT ep.estudiante_id)::BIGINT AS total
    FROM combinaciones c
    LEFT JOIN public.estudiante_periodos ep 
      ON ep.aula_id = c.aula_id
      AND ep.fecha_inicio <= c.fecha
      AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= c.fecha)
    GROUP BY c.aula_id, c.fecha
  ),
  estudiantes_por_fecha AS (
    SELECT 
      c.aula_id,
      c.fecha,
      ep.estudiante_id
    FROM combinaciones c
    JOIN public.estudiante_periodos ep 
      ON ep.aula_id = c.aula_id
      AND ep.fecha_inicio <= c.fecha
      AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= c.fecha)
  ),
  marcados AS (
    SELECT 
      epf.aula_id,
      epf.fecha,
      COUNT(DISTINCT a.estudiante_id)::BIGINT AS marcados
    FROM estudiantes_por_fecha epf
    JOIN public.asistencias a 
      ON a.estudiante_id = epf.estudiante_id
      AND a.fecha = epf.fecha
      AND a.fcp_id = p_fcp_id
      AND COALESCE(a.aula_id, epf.aula_id) = epf.aula_id
    GROUP BY epf.aula_id, epf.fecha
  )
  SELECT 
    t.aula_id,
    (SELECT nombre FROM public.aulas WHERE id = t.aula_id LIMIT 1)::TEXT AS aula_nombre,
    t.fecha,
    COALESCE(m.marcados, 0)::BIGINT AS marcados,
    t.total
  FROM totales t
  LEFT JOIN marcados m ON m.aula_id = t.aula_id AND m.fecha = t.fecha
  WHERE t.total > 0
    AND COALESCE(m.marcados, 0) > 0
    AND COALESCE(m.marcados, 0) < t.total;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.dias_incompletos_por_aula IS
  'Días incompletos por aula regular: solo asistencias con el mismo aula_id (regular e intervención separados).';
