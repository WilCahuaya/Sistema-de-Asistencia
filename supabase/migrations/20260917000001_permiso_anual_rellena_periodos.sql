-- Permiso anual (FCP que empieza tarde):
-- al habilitarlo, los estudiantes activos aparecen de enero al mes actual
-- en su salón vigente. No hay que agregarlos mes a mes.
-- Si ya tienen período en un mes (otro salón), ese mes no se toca.

CREATE OR REPLACE FUNCTION public.rellenar_periodos_anio_permiso_tardio(
  p_fcp_id UUID,
  p_estudiante_id UUID DEFAULT NULL,
  p_incluir_mes_actual BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy DATE := (timezone('America/Lima', now()))::date;
  v_anio INT := EXTRACT(YEAR FROM v_hoy)::INT;
  v_mes_actual INT := EXTRACT(MONTH FROM v_hoy)::INT;
  v_mes_hasta INT;
  v_mes INT;
  v_first DATE;
  v_last DATE;
  v_uid UUID := auth.uid();
  v_insertados INT := 0;
  v_n INT;
BEGIN
  IF p_fcp_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.permiso_tardio_anual_activo(p_fcp_id) THEN
    RETURN 0;
  END IF;

  v_mes_hasta := CASE WHEN p_incluir_mes_actual THEN v_mes_actual ELSE v_mes_actual - 1 END;
  IF v_mes_hasta < 1 THEN
    RETURN 0;
  END IF;

  FOR v_mes IN 1..v_mes_hasta LOOP
    v_first := make_date(v_anio, v_mes, 1);
    v_last := (v_first + interval '1 month - 1 day')::date;

    INSERT INTO public.estudiante_periodos (
      estudiante_id, aula_id, fecha_inicio, fecha_fin, created_by
    )
    SELECT e.id, e.aula_id, v_first, v_last, v_uid
    FROM public.estudiantes e
    JOIN public.aulas a ON a.id = e.aula_id
    WHERE e.fcp_id = p_fcp_id
      AND e.activo IS TRUE
      AND COALESCE(a.tipo, 'REGULAR') = 'REGULAR'
      AND (p_estudiante_id IS NULL OR e.id = p_estudiante_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.estudiante_periodos ep
        WHERE ep.estudiante_id = e.id
          AND ep.fecha_inicio <= v_last
          AND COALESCE(ep.fecha_fin, '9999-12-31'::date) >= v_first
      );

    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_insertados := v_insertados + COALESCE(v_n, 0);
  END LOOP;

  RETURN v_insertados;
END;
$$;

COMMENT ON FUNCTION public.rellenar_periodos_anio_permiso_tardio IS
  'Con permiso anual activo, crea períodos faltantes de enero al mes (actual o anterior) en el salón vigente. No pisa meses que ya tienen período.';

CREATE OR REPLACE FUNCTION public.trg_estudiantes_rellenar_periodos_permiso_anual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.activo, false) IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.activo IS TRUE AND NEW.aula_id IS NOT NULL THEN
    PERFORM public.rellenar_periodos_anio_permiso_tardio(NEW.fcp_id, NEW.id, false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_estudiantes_rellenar_periodos_permiso_anual ON public.estudiantes;
CREATE TRIGGER trigger_estudiantes_rellenar_periodos_permiso_anual
  AFTER INSERT OR UPDATE OF activo
  ON public.estudiantes
  FOR EACH ROW
  WHEN (NEW.activo IS TRUE AND NEW.aula_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_estudiantes_rellenar_periodos_permiso_anual();

CREATE OR REPLACE FUNCTION public.habilitar_permiso_tardio_anual(
  p_fcp_id UUID,
  p_dias SMALLINT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_hoy DATE := (timezone('America/Lima', now()))::date;
  v_anio INT := EXTRACT(YEAR FROM v_hoy)::INT;
  v_nombre TEXT;
  v_exists BOOLEAN;
  v_fecha_limite DATE;
  v_periodos INT := 0;
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

  v_periodos := public.rellenar_periodos_anio_permiso_tardio(p_fcp_id, NULL, true);

  RETURN jsonb_build_object(
    'ok', true,
    'anio', v_anio,
    'fecha_limite', v_fecha_limite,
    'dias', 15,
    'periodos_creados', v_periodos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.habilitar_permiso_tardio_anual(UUID, SMALLINT) TO authenticated;
