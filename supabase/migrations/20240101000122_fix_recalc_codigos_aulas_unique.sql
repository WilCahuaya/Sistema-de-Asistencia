-- ============================================
-- Corrige recalcular_codigos_aulas_fcp: evitar duplicado (fcp_id, codigo_aula)
-- al actualizar en un solo paso (23505). Aplica NULL antes de reasignar.
-- Útil si 00121 falló a mitad o la función quedó sin el paso de limpieza.
-- ============================================

CREATE OR REPLACE FUNCTION public.recalcular_codigos_aulas_fcp(p_fcp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.aulas
  SET codigo_aula = NULL
  WHERE fcp_id = p_fcp_id;

  UPDATE public.aulas a
  SET codigo_aula = sub.cod
  FROM (
    SELECT id,
      'A' || LPAD(
        rn::text,
        CASE WHEN rn < 100 THEN 2 ELSE 3 END,
        '0'
      ) AS cod
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY orden, nombre, id) AS rn
      FROM public.aulas
      WHERE fcp_id = p_fcp_id
    ) t
  ) sub
  WHERE a.id = sub.id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_codigos_aulas_fcp(UUID) IS 'Asigna codigo_aula A01..AN según orden, nombre e id dentro de la FCP. Libera códigos antes de reasignar para evitar índice único.';
