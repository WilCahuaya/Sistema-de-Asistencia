-- ============================================
-- RPC por lotes: estudiantes activos en varias aulas en un rango de fechas
-- Evita N llamadas a estudiantes_activos_en_rango (reportes muy lentos).
-- Misma lógica que estudiantes_activos_en_rango por aula.
-- ============================================

CREATE OR REPLACE FUNCTION public.estudiantes_activos_en_rango_batch(
  p_aula_ids UUID[],
  p_fecha_inicio DATE,
  p_fecha_fin DATE
)
RETURNS TABLE(aula_id UUID, estudiante_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ep.aula_id, ep.estudiante_id
  FROM public.estudiante_periodos ep
  JOIN public.estudiantes e ON e.id = ep.estudiante_id
  JOIN public.aulas a ON a.id = ep.aula_id
  WHERE p_aula_ids IS NOT NULL
    AND cardinality(p_aula_ids) > 0
    AND ep.aula_id = ANY(p_aula_ids)
    AND ep.fecha_inicio <= p_fecha_fin
    AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= p_fecha_inicio)
    AND e.fcp_id = a.fcp_id;
$$;

COMMENT ON FUNCTION public.estudiantes_activos_en_rango_batch(UUID[], DATE, DATE) IS
  'Devuelve (aula_id, estudiante_id) para todas las aulas dadas en el rango. Reemplaza N llamadas a estudiantes_activos_en_rango en reportes.';

GRANT EXECUTE ON FUNCTION public.estudiantes_activos_en_rango_batch(UUID[], DATE, DATE) TO authenticated;
