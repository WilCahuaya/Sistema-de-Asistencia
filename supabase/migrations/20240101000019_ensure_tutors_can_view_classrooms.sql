-- ============================================
-- MIGRACIÓN: Asegurar que tutores puedan ver aulas
-- ============================================

-- Paso 1: Eliminar política antigua de SELECT si existe (por si acaso usa 'director')
DROP POLICY IF EXISTS "Users can view classrooms of their ONGs" ON public.aulas;

-- Paso 2: Crear política que permite ver aulas según el rol
-- Facilitadores y Secretarios ven todas las aulas de su ONG
-- Tutores solo ven las aulas asignadas
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
    -- Tutores solo ven aulas asignadas
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
        WHERE uo.usuario_id = auth.uid()
        AND uo.ong_id = aulas.ong_id
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.aula_id = aulas.id
        AND ta.activo = true
    )
);

COMMENT ON POLICY "Users can view classrooms of their ONGs" ON public.aulas IS 
'Permite a todos los usuarios (facilitadores, secretarios y tutores) ver aulas de sus ONGs';

