-- Repara filas en public.estudiantes cuyo activo / aula_id no coinciden con estudiante_periodos
-- (misma regla que public.sync_estudiante_desde_periodo tras 20240101000112).

CREATE OR REPLACE FUNCTION public.reconciliar_estudiantes_activo_desde_periodos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  WITH computed AS (
    SELECT
      e.id AS estudiante_id,
      (vp.aula_id IS NOT NULL) AS activo,
      COALESCE(vp.aula_id, lp.aula_id, e.aula_id) AS aula_id
    FROM public.estudiantes e
    LEFT JOIN LATERAL (
      SELECT ep.aula_id
      FROM public.estudiante_periodos ep
      WHERE ep.estudiante_id = e.id
        AND ep.fecha_inicio <= CURRENT_DATE
        AND ep.fecha_fin >= CURRENT_DATE
      ORDER BY ep.fecha_inicio DESC
      LIMIT 1
    ) vp ON true
    LEFT JOIN LATERAL (
      SELECT ep.aula_id
      FROM public.estudiante_periodos ep
      WHERE ep.estudiante_id = e.id
      ORDER BY ep.fecha_fin DESC NULLS LAST, ep.fecha_inicio DESC
      LIMIT 1
    ) lp ON true
  )
  UPDATE public.estudiantes e
  SET
    activo = c.activo,
    aula_id = c.aula_id,
    updated_at = NOW()
  FROM computed c
  WHERE e.id = c.estudiante_id
    AND (
      e.activo IS DISTINCT FROM c.activo
      OR e.aula_id IS DISTINCT FROM c.aula_id
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.reconciliar_estudiantes_activo_desde_periodos() IS
'Actualiza estudiantes.activo y aula_id según períodos que cubren hoy (alineado con sync_estudiante_desde_periodo). Ejecutar tras imports o si hubo fallos de trigger.';

SELECT public.reconciliar_estudiantes_activo_desde_periodos();
