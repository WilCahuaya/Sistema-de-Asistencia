-- ============================================
-- MIGRACIÓN: Crear relación entre tutores y aulas
-- ============================================

-- Paso 1: Crear tabla de relación tutor-aula
CREATE TABLE IF NOT EXISTS public.tutor_aula (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_ong_id UUID NOT NULL REFERENCES public.usuario_ong(id) ON DELETE CASCADE,
    aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_ong_id, aula_id)
);

-- Índices para tutor_aula
CREATE INDEX IF NOT EXISTS idx_tutor_aula_usuario_ong_id ON public.tutor_aula(usuario_ong_id);
CREATE INDEX IF NOT EXISTS idx_tutor_aula_aula_id ON public.tutor_aula(aula_id);
CREATE INDEX IF NOT EXISTS idx_tutor_aula_activo ON public.tutor_aula(activo);

-- Paso 2: Habilitar RLS en tutor_aula
ALTER TABLE public.tutor_aula ENABLE ROW LEVEL SECURITY;

-- Paso 3: Política para que los usuarios vean sus propias asignaciones de aulas
CREATE POLICY "Users can view their own classroom assignments"
ON public.tutor_aula
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_ong.id = tutor_aula.usuario_ong_id
        AND usuario_ong.usuario_id = auth.uid()
        AND usuario_ong.activo = true
    )
    OR
    -- Facilitadores y secretarios pueden ver todas las asignaciones de su ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        JOIN public.aulas a ON a.ong_id = uo.ong_id
        WHERE uo.usuario_id = auth.uid()
        AND uo.ong_id = (SELECT ong_id FROM public.usuario_ong WHERE id = tutor_aula.usuario_ong_id)
        AND uo.rol IN ('facilitador', 'secretario')
        AND uo.activo = true
        AND a.id = tutor_aula.aula_id
    )
);

-- Paso 4: Política para que facilitadores y secretarios puedan asignar aulas a tutores
CREATE POLICY "Facilitators and Secretaries can manage classroom assignments"
ON public.tutor_aula
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo_assignee
        JOIN public.usuario_ong uo_manager ON uo_manager.ong_id = uo_assignee.ong_id
        JOIN public.aulas a ON a.ong_id = uo_manager.ong_id
        WHERE uo_assignee.id = tutor_aula.usuario_ong_id
        AND uo_manager.usuario_id = auth.uid()
        AND uo_manager.rol IN ('facilitador', 'secretario')
        AND uo_manager.activo = true
        AND a.id = tutor_aula.aula_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo_assignee
        JOIN public.usuario_ong uo_manager ON uo_manager.ong_id = uo_assignee.ong_id
        JOIN public.aulas a ON a.ong_id = uo_manager.ong_id
        WHERE uo_assignee.id = tutor_aula.usuario_ong_id
        AND uo_manager.usuario_id = auth.uid()
        AND uo_manager.rol IN ('facilitador', 'secretario')
        AND uo_manager.activo = true
        AND a.id = tutor_aula.aula_id
    )
);

-- Paso 5: Función helper para obtener aulas asignadas a un tutor
CREATE OR REPLACE FUNCTION public.get_tutor_classrooms(p_usuario_id UUID, p_ong_id UUID)
RETURNS TABLE (
    aula_id UUID,
    aula_nombre VARCHAR
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT DISTINCT
        a.id AS aula_id,
        a.nombre AS aula_nombre
    FROM public.tutor_aula ta
    JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
    JOIN public.aulas a ON a.id = ta.aula_id
    WHERE uo.usuario_id = p_usuario_id
    AND uo.ong_id = p_ong_id
    AND uo.rol = 'tutor'
    AND uo.activo = true
    AND ta.activo = true
    AND a.activa = true;
$$;

COMMENT ON TABLE public.tutor_aula IS 'Relación entre tutores (usuario_ong) y aulas asignadas';
COMMENT ON FUNCTION public.get_tutor_classrooms IS 'Obtiene las aulas asignadas a un tutor en una ONG específica';

-- Paso 6: Trigger para actualizar updated_at
CREATE TRIGGER update_tutor_aula_updated_at
    BEFORE UPDATE ON public.tutor_aula
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

