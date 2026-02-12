-- ============================================
-- NUEVO MODELO: Períodos mensuales cerrados
-- Cada mes es un período independiente (01-MM a último día).
-- No hay períodos abiertos indefinidos (fecha_fin siempre definido).
-- ============================================
-- Ver: docs/DISEÑO_ESTUDIANTE_PERIODOS.md

-- 1) Función: asegurar períodos del mes (rollover)
-- Crea períodos para el mes dado para estudiantes que tenían el mes anterior en esta aula
CREATE OR REPLACE FUNCTION public.asegurar_periodos_mes(
  p_aula_id UUID,
  p_anio INT,
  p_mes INT
)
RETURNS void AS $$
DECLARE
  v_first_day DATE;
  v_last_day DATE;
  v_prev_first DATE;
  v_prev_last DATE;
  v_fcp_id UUID;
  v_est RECORD;
BEGIN
  v_first_day := make_date(p_anio, p_mes, 1);
  v_last_day := (v_first_day + interval '1 month - 1 day')::date;

  IF p_mes = 1 THEN
    v_prev_first := make_date(p_anio - 1, 12, 1);
    v_prev_last := (v_prev_first + interval '1 month - 1 day')::date;
  ELSE
    v_prev_first := make_date(p_anio, p_mes - 1, 1);
    v_prev_last := (v_prev_first + interval '1 month - 1 day')::date;
  END IF;

  SELECT fcp_id INTO v_fcp_id FROM public.aulas WHERE id = p_aula_id;
  IF v_fcp_id IS NULL THEN RETURN; END IF;

  FOR v_est IN
    SELECT DISTINCT ep.estudiante_id, ep.aula_id
    FROM public.estudiante_periodos ep
    JOIN public.estudiantes e ON e.id = ep.estudiante_id AND e.fcp_id = v_fcp_id
    WHERE ep.aula_id = p_aula_id
      AND ep.fecha_inicio <= v_prev_last
      AND ep.fecha_fin >= v_prev_first
      AND NOT EXISTS (
        SELECT 1 FROM public.estudiante_periodos ep2
        WHERE ep2.estudiante_id = ep.estudiante_id
          AND ep2.fecha_inicio <= v_last_day
          AND ep2.fecha_fin >= v_first_day
      )
  LOOP
    INSERT INTO public.estudiante_periodos (estudiante_id, aula_id, fecha_inicio, fecha_fin, created_by)
    VALUES (v_est.estudiante_id, v_est.aula_id, v_first_day, v_last_day, NULL);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.asegurar_periodos_mes IS 'Crea períodos del mes para estudiantes que tenían el mes anterior en esta aula (rollover mensual).';

-- 2) Actualizar obtener_aula_actual: período que contiene la fecha actual (no solo fecha_fin IS NULL)
CREATE OR REPLACE FUNCTION public.obtener_aula_actual_estudiante(p_estudiante_id UUID)
RETURNS UUID AS $$
  SELECT aula_id
  FROM public.estudiante_periodos
  WHERE estudiante_id = p_estudiante_id
    AND fecha_inicio <= CURRENT_DATE
    AND fecha_fin >= CURRENT_DATE
  ORDER BY fecha_inicio DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 3) Actualizar sync_estudiante_desde_periodo: "activo" = tiene período que contiene la fecha actual
CREATE OR REPLACE FUNCTION public.sync_estudiante_desde_periodo()
RETURNS TRIGGER AS $$
DECLARE
  v_periodo_activo RECORD;
  v_est_id UUID;
BEGIN
  v_est_id := COALESCE(NEW.estudiante_id, OLD.estudiante_id);

  SELECT aula_id INTO v_periodo_activo
  FROM public.estudiante_periodos
  WHERE estudiante_id = v_est_id
    AND fecha_inicio <= CURRENT_DATE
    AND fecha_fin >= CURRENT_DATE
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.estudiantes
    SET aula_id = v_periodo_activo.aula_id,
        activo = true,
        updated_at = NOW()
    WHERE id = v_est_id;
  ELSE
    -- Sin período vigente: obtener última aula y marcar inactivo
    SELECT aula_id INTO v_periodo_activo
    FROM public.estudiante_periodos
    WHERE estudiante_id = v_est_id
    ORDER BY fecha_fin DESC NULLS LAST, fecha_inicio DESC
    LIMIT 1;

    UPDATE public.estudiantes
    SET aula_id = COALESCE(v_periodo_activo.aula_id, estudiantes.aula_id),
        activo = false,
        updated_at = NOW()
    WHERE id = v_est_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe, pero debe reaccionar a INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS trigger_sync_estudiante_desde_periodo ON public.estudiante_periodos;
CREATE TRIGGER trigger_sync_estudiante_desde_periodo
  AFTER INSERT OR UPDATE OF aula_id, fecha_inicio, fecha_fin OR DELETE
  ON public.estudiante_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_estudiante_desde_periodo();

-- 4) Migrar períodos abiertos existentes a períodos mensuales cerrados
DO $$
DECLARE
  v_rec RECORD;
  v_actual DATE := CURRENT_DATE;
  v_anio INT;
  v_mes INT;
  v_cur_anio INT := EXTRACT(YEAR FROM v_actual)::int;
  v_cur_mes INT := EXTRACT(MONTH FROM v_actual)::int;
  v_primero DATE;
  v_ultimo DATE;
BEGIN
  FOR v_rec IN
    SELECT id, estudiante_id, aula_id, fecha_inicio, created_by
    FROM public.estudiante_periodos
    WHERE fecha_fin IS NULL
  LOOP
    v_anio := EXTRACT(YEAR FROM v_rec.fecha_inicio)::int;
    v_mes := EXTRACT(MONTH FROM v_rec.fecha_inicio)::int;

    WHILE (v_anio < v_cur_anio) OR (v_anio = v_cur_anio AND v_mes <= v_cur_mes) LOOP
      v_primero := make_date(v_anio, v_mes, 1);
      v_ultimo := (v_primero + interval '1 month - 1 day')::date;

      INSERT INTO public.estudiante_periodos (estudiante_id, aula_id, fecha_inicio, fecha_fin, created_by)
      SELECT v_rec.estudiante_id, v_rec.aula_id, v_primero, v_ultimo, v_rec.created_by
      WHERE NOT EXISTS (
        SELECT 1 FROM public.estudiante_periodos ep2
        WHERE ep2.estudiante_id = v_rec.estudiante_id
          AND ep2.fecha_inicio <= v_ultimo AND ep2.fecha_fin >= v_primero
      );

      IF v_mes = 12 THEN
        v_mes := 1;
        v_anio := v_anio + 1;
      ELSE
        v_mes := v_mes + 1;
      END IF;
    END LOOP;

    DELETE FROM public.estudiante_periodos WHERE id = v_rec.id;
  END LOOP;
END;
$$;

-- 5) Constraint: fecha_fin obligatorio (modelo sin períodos abiertos)
ALTER TABLE public.estudiante_periodos
  DROP CONSTRAINT IF EXISTS chk_fecha_fin,
  ADD CONSTRAINT chk_fecha_fin CHECK (fecha_fin IS NOT NULL AND fecha_fin >= fecha_inicio);

-- 6) Índice para búsqueda por estudiante y fechas (el anterior idx_activo ya no aplica)
DROP INDEX IF EXISTS public.idx_estudiante_periodos_activo;

-- 7) Comentarios actualizados
COMMENT ON COLUMN public.estudiante_periodos.fecha_fin IS 'Siempre definido. Último día del mes del período. No hay períodos abiertos indefinidos.';
