-- ============================================
-- MIGRACIÓN: Actualizar políticas RLS para que tutores solo vean estudiantes de sus aulas
-- ============================================

-- Paso 1: Eliminar la política antigua de estudiantes
DROP POLICY IF EXISTS "Users can view students of their ONGs" ON public.estudiantes;

-- Paso 2: Crear nueva política que diferencia entre tutores y otros roles
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
        AND uo.ong_id = estudiantes.ong_id
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.aula_id = estudiantes.aula_id
        AND ta.activo = true
    )
);

-- Paso 3: Actualizar política de asistencias para tutores
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
        AND uo.ong_id = asistencias.ong_id
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.activo = true
        AND e.id = asistencias.estudiante_id
        AND e.activo = true
    )
);

COMMENT ON POLICY "Users can view students of their ONGs" ON public.estudiantes IS 
'Permite a facilitadores/secretarios ver todos los estudiantes, y a tutores solo los de sus aulas asignadas';

COMMENT ON POLICY "Users can view attendances of their ONGs" ON public.asistencias IS 
'Permite a facilitadores/secretarios ver todas las asistencias, y a tutores solo las de sus aulas asignadas';

