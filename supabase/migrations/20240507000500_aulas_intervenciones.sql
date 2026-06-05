-- ============================================
-- Intervenciones: tipo de aula, roster M2M, códigos INT-01, asistencia por temporada
-- ============================================

-- 1) Columnas en aulas
ALTER TABLE public.aulas
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'REGULAR'
    CHECK (tipo IN ('REGULAR', 'INTERVENTION'));

ALTER TABLE public.aulas
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin DATE,
  ADD COLUMN IF NOT EXISTS estado_intervencion VARCHAR(20)
    CHECK (estado_intervencion IS NULL OR estado_intervencion IN ('ACTIVA', 'FINALIZADA', 'SUSPENDIDA'));

COMMENT ON COLUMN public.aulas.tipo IS 'REGULAR = aula principal; INTERVENTION = grupo temporal de refuerzo/taller.';
COMMENT ON COLUMN public.aulas.estado_intervencion IS 'Solo para tipo INTERVENTION: ACTIVA, SUSPENDIDA (solo lectura), FINALIZADA (cierre definitivo).';

-- Intervenciones existentes (ninguna) quedan REGULAR por DEFAULT.

-- 2) Tabla intervencion_estudiantes (M2M estudiante ↔ intervención)
CREATE TABLE IF NOT EXISTS public.intervencion_estudiantes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  fcp_id UUID NOT NULL REFERENCES public.fcps(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_inscripcion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (aula_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_intervencion_estudiantes_aula ON public.intervencion_estudiantes(aula_id);
CREATE INDEX IF NOT EXISTS idx_intervencion_estudiantes_estudiante ON public.intervencion_estudiantes(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_intervencion_estudiantes_fcp ON public.intervencion_estudiantes(fcp_id);

COMMENT ON TABLE public.intervencion_estudiantes IS 'Participación de estudiantes en aulas de tipo INTERVENTION. No modifica estudiantes.aula_id.';

-- 3) Asistencias: permitir mismo estudiante/fecha en aulas distintas
ALTER TABLE public.asistencias DROP CONSTRAINT IF EXISTS asistencias_estudiante_id_fecha_key;
ALTER TABLE public.asistencias DROP CONSTRAINT IF EXISTS asistencias_estudiante_id_fecha_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'asistencias_estudiante_aula_fecha_key'
  ) THEN
    ALTER TABLE public.asistencias
      ADD CONSTRAINT asistencias_estudiante_aula_fecha_key
      UNIQUE (estudiante_id, aula_id, fecha);
  END IF;
END $$;

-- 4) Códigos A01 solo para REGULAR; INT-01 para INTERVENTION
CREATE OR REPLACE FUNCTION public.recalcular_codigos_aulas_fcp(p_fcp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.aulas
  SET codigo_aula = NULL
  WHERE fcp_id = p_fcp_id AND tipo = 'REGULAR';

  UPDATE public.aulas a
  SET codigo_aula = sub.cod
  FROM (
    SELECT id,
      'A' || LPAD(
        rn::text,
        CASE WHEN rn < 100 THEN 2 ELSE 3 END,
        '0'
      ) AS cod
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY orden, nombre, id) AS rn
      FROM public.aulas
      WHERE fcp_id = p_fcp_id AND tipo = 'REGULAR'
    ) t
  ) sub
  WHERE a.id = sub.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_codigos_intervenciones_fcp(p_fcp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.aulas
  SET codigo_aula = NULL
  WHERE fcp_id = p_fcp_id AND tipo = 'INTERVENTION';

  UPDATE public.aulas a
  SET codigo_aula = sub.cod
  FROM (
    SELECT id,
      'INT-' || LPAD(
        rn::text,
        CASE WHEN rn < 100 THEN 2 ELSE 3 END,
        '0'
      ) AS cod
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY orden, nombre, id) AS rn
      FROM public.aulas
      WHERE fcp_id = p_fcp_id AND tipo = 'INTERVENTION'
    ) t
  ) sub
  WHERE a.id = sub.id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_codigos_intervenciones_fcp(UUID) IS 'Asigna codigo_aula INT-01.. según orden dentro de intervenciones de la FCP.';

