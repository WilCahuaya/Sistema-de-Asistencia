-- ============================================
-- MIGRACIÓN: Agregar columna ong_id a tutor_aula para mejorar consultas
-- ============================================

-- Paso 1: Agregar columna ong_id si no existe (aunque se puede obtener desde usuario_ong, 
-- tenerla directamente mejora el rendimiento y las políticas RLS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tutor_aula' 
        AND column_name = 'ong_id'
    ) THEN
        ALTER TABLE public.tutor_aula ADD COLUMN ong_id UUID REFERENCES public.ongs(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Paso 2: Poblar ong_id desde usuario_ong para registros existentes
UPDATE public.tutor_aula ta
SET ong_id = uo.ong_id
FROM public.usuario_ong uo
WHERE ta.usuario_ong_id = uo.id
AND ta.ong_id IS NULL;

-- Paso 3: Hacer ong_id NOT NULL después de poblar
ALTER TABLE public.tutor_aula ALTER COLUMN ong_id SET NOT NULL;

-- Paso 4: Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_tutor_aula_ong_id ON public.tutor_aula(ong_id);

-- Paso 5: Actualizar la política RLS para usar ong_id directamente (más eficiente)
DROP POLICY IF EXISTS "Users can view classrooms of their ONGs" ON public.aulas;

CREATE POLICY "Users can view classrooms of their ONGs"
ON public.aulas
FOR SELECT
USING (
    -- Facilitadores y Secretarios ven todas las aulas de su ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
    OR
    -- Tutores solo ven aulas asignadas (usando ong_id directamente para mejor rendimiento)
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
        WHERE uo.usuario_id = auth.uid()
        AND ta.ong_id = aulas.ong_id  -- Usar ong_id directamente en lugar de uo.ong_id
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.aula_id = aulas.id
        AND ta.activo = true
    )
);

-- Paso 6: Actualizar la política de estudiantes para usar ong_id directamente
DROP POLICY IF EXISTS "Users can view students of their ONGs" ON public.estudiantes;

CREATE POLICY "Users can view students of their ONGs"
ON public.estudiantes
FOR SELECT
USING (
    -- Facilitadores y secretarios ven todos los estudiantes de su ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
    OR
    -- Tutores solo ven estudiantes de sus aulas asignadas
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
        WHERE uo.usuario_id = auth.uid()
        AND ta.ong_id = estudiantes.ong_id  -- Usar ong_id directamente
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.aula_id = estudiantes.aula_id
        AND ta.activo = true
    )
);

-- Paso 7: Actualizar la política de asistencias para usar ong_id directamente
DROP POLICY IF EXISTS "Users can view attendances of their ONGs" ON public.asistencias;

CREATE POLICY "Users can view attendances of their ONGs"
ON public.asistencias
FOR SELECT
USING (
    -- Facilitadores y secretarios ven todas las asistencias de su ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
    OR
    -- Tutores solo ven asistencias de estudiantes de sus aulas asignadas
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
        JOIN public.estudiantes e ON e.aula_id = ta.aula_id
        WHERE uo.usuario_id = auth.uid()
        AND ta.ong_id = asistencias.ong_id  -- Usar ong_id directamente
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.activo = true
        AND e.id = asistencias.estudiante_id
        AND e.activo = true
    )
);

-- Paso 8: Agregar trigger para mantener ong_id sincronizado automáticamente
CREATE OR REPLACE FUNCTION public.sync_tutor_aula_ong_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Si ong_id no está establecido, obtenerlo desde usuario_ong
    IF NEW.ong_id IS NULL THEN
        SELECT ong_id INTO NEW.ong_id
        FROM public.usuario_ong
        WHERE id = NEW.usuario_ong_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_sync_tutor_aula_ong_id ON public.tutor_aula;

-- Crear trigger
CREATE TRIGGER trigger_sync_tutor_aula_ong_id
    BEFORE INSERT OR UPDATE ON public.tutor_aula
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_tutor_aula_ong_id();

COMMENT ON COLUMN public.tutor_aula.ong_id IS 'ONG a la que pertenece esta asignación (se sincroniza automáticamente desde usuario_ong)';
COMMENT ON FUNCTION public.sync_tutor_aula_ong_id IS 'Mantiene ong_id sincronizado automáticamente desde usuario_ong';

