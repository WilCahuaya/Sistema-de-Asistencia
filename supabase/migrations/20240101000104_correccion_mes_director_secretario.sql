-- ============================================
-- Permitir solo SECRETARIO o DIRECTOR en corrección del mes anterior (con permiso del facilitador)
-- ============================================
-- El trigger solo permitía secretario. Se actualiza para permitir también director.
-- Solo cuando el facilitador ha habilitado la corrección (correccion_activa_mes).
-- El facilitador solo da el permiso; no edita asistencias del mes anterior.

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

  -- Mes actual: siempre permitir (comportamiento actual)
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

  -- Corrección permitida: restricciones de UPDATE
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

-- Auditoría: registrar correcciones hechas por director o secretario
CREATE OR REPLACE FUNCTION public.auditar_correccion_asistencia()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha DATE;
  v_fcp_id UUID;
  v_anio INT;
  v_mes INT;
  v_uid UUID;
  v_rol TEXT;
  v_accion TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_fecha := OLD.fecha;
    v_fcp_id := OLD.fcp_id;
    v_accion := 'delete';
  ELSE
    v_fecha := NEW.fecha;
    v_fcp_id := NEW.fcp_id;
    v_accion := lower(TG_OP);  -- CHECK espera 'insert','update','delete' en minúsculas
  END IF;

  v_anio := EXTRACT(YEAR FROM v_fecha)::INT;
  v_mes := EXTRACT(MONTH FROM v_fecha)::INT;

  -- Solo auditar si es corrección (mes anterior y ventana activa)
  IF NOT (public.es_mes_inmediatamente_anterior(v_fecha) AND public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Auditar solo si el usuario es secretario o director (quienes editan en corrección)
  IF NOT (public.es_secretario_de_fcp(v_uid, v_fcp_id)
          OR public.es_director_de_fcp(v_uid, v_fcp_id)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT fm.rol::TEXT INTO v_rol
  FROM public.fcp_miembros fm
  WHERE fm.usuario_id = v_uid AND fm.fcp_id = v_fcp_id AND fm.activo = true
  LIMIT 1;

  INSERT INTO public.auditoria_correcciones_asistencias (
    usuario_id, rol, fecha_hora, fcp_id, anio, mes, asistencia_id, accion, detalles
  ) VALUES (
    v_uid,
    COALESCE(v_rol, 'secretario'),
    NOW(),
    v_fcp_id,
    v_anio,
    v_mes,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END,  -- DELETE: la fila ya no existe, FK fallaría
    v_accion,
    jsonb_build_object(
      'estudiante_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.estudiante_id ELSE NEW.estudiante_id END,
      'fecha', v_fecha,
      'estado', CASE WHEN TG_OP = 'DELETE' THEN OLD.estado::TEXT ELSE NEW.estado::TEXT END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
