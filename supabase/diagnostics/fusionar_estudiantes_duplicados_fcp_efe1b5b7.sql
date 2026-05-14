-- ============================================================================
-- Fusión de estudiantes duplicados (mismo fcp_id + codigo, una fila activa y otra no)
-- Caso reportado: FCP efe1b5b7-4360-4915-9cc4-d3db22c73d2a
--   PE053000332 → 7548c2c3-d869-447c-bc47-c2d6d66921ea, f7f8707f-73e7-4bdf-b9ff-4de59eac5522
--   PE053000381 → b06be8cc-512c-4205-af9c-9d968d01f35e, 8886110c-bbe6-4d09-9fb8-f541588a987e
--
-- Criterio: CONSERVAR la fila con más historial (asistencias, luego períodos);
--           en empate, preferir activo = true.
-- Ejecutar primero el bloque PREVIEW; si todo cuadra, descomentar y correr la TRANSACCIÓN.
-- ============================================================================

-- --- PREVIEW (solo lectura) ---
SELECT
  e.id,
  e.codigo,
  e.activo,
  e.nombre_completo,
  e.aula_id,
  (SELECT COUNT(*) FROM public.asistencias a WHERE a.estudiante_id = e.id) AS n_asistencias,
  (SELECT COUNT(*) FROM public.estudiante_periodos p WHERE p.estudiante_id = e.id) AS n_periodos,
  (SELECT COUNT(*) FROM public.historial_movimientos h WHERE h.estudiante_id = e.id) AS n_movimientos
FROM public.estudiantes e
WHERE e.fcp_id = 'efe1b5b7-4360-4915-9cc4-d3db22c73d2a'
  AND e.codigo IN ('PE053000332', 'PE053000381')
ORDER BY e.codigo,
  (SELECT COUNT(*) FROM public.asistencias a WHERE a.estudiante_id = e.id) DESC,
  (SELECT COUNT(*) FROM public.estudiante_periodos p WHERE p.estudiante_id = e.id) DESC,
  e.activo DESC;

-- --- Qué fila se conservará por código (mismo criterio que arriba) ---
WITH ranked AS (
  SELECT
    e.id,
    e.codigo,
    ROW_NUMBER() OVER (
      PARTITION BY e.codigo
      ORDER BY
        (SELECT COUNT(*) FROM public.asistencias a WHERE a.estudiante_id = e.id) DESC,
        (SELECT COUNT(*) FROM public.estudiante_periodos p WHERE p.estudiante_id = e.id) DESC,
        e.activo DESC
    ) AS rn
  FROM public.estudiantes e
  WHERE e.fcp_id = 'efe1b5b7-4360-4915-9cc4-d3db22c73d2a'
    AND e.codigo IN ('PE053000332', 'PE053000381')
)
SELECT
  codigo,
  (array_agg(id::text ORDER BY rn))[1] AS conservar_id,
  (array_agg(id::text ORDER BY rn))[2] AS eliminar_id
FROM ranked
GROUP BY codigo
ORDER BY codigo;

-- Si el resultado es JSON como el de abajo, es NORMAL: se conserva quien tiene más historial
-- (a veces es el que estaba inactivo); el duplicado “activo” vacío es el que se elimina.
-- Ejecuta la fusión ya rellenada en: fusionar_estudiantes_duplicados_EJECUTAR_efe1b5b7.sql

/*
-- --- TRANSACCIÓN: descomentar desde BEGIN hasta COMMIT y ejecutar una sola vez ---
-- (Valores del caso verificado PE053000332 / PE053000381 — ver archivo EJECUTAR.)

BEGIN;

-- OBLIGATORIO: si no se desactiva, validar_inmutabilidad_asistencias() rechaza el UPDATE de estudiante_id.
ALTER TABLE public.asistencias DISABLE TRIGGER trigger_validar_inmutabilidad_asistencias;

-- Función local de fusión (keep = conservar, drop = eliminar)
CREATE OR REPLACE FUNCTION pg_temp.fusionar_estudiante_pair(keep_id uuid, drop_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $f$
BEGIN
  IF keep_id IS NULL OR drop_id IS NULL OR keep_id = drop_id THEN
    RAISE EXCEPTION 'IDs inválidos';
  END IF;

  -- Asistencias: quitar del duplicado las fechas que ya existen en el conservado (evita violar UNIQUE)
  DELETE FROM public.asistencias a
  USING public.asistencias k
  WHERE a.estudiante_id = drop_id
    AND k.estudiante_id = keep_id
    AND k.fecha = a.fecha;

  UPDATE public.asistencias
  SET estudiante_id = keep_id
  WHERE estudiante_id = drop_id;

  UPDATE public.historial_movimientos
  SET estudiante_id = keep_id
  WHERE estudiante_id = drop_id;

  -- Períodos: borrar en drop_id los que chocan en el mismo mes calendario que ya tiene keep_id
  DELETE FROM public.estudiante_periodos p_drop
  WHERE p_drop.estudiante_id = drop_id
    AND EXISTS (
      SELECT 1
      FROM public.estudiante_periodos p_keep
      WHERE p_keep.estudiante_id = keep_id
        AND date_trunc('month', p_keep.fecha_inicio::timestamptz) = date_trunc('month', p_drop.fecha_inicio::timestamptz)
    );

  UPDATE public.estudiante_periodos
  SET estudiante_id = keep_id
  WHERE estudiante_id = drop_id;

  DELETE FROM public.estudiantes WHERE id = drop_id;
END;
$f$;

-- Pegar los UUID de conservar_id / eliminar_id que devolvió la consulta anterior.

SELECT pg_temp.fusionar_estudiante_pair(
  'f7f8707f-73e7-4bdf-b9ff-4de59eac5522'::uuid,
  '7548c2c3-d869-447c-bc47-c2d6d66921ea'::uuid
);

SELECT pg_temp.fusionar_estudiante_pair(
  '8886110c-bbe6-4d09-9fb8-f541588a987e'::uuid,
  'b06be8cc-512c-4205-af9c-9d968d01f35e'::uuid
);

DROP FUNCTION pg_temp.fusionar_estudiante_pair(uuid, uuid);

ALTER TABLE public.asistencias ENABLE TRIGGER trigger_validar_inmutabilidad_asistencias;

-- Ejecutar aparte si existe: SELECT public.reconciliar_estudiantes_activo_desde_periodos();

COMMIT;
*/
