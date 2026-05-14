-- EJECUTAR EN Supabase SQL Editor.
--
-- IMPORTANTE: public.validar_inmutabilidad_asistencias() impide UPDATE de estudiante_id
-- en asistencias; sin desactivar el trigger la fusión hace ROLLBACK y no borra duplicados.
--
-- Paso 1: ejecutar TODO el bloque BEGIN...COMMIT de una vez.
-- Paso 2: si ya tienes la función reconciliar (migración 20240507000200), ejecutar la línea final sola.

BEGIN;

ALTER TABLE public.asistencias DISABLE TRIGGER trigger_validar_inmutabilidad_asistencias;

CREATE OR REPLACE FUNCTION pg_temp.fusionar_estudiante_pair(keep_id uuid, drop_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $f$
BEGIN
  IF keep_id IS NULL OR drop_id IS NULL OR keep_id = drop_id THEN
    RAISE EXCEPTION 'IDs inválidos';
  END IF;

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

COMMIT;

-- Paso 2 (fuera de la transacción anterior, opcional si existe la función):
-- SELECT public.reconciliar_estudiantes_activo_desde_periodos();
