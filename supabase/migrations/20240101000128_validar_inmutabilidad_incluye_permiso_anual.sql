-- El trigger validar_inmutabilidad_asistencias nunca integró permiso_tardio_anual_activo;
-- solo correccion_activa_mes. Por eso director/secretario veían la UI pero la BD rechazaba.

CREATE OR REPLACE FUNCTION public.validar_inmutabilidad_asistencias()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha_asistencia DATE;
  v_mes_asistencia DATE;
  v_mes_actual DATE;
  v_anio INT;
  v_mes INT;
  v_fcp_id UUID;
  v_allow BOOLEAN := false;
  v_ultimo_dia_mes DATE;
  v_limite_gracia DATE;
BEGIN
  v_mes_actual := DATE_TRUNC('month', CURRENT_DATE)::DATE;

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

  IF v_mes_asistencia > v_mes_actual THEN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

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

  v_ultimo_dia_mes := (DATE_TRUNC('month', v_fecha_asistencia::timestamp) + INTERVAL '1 month - 1 day')::date;
  v_limite_gracia := v_ultimo_dia_mes + 7;

  IF v_mes_asistencia < v_mes_actual AND CURRENT_DATE <= v_limite_gracia THEN
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

  -- Mes pasado fuera de gracia: corrección mensual O permiso anual, y director o secretario
  IF v_mes_asistencia < v_mes_actual THEN
    IF (public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)
        OR public.permiso_tardio_anual_activo(v_fcp_id))
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

COMMENT ON FUNCTION public.validar_inmutabilidad_asistencias() IS 'Mes actual; mes pasado con gracia 7 días; mes pasado con corrección mensual o permiso anual (director/secretario).';

-- Auditoría: registrar también correcciones bajo permiso anual
CREATE OR REPLACE FUNCTION public.auditar_correccion_asistencia()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha DATE;
  v_fcp_id UUID;
  v_anio INT;
  v_mes INT;
  v_uid UUID;
  v_rol TEXT;
  v_mes_actual DATE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_mes_actual := DATE_TRUNC('month', CURRENT_DATE)::DATE;

  IF TG_OP = 'DELETE' THEN
    v_fecha := OLD.fecha;
    v_fcp_id := OLD.fcp_id;
  ELSE
    v_fecha := NEW.fecha;
    v_fcp_id := NEW.fcp_id;
  END IF;

  v_anio := EXTRACT(YEAR FROM v_fecha)::INT;
  v_mes := EXTRACT(MONTH FROM v_fecha)::INT;

  IF DATE_TRUNC('month', v_fecha)::DATE >= v_mes_actual THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT (
    public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)
    OR public.permiso_tardio_anual_activo(v_fcp_id)
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END,
    lower(TG_OP),
    jsonb_build_object(
      'estudiante_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.estudiante_id ELSE NEW.estudiante_id END,
      'fecha', v_fecha,
      'estado', CASE WHEN TG_OP = 'DELETE' THEN OLD.estado::TEXT ELSE NEW.estado::TEXT END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
