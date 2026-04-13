-- ============================================
-- Permiso anual único por FCP para registro/corrección tardía
-- ============================================

CREATE TABLE IF NOT EXISTS public.permiso_tardio_anual_fcp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fcp_id UUID NOT NULL REFERENCES public.fcps(id) ON DELETE CASCADE,
  anio INT NOT NULL,
  habilitado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  habilitado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dias_habilitados SMALLINT NOT NULL CHECK (dias_habilitados IN (3, 5, 7)),
  fecha_limite DATE NOT NULL,
  habilitado_por_nombre TEXT,
  UNIQUE(fcp_id, anio)
);

CREATE INDEX IF NOT EXISTS idx_permiso_tardio_anual_fcp_anio
  ON public.permiso_tardio_anual_fcp(fcp_id, anio);

CREATE INDEX IF NOT EXISTS idx_permiso_tardio_anual_fecha_limite
  ON public.permiso_tardio_anual_fcp(fecha_limite);

CREATE OR REPLACE FUNCTION public.permiso_tardio_anual_activo(p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.permiso_tardio_anual_fcp p
    WHERE p.fcp_id = p_fcp_id
      AND p.anio = EXTRACT(YEAR FROM CURRENT_DATE)::INT
      AND CURRENT_DATE <= p.fecha_limite
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.permiso_tardio_anual_activo(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.habilitar_permiso_tardio_anual(
  p_fcp_id UUID,
  p_dias SMALLINT DEFAULT 7
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

  IF p_dias NOT IN (3, 5, 7) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Días inválidos. Usa 3, 5 o 7.');
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

  v_fecha_limite := v_hoy + p_dias;

  INSERT INTO public.permiso_tardio_anual_fcp (
    fcp_id, anio, habilitado_por, dias_habilitados, fecha_limite, habilitado_por_nombre
  )
  VALUES (
    p_fcp_id, v_anio, v_uid, p_dias, v_fecha_limite, COALESCE(v_nombre, '')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'anio', v_anio,
    'fecha_limite', v_fecha_limite,
    'dias', p_dias
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.habilitar_permiso_tardio_anual(UUID, SMALLINT) TO authenticated;

