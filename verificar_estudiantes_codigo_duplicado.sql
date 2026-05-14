-- Duplicados de código en la misma FCP (misma persona en dos filas: activo + inactivo).
-- El índice idx_estudiantes_fcp_codigo solo exige unicidad cuando activo = true.
SELECT
  fcp_id,
  codigo,
  COUNT(*) AS filas,
  STRING_AGG(id::text, ', ' ORDER BY activo DESC) AS ids,
  BOOL_OR(activo) AS alguno_activo,
  BOOL_AND(activo) AS todos_activos
FROM public.estudiantes
GROUP BY fcp_id, codigo
HAVING COUNT(*) > 1
ORDER BY fcp_id, codigo;

-- Inconsistencia: flag activo vs período que cubre hoy (debería coincidir con sync_estudiante_desde_periodo).
WITH hoy AS (
  SELECT CURRENT_DATE AS d
),
vigente AS (
  SELECT DISTINCT ON (ep.estudiante_id)
    ep.estudiante_id,
    ep.aula_id
  FROM public.estudiante_periodos ep
  CROSS JOIN hoy
  WHERE ep.fecha_inicio <= hoy.d
    AND ep.fecha_fin >= hoy.d
  ORDER BY ep.estudiante_id, ep.fecha_inicio DESC
)
SELECT
  e.id,
  e.codigo,
  e.nombre_completo,
  e.activo AS activo_en_tabla,
  (v.estudiante_id IS NOT NULL) AS deberia_estar_activo,
  e.aula_id
FROM public.estudiantes e
LEFT JOIN vigente v ON v.estudiante_id = e.id
WHERE e.activo IS DISTINCT FROM (v.estudiante_id IS NOT NULL)
ORDER BY e.fcp_id, e.codigo;
