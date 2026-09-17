-- Asegura el relleno de enero–mes actual con permiso anual:
-- 1) Un solo INSERT (no se desactiva el alumno a mitad de bucle).
-- 2) Tras crear el período del mes actual, completa los meses anteriores.
-- 3) El calendario puede invocar la función (GRANT authenticated).

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
  v_uid UUID := auth.uid();
  v_insertados INT := 0;
BEGIN
  IF p_fcp_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.permiso_tardio_anual_fcp p
    WHERE p.fcp_id = p_fcp_id
      AND p.anio = v_anio
      AND v_hoy <= p.fecha_limite
  ) THEN
    RETURN 0;
  END IF;

  v_mes_hasta := CASE WHEN p_incluir_mes_actual THEN v_mes_actual ELSE v_mes_actual - 1 END;
  IF v_mes_hasta < 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.estudiante_periodos (
    estudiante_id, aula_id, fecha_inicio, fecha_fin, created_by
  )
  SELECT
    s.estudiante_id,
    s.aula_id,
    make_date(v_anio, g.m, 1),
    (make_date(v_anio, g.m, 1) + interval '1 month - 1 day')::date,
    v_uid
  FROM (
    SELECT e.id AS estudiante_id, e.aula_id
    FROM public.estudiantes e
    JOIN public.aulas a ON a.id = e.aula_id
    WHERE e.fcp_id = p_fcp_id
      AND e.aula_id IS NOT NULL
      AND COALESCE(a.tipo, 'REGULAR') = 'REGULAR'
      AND (p_estudiante_id IS NOT NULL OR e.activo IS TRUE)
      AND (p_estudiante_id IS NULL OR e.id = p_estudiante_id)
  ) s
  CROSS JOIN generate_series(1, v_mes_hasta) AS g(m)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.estudiante_periodos ep
    WHERE ep.estudiante_id = s.estudiante_id
      AND ep.fecha_inicio <= (make_date(v_anio, g.m, 1) + interval '1 month - 1 day')::date
      AND COALESCE(ep.fecha_fin, '9999-12-31'::date) >= make_date(v_anio, g.m, 1)
  );

  GET DIAGNOSTICS v_insertados = ROW_COUNT;
  RETURN COALESCE(v_insertados, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rellenar_periodos_anio_permiso_tardio(UUID, UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_periodos_rellenar_anio_permiso_anual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fcp UUID;
  v_hoy DATE := (timezone('America/Lima', now()))::date;
  v_mes_actual_inicio DATE := date_trunc('month', v_hoy)::date;
BEGIN
  IF NEW.fecha_inicio IS DISTINCT FROM v_mes_actual_inicio THEN
    RETURN NEW;
  END IF;

  SELECT e.fcp_id INTO v_fcp
  FROM public.estudiantes e
  WHERE e.id = NEW.estudiante_id;

  IF v_fcp IS NOT NULL THEN
    PERFORM public.rellenar_periodos_anio_permiso_tardio(v_fcp, NEW.estudiante_id, false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_periodos_rellenar_anio_permiso_anual ON public.estudiante_periodos;
CREATE TRIGGER trigger_periodos_rellenar_anio_permiso_anual
  AFTER INSERT ON public.estudiante_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_periodos_rellenar_anio_permiso_anual();
