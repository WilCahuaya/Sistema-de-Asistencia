-- Corrige el error: accion_check (TG_OP devuelve 'INSERT'/'UPDATE'/'DELETE', el CHECK exige minúsculas)
-- Ejecutar en Supabase SQL Editor.

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
    v_accion := lower(TG_OP);  -- CHECK espera 'insert','update','delete'
  END IF;

  v_anio := EXTRACT(YEAR FROM v_fecha)::INT;
  v_mes := EXTRACT(MONTH FROM v_fecha)::INT;

  IF NOT (public.es_mes_inmediatamente_anterior(v_fecha) AND public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)) THEN
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
