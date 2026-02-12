-- ============================================
-- MIGRACIÓN: Facilitador puede habilitar corrección de CUALQUIER mes pasado
-- y hacerlo varias veces (re-extender la ventana)
-- ============================================
-- Cambios:
-- 1. RPC habilitar_correccion_mes_anterior acepta p_anio y p_mes para un mes específico
-- 2. Trigger validar_inmutabilidad permite CUALQUIER mes pasado con corrección activa
-- 3. Re-habilitar el mismo mes actualiza fecha_limite (extiende ventana)

-- ============================================
-- Paso 1: RPC acepta anio y mes específicos
-- ============================================
-- Eliminar la versión anterior (2 params) para evitar funciones duplicadas
DROP FUNCTION IF EXISTS public.habilitar_correccion_mes_anterior(UUID, SMALLINT);

CREATE OR REPLACE FUNCTION public.habilitar_correccion_mes_anterior(
  p_fcp_id UUID,
  p_dias SMALLINT,
  p_anio INT DEFAULT NULL,
  p_mes INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_mes_anterior DATE;
  v_anio INT;
  v_mes INT;
  v_limite DATE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;

  IF p_dias IS NULL OR p_dias NOT IN (3, 5, 7) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dias_correccion debe ser 3, 5 o 7');
  END IF;

  IF NOT public.es_facilitador_de_fcp(v_uid, p_fcp_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el facilitador de esta FCP puede habilitar la corrección');
  END IF;

  -- Si no se pasan anio/mes, usar el mes inmediatamente anterior (comportamiento original)
  IF p_anio IS NULL OR p_mes IS NULL THEN
    v_mes_anterior := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE;
    v_anio := EXTRACT(YEAR FROM v_mes_anterior)::INT;
    v_mes := EXTRACT(MONTH FROM v_mes_anterior)::INT;
  ELSE
    v_anio := p_anio;
    v_mes := p_mes;
    IF v_mes < 1 OR v_mes > 12 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Mes inválido');
    END IF;
    -- No permitir mes actual ni futuro
    IF (v_anio > EXTRACT(YEAR FROM CURRENT_DATE)::INT)
       OR (v_anio = EXTRACT(YEAR FROM CURRENT_DATE)::INT AND v_mes >= EXTRACT(MONTH FROM CURRENT_DATE)::INT) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Solo se puede habilitar corrección para meses pasados');
    END IF;
  END IF;

  v_limite := CURRENT_DATE + (p_dias || ' days')::INTERVAL;

  INSERT INTO public.correccion_mes_fcp (fcp_id, anio, mes, habilitado_por, habilitado_at, dias_correccion, fecha_limite)
  VALUES (p_fcp_id, v_anio, v_mes, v_uid, NOW(), p_dias, v_limite)
  ON CONFLICT (fcp_id, anio, mes) DO UPDATE
  SET habilitado_por = EXCLUDED.habilitado_por,
      habilitado_at = EXCLUDED.habilitado_at,
      dias_correccion = EXCLUDED.dias_correccion,
      fecha_limite = EXCLUDED.fecha_limite
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'anio', v_anio,
    'mes', v_mes,
    'fecha_limite', v_limite,
    'dias_correccion', p_dias
  );
END;
$$;

COMMENT ON FUNCTION public.habilitar_correccion_mes_anterior(UUID, SMALLINT, INT, INT) IS 'Habilita corrección de asistencias para un mes pasado. El facilitador puede elegir cualquier mes pasado (p_anio, p_mes). Si no se pasa, usa el mes inmediatamente anterior. Llamar varias veces extiende la ventana (fecha_limite).';

GRANT EXECUTE ON FUNCTION public.habilitar_correccion_mes_anterior(UUID, SMALLINT, INT, INT) TO authenticated;

-- ============================================
-- Paso 2: Trigger permite CUALQUIER mes pasado con corrección activa
-- ============================================
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

  -- Mes pasado: permitir si corrección activa y (director o secretario)
  IF v_mes_asistencia < v_mes_actual THEN
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

  -- Corrección permitida
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

-- Paso 3: Auditoría - auditar cualquier corrección en mes pasado (no solo mes inmediato)
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

  -- Solo auditar si es corrección (mes pasado y ventana activa)
  IF DATE_TRUNC('month', v_fecha)::DATE >= v_mes_actual THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT public.correccion_activa_mes(v_fcp_id, v_anio, v_mes) THEN
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
