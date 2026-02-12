-- ============================================
-- MIGRACIÓN: Sistema de Períodos de Estudiantes
-- Historial de participación: ingreso, retiro, reactivación, cambio de salón
-- ============================================
-- Ver: docs/DISEÑO_ESTUDIANTE_PERIODOS.md

-- Paso 1: Crear tabla estudiante_periodos
CREATE TABLE IF NOT EXISTS public.estudiante_periodos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE RESTRICT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    motivo_retiro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT chk_fecha_fin CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_estudiante_periodos_estudiante ON public.estudiante_periodos(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_estudiante_periodos_aula ON public.estudiante_periodos(aula_id);
CREATE INDEX IF NOT EXISTS idx_estudiante_periodos_fechas ON public.estudiante_periodos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_estudiante_periodos_activo ON public.estudiante_periodos(estudiante_id) WHERE fecha_fin IS NULL;

COMMENT ON TABLE public.estudiante_periodos IS 'Historial de participación de estudiantes por aula. Un estudiante puede tener múltiples períodos (ingreso, retiro, reactivación, cambio de salón).';
COMMENT ON COLUMN public.estudiante_periodos.fecha_fin IS 'NULL = período vigente. Si tiene valor = fecha de retiro o cambio de aula.';

-- Paso 2: Migrar datos existentes (crear un período por estudiante activo)
INSERT INTO public.estudiante_periodos (estudiante_id, aula_id, fecha_inicio, fecha_fin)
SELECT 
    e.id,
    e.aula_id,
    COALESCE(e.created_at::date, CURRENT_DATE) AS fecha_inicio,
    CASE WHEN e.activo THEN NULL ELSE COALESCE(e.updated_at::date, CURRENT_DATE) END AS fecha_fin
FROM public.estudiantes e
WHERE NOT EXISTS (
    SELECT 1 FROM public.estudiante_periodos ep WHERE ep.estudiante_id = e.id
);

-- Paso 3: Función para obtener el aula actual desde el período activo
CREATE OR REPLACE FUNCTION public.obtener_aula_actual_estudiante(p_estudiante_id UUID)
RETURNS UUID AS $$
    SELECT aula_id 
    FROM public.estudiante_periodos 
    WHERE estudiante_id = p_estudiante_id AND fecha_fin IS NULL 
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Paso 4: Función - Estudiantes activos en un aula en un rango de fechas
-- Usada para: listar quiénes deben aparecer al registrar asistencia en un mes
CREATE OR REPLACE FUNCTION public.estudiantes_activos_en_rango(
    p_aula_id UUID,
    p_fecha_inicio DATE,
    p_fecha_fin DATE
)
RETURNS SETOF UUID AS $$
    SELECT DISTINCT ep.estudiante_id
    FROM public.estudiante_periodos ep
    JOIN public.estudiantes e ON e.id = ep.estudiante_id
    WHERE ep.aula_id = p_aula_id
      AND ep.fecha_inicio <= p_fecha_fin
      AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= p_fecha_inicio)
      AND e.fcp_id = (SELECT fcp_id FROM public.aulas WHERE id = p_aula_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.estudiantes_activos_en_rango IS 'Devuelve los IDs de estudiantes que debían estar en el aula en el rango de fechas dado. Usar para listar estudiantes al registrar asistencia de un mes.';

-- Paso 5: RLS para estudiante_periodos (mismo patrón que estudiantes)
ALTER TABLE public.estudiante_periodos ENABLE ROW LEVEL SECURITY;

-- SELECT: quien puede ver estudiantes puede ver sus periodos
CREATE POLICY "estudiante_periodos_select"
ON public.estudiante_periodos
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        WHERE e.id = estudiante_periodos.estudiante_id
        AND (
            public.es_facilitador(auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.fcp_miembros fm
                WHERE fm.usuario_id = auth.uid()
                AND fm.fcp_id = e.fcp_id
                AND fm.rol IN ('director', 'secretario')
                AND fm.activo = true
            )
            OR EXISTS (
                SELECT 1 FROM public.fcp_miembros fm
                JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
                WHERE fm.usuario_id = auth.uid()
                AND fm.fcp_id = e.fcp_id
                AND fm.rol = 'tutor'
                AND fm.activo = true
                AND ta.aula_id = estudiante_periodos.aula_id
                AND ta.activo = true
            )
        )
    )
);

-- INSERT: director y secretario
CREATE POLICY "estudiante_periodos_insert"
ON public.estudiante_periodos
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = estudiante_periodos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- UPDATE: director y secretario (para cerrar periodo con fecha_fin)
CREATE POLICY "estudiante_periodos_update"
ON public.estudiante_periodos
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = estudiante_periodos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = estudiante_periodos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- No permitir DELETE (histórico inmutable)

-- Paso 6: Trigger para sincronizar estudiantes.aula_id y activo desde periodo activo
CREATE OR REPLACE FUNCTION public.sync_estudiante_desde_periodo()
RETURNS TRIGGER AS $$
DECLARE
  v_periodo_activo RECORD;
BEGIN
  -- Obtener el periodo activo (fecha_fin IS NULL) del estudiante
  SELECT aula_id INTO v_periodo_activo
  FROM public.estudiante_periodos
  WHERE estudiante_id = COALESCE(NEW.estudiante_id, OLD.estudiante_id)
    AND fecha_fin IS NULL
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.estudiantes
    SET aula_id = v_periodo_activo.aula_id,
        activo = true,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.estudiante_id, OLD.estudiante_id);
  ELSE
    -- No hay periodo activo: estudiante retirado
    UPDATE public.estudiantes
    SET activo = false,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.estudiante_id, OLD.estudiante_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_estudiante_desde_periodo ON public.estudiante_periodos;
CREATE TRIGGER trigger_sync_estudiante_desde_periodo
  AFTER INSERT OR UPDATE OF fecha_fin ON public.estudiante_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_estudiante_desde_periodo();
