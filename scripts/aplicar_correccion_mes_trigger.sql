-- ============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================
-- Mes anterior:
-- - Solo SECRETARIO o DIRECTOR pueden editar.
-- - Solo cuando el FACILITADOR ya habilitó la corrección ("Habilitar corrección").
-- - El facilitador solo da el permiso; no edita asistencias del mes anterior.

CREATE OR REPLACE FUNCTION public.validar_inmutabilidad_asistencias()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha_asistencia DATE;
  v_mes_asistencia DATE;
  v_mes_actual DATE;
  v_mes_anterior DATE;
  v_anio INT;
  v_mes INT;
  v_fcp_id UUID;
  v_allow BOOLEAN := false;
BEGIN
  v_mes_actual := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_mes_anterior := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE;

  IF TG_OP = 'DELETE' THEN
    v_fecha_asistencia := OLD.fecha;
    v_fcp_id := OLD.fcp_id;
  ELSE
    v_fecha_asistencia := NEW.fecha;
    v_fcp_id := NEW.fcp_id;
  END IF;

  v_mes_asistencia := DATE_TRUNC('month', v_fecha_asistencia)::DATE;
  v_anio := EXTRACT(YEAR FROM v_fecha_asistencia)::INT;
  v_mes := EXTRACT(MONTH FROM v_fecha_asistencia)::INT;

  -- Mes futuro: siempre permitir
  IF v_mes_asistencia > v_mes_actual THEN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Mes actual: siempre permitir
  IF v_mes_asistencia = v_mes_actual THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.fecha != OLD.fecha THEN
        RAISE EXCEPTION 'No se puede cambiar la fecha de una asistencia existente.';
      END IF;
      IF NEW.aula_id != OLD.aula_id THEN
        RAISE EXCEPTION 'No se puede cambiar el aula_id de una asistencia.';
      END IF;
      IF NEW.estudiante_id != OLD.estudiante_id THEN
        RAISE EXCEPTION 'No se puede cambiar el estudiante_id de una asistencia.';
      END IF;
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Mes anterior: solo secretario o director, y solo si el facilitador habilitó la corrección
  IF v_mes_asistencia = v_mes_anterior THEN
    IF public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)
       AND (public.es_secretario_de_fcp(auth.uid(), v_fcp_id)
            OR public.es_director_de_fcp(auth.uid(), v_fcp_id)) THEN
      v_allow := true;
    END IF;
  END IF;

  IF NOT v_allow THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'No se pueden eliminar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se pueden registrar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    ELSE
      RAISE EXCEPTION 'No se pueden modificar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.fecha != OLD.fecha THEN
      RAISE EXCEPTION 'No se puede cambiar la fecha de una asistencia existente.';
    END IF;
    IF NEW.aula_id != OLD.aula_id THEN
      RAISE EXCEPTION 'No se puede cambiar el aula_id de una asistencia.';
    END IF;
    IF NEW.estudiante_id != OLD.estudiante_id THEN
      RAISE EXCEPTION 'No se puede cambiar el estudiante_id de una asistencia.';
    END IF;
    NEW.registro_tardio := true;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.registro_tardio := true;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
