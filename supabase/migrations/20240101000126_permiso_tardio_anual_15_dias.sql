-- ============================================
-- Ajuste: permiso tardío anual fijo en 15 días
-- ============================================

-- Permitir 15 días en la restricción de la tabla.
ALTER TABLE public.permiso_tardio_anual_fcp
  DROP CONSTRAINT IF EXISTS permiso_tardio_anual_fcp_dias_habilitados_check;

ALTER TABLE public.permiso_tardio_anual_fcp
  ADD CONSTRAINT permiso_tardio_anual_fcp_dias_habilitados_check
  CHECK (dias_habilitados = 15);

-- Forzar la función de habilitación anual a 15 días.
CREATE OR REPLACE FUNCTION public.habilitar_permiso_tardio_anual(
  p_fcp_id UUID,
  p_dias SMALLINT DEFAULT 15
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_anio INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_hoy DATE := CURRENT_DATE;
  v_nombre TEXT;
  v_exists BOOLEAN;
  v_fecha_limite DATE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado.');
  END IF;

  IF p_dias <> 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La habilitación anual es fija en 15 días.');
  END IF;

  IF NOT public.es_facilitador_de_fcp(v_uid, p_fcp_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el facilitador de la FCP puede habilitar este permiso anual.');
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.permiso_tardio_anual_fcp p
    WHERE p.fcp_id = p_fcp_id
      AND p.anio = v_anio
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta FCP ya usó su permiso anual en el año actual.');
  END IF;

  SELECT COALESCE(
    u.nombre_completo,
    (au.raw_user_meta_data->>'full_name'),
    (au.raw_user_meta_data->>'name'),
    au.email::TEXT
  )
  INTO v_nombre
  FROM auth.users au
  LEFT JOIN public.usuarios u ON u.id = au.id
  WHERE au.id = v_uid;

  v_fecha_limite := v_hoy + 15;

  INSERT INTO public.permiso_tardio_anual_fcp (
    fcp_id, anio, habilitado_por, dias_habilitados, fecha_limite, habilitado_por_nombre
  )
  VALUES (
    p_fcp_id, v_anio, v_uid, 15, v_fecha_limite, COALESCE(v_nombre, '')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'anio', v_anio,
    'fecha_limite', v_fecha_limite,
    'dias', 15
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.habilitar_permiso_tardio_anual(UUID, SMALLINT) TO authenticated;