-- 5) Orden por tipo al insertar
CREATE OR REPLACE FUNCTION public.trg_aulas_before_insert_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
BEGIN
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_next
  FROM public.aulas
  WHERE fcp_id = NEW.fcp_id AND tipo = NEW.tipo;

  NEW.orden := v_next;

  IF NEW.tipo = 'INTERVENTION' AND NEW.estado_intervencion IS NULL THEN
    NEW.estado_intervencion := 'ACTIVA';
  END IF;

  RETURN NEW;
END;
$$;

-- 6) Recalcular códigos según tipo tras insert/update/delete
CREATE OR REPLACE FUNCTION public.trg_aulas_after_recalc_codigos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tipo = 'INTERVENTION' THEN
      PERFORM public.recalcular_codigos_intervenciones_fcp(NEW.fcp_id);
    ELSE
      PERFORM public.recalcular_codigos_aulas_fcp(NEW.fcp_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.fcp_id IS DISTINCT FROM NEW.fcp_id OR OLD.tipo IS DISTINCT FROM NEW.tipo THEN
      IF OLD.tipo = 'INTERVENTION' THEN
        PERFORM public.recalcular_codigos_intervenciones_fcp(OLD.fcp_id);
      ELSE
        PERFORM public.recalcular_codigos_aulas_fcp(OLD.fcp_id);
      END IF;
    END IF;
    IF NEW.tipo = 'INTERVENTION' THEN
      PERFORM public.recalcular_codigos_intervenciones_fcp(NEW.fcp_id);
    ELSE
      PERFORM public.recalcular_codigos_aulas_fcp(NEW.fcp_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.tipo = 'INTERVENTION' THEN
      PERFORM public.recalcular_codigos_intervenciones_fcp(OLD.fcp_id);
    ELSE
      PERFORM public.recalcular_codigos_aulas_fcp(OLD.fcp_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recalcular códigos INT para FCPs existentes (vacío si no hay intervenciones)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT fcp_id FROM public.aulas LOOP
    PERFORM public.recalcular_codigos_aulas_fcp(r.fcp_id);
    PERFORM public.recalcular_codigos_intervenciones_fcp(r.fcp_id);
  END LOOP;
END $$;

-- 7) RPC: estudiantes de una intervención
CREATE OR REPLACE FUNCTION public.estudiantes_de_intervencion(p_aula_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ie.estudiante_id
  FROM public.intervencion_estudiantes ie
  JOIN public.aulas a ON a.id = ie.aula_id
  WHERE ie.aula_id = p_aula_id
    AND ie.activo = true
    AND a.tipo = 'INTERVENTION';
$$;

COMMENT ON FUNCTION public.estudiantes_de_intervencion(UUID) IS 'IDs de estudiantes activos en una intervención.';

-- 8) Trigger: bloquear roster si intervención no ACTIVA
CREATE OR REPLACE FUNCTION public.validar_intervencion_estudiantes()
RETURNS TRIGGER AS $$
DECLARE
  v_estado TEXT;
  v_tipo TEXT;
  v_aula_id UUID;
BEGIN
  v_aula_id := COALESCE(NEW.aula_id, OLD.aula_id);

  SELECT tipo, estado_intervencion INTO v_tipo, v_estado
  FROM public.aulas WHERE id = v_aula_id;

  IF v_tipo IS DISTINCT FROM 'INTERVENTION' THEN
    RAISE EXCEPTION 'intervencion_estudiantes solo aplica a aulas de tipo INTERVENTION.';
  END IF;

  IF v_estado IS DISTINCT FROM 'ACTIVA' THEN
    RAISE EXCEPTION 'No se puede modificar el roster: la intervención no está ACTIVA (estado: %).', COALESCE(v_estado, 'NULL');
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.fcp_id := (SELECT fcp_id FROM public.aulas WHERE id = NEW.aula_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_intervencion_estudiantes ON public.intervencion_estudiantes;
CREATE TRIGGER trigger_validar_intervencion_estudiantes
  BEFORE INSERT OR UPDATE OR DELETE ON public.intervencion_estudiantes
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_intervencion_estudiantes();

-- 9) Inmutabilidad asistencias: intervenciones por temporada (no por mes)
CREATE OR REPLACE FUNCTION public.validar_inmutabilidad_asistencias()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha_asistencia DATE;
  v_mes_asistencia DATE;
  v_mes_actual DATE;
  v_anio INT;
  v_mes INT;
  v_fcp_id UUID;
  v_aula_id UUID;
  v_allow BOOLEAN := false;
  v_ultimo_dia_mes DATE;
  v_limite_gracia DATE;
  v_tipo_aula TEXT;
  v_estado_int TEXT;
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fecha_asistencia := OLD.fecha;
    v_fcp_id := OLD.fcp_id;
    v_aula_id := OLD.aula_id;
  ELSE
    v_fecha_asistencia := NEW.fecha;
    v_fcp_id := NEW.fcp_id;
    v_aula_id := NEW.aula_id;
  END IF;

  SELECT tipo, estado_intervencion, fecha_inicio, fecha_fin
  INTO v_tipo_aula, v_estado_int, v_fecha_inicio, v_fecha_fin
  FROM public.aulas WHERE id = v_aula_id;

  -- === Intervenciones: reglas por temporada ===
  IF v_tipo_aula = 'INTERVENTION' THEN
    IF v_estado_int = 'FINALIZADA' THEN
      RAISE EXCEPTION 'La intervención está cerrada. No se pueden modificar asistencias.';
    END IF;
    IF v_estado_int = 'SUSPENDIDA' THEN
      RAISE EXCEPTION 'La intervención está suspendida. Solo consulta.';
    END IF;
    IF v_fecha_inicio IS NOT NULL AND v_fecha_asistencia < v_fecha_inicio THEN
      RAISE EXCEPTION 'La fecha % está antes del inicio de la temporada (%).', v_fecha_asistencia, v_fecha_inicio;
    END IF;
    IF v_fecha_fin IS NOT NULL AND v_fecha_asistencia > v_fecha_fin THEN
      RAISE EXCEPTION 'La fecha % está después del fin de la temporada (%).', v_fecha_asistencia, v_fecha_fin;
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
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- === Aulas regulares: lógica mensual existente ===
  v_mes_actual := DATE_TRUNC('month', CURRENT_DATE)::DATE;
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

COMMENT ON FUNCTION public.validar_inmutabilidad_asistencias() IS 'Regulares: mes actual/gracia/corrección. Intervenciones: temporada ACTIVA sin límite mensual; SUSPENDIDA/FINALIZADA bloqueadas.';

-- 10) RLS intervencion_estudiantes
ALTER TABLE public.intervencion_estudiantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver participantes de intervenciones de mi FCP"
  ON public.intervencion_estudiantes FOR SELECT
  USING (
    public.es_facilitador(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.fcp_miembros fm
      WHERE fm.usuario_id = auth.uid() AND fm.fcp_id = intervencion_estudiantes.fcp_id AND fm.activo = true
    )
  );

CREATE POLICY "Gestionar roster intervencion director secretario"
  ON public.intervencion_estudiantes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.fcp_miembros fm
      WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = intervencion_estudiantes.fcp_id
        AND fm.activo = true
        AND fm.rol IN ('director', 'secretario')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fcp_miembros fm
      WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = intervencion_estudiantes.fcp_id
        AND fm.activo = true
        AND fm.rol IN ('director', 'secretario')
    )
  );

CREATE POLICY "Gestionar roster intervencion tutor asignado"
  ON public.intervencion_estudiantes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_aula ta
      JOIN public.fcp_miembros fm ON fm.id = ta.fcp_miembro_id
      WHERE fm.usuario_id = auth.uid()
        AND ta.aula_id = intervencion_estudiantes.aula_id
        AND ta.activo = true
        AND fm.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutor_aula ta
      JOIN public.fcp_miembros fm ON fm.id = ta.fcp_miembro_id
      WHERE fm.usuario_id = auth.uid()
        AND ta.aula_id = intervencion_estudiantes.aula_id
        AND ta.activo = true
        AND fm.activo = true
    )
  );
