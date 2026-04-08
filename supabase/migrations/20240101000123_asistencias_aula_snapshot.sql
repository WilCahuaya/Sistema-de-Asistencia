-- ============================================
-- Snapshot del salón en cada fila de asistencia (historial estable)
-- El FK aula_id sigue siendo la referencia lógica; nombre/código se copian
-- al insertar para que renombres, recódigos o bajas del salón no reescriban el pasado.
-- ============================================

ALTER TABLE public.asistencias
  ADD COLUMN IF NOT EXISTS aula_nombre_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS aula_codigo_snapshot TEXT;

COMMENT ON COLUMN public.asistencias.aula_nombre_snapshot IS
  'Nombre del salón al registrar la asistencia. Inmutable; usar en historial en lugar de public.aulas.nombre actual.';
COMMENT ON COLUMN public.asistencias.aula_codigo_snapshot IS
  'Código del salón (p. ej. A01) al registrar. Inmutable.';

-- Rellenar filas existentes desde el salón actual (mejor aproximación histórica disponible).
-- Hay que desactivar la validación de mes cerrado: un UPDATE masivo en asistencias antiguas
-- dispararía validar_inmutabilidad_asistencias y fallaría.
ALTER TABLE public.asistencias DISABLE TRIGGER trigger_validar_inmutabilidad_asistencias;

UPDATE public.asistencias a
SET
  aula_nombre_snapshot = au.nombre,
  aula_codigo_snapshot = au.codigo_aula
FROM public.aulas au
WHERE a.aula_id = au.id
  AND a.aula_nombre_snapshot IS NULL;

ALTER TABLE public.asistencias ENABLE TRIGGER trigger_validar_inmutabilidad_asistencias;

-- Cualquier fila huérfana (no debería ocurrir con FK) queda explícita
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.asistencias WHERE aula_nombre_snapshot IS NULL) THEN
    RAISE EXCEPTION 'Hay asistencias sin aula_nombre_snapshot; revisar integridad aula_id → aulas.';
  END IF;
END $$;

ALTER TABLE public.asistencias
  ALTER COLUMN aula_nombre_snapshot SET NOT NULL;

-- Al insertar: fijar snapshot desde public.aulas una vez resuelto aula_id
CREATE OR REPLACE FUNCTION public.establecer_aula_id_asistencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
  v_codigo TEXT;
BEGIN
  IF NEW.aula_id IS NULL THEN
    SELECT e.aula_id INTO NEW.aula_id
    FROM public.estudiantes e
    WHERE e.id = NEW.estudiante_id;

    IF NEW.aula_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo determinar el aula_id del estudiante.';
    END IF;
  END IF;

  IF NEW.aula_nombre_snapshot IS NULL THEN
    SELECT au.nombre, au.codigo_aula INTO v_nombre, v_codigo
    FROM public.aulas au
    WHERE au.id = NEW.aula_id;

    IF v_nombre IS NULL THEN
      RAISE EXCEPTION 'No se pudo cargar el salón % para el snapshot de asistencia.', NEW.aula_id;
    END IF;

    NEW.aula_nombre_snapshot := v_nombre;
    NEW.aula_codigo_snapshot := v_codigo;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.establecer_aula_id_asistencia() IS
  'Completa aula_id si falta y fija aula_nombre_snapshot / aula_codigo_snapshot desde aulas al insertar.';

-- No permitir cambiar el snapshot en actualizaciones (estado, observaciones, etc. sí)
CREATE OR REPLACE FUNCTION public.trg_asistencias_immutable_aula_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aula_nombre_snapshot IS DISTINCT FROM OLD.aula_nombre_snapshot THEN
    RAISE EXCEPTION 'No se puede modificar aula_nombre_snapshot de una asistencia.';
  END IF;
  IF NEW.aula_codigo_snapshot IS DISTINCT FROM OLD.aula_codigo_snapshot THEN
    RAISE EXCEPTION 'No se puede modificar aula_codigo_snapshot de una asistencia.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_asistencias_immutable_aula_snapshot ON public.asistencias;
CREATE TRIGGER trigger_asistencias_immutable_aula_snapshot
  BEFORE UPDATE ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_asistencias_immutable_aula_snapshot();
