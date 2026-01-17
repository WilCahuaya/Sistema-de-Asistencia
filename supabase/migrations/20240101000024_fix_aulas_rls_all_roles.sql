-- ============================================
-- MIGRACIÓN: Corregir políticas RLS para aulas (todos los roles)
-- Esta migración asegura que facilitadores, secretarios y tutores puedan ver aulas
-- ============================================

-- Paso 1: Eliminar todas las políticas existentes de SELECT para aulas
DROP POLICY IF EXISTS "Users can view classrooms of their ONGs" ON public.aulas;
DROP POLICY IF EXISTS "Directors can view all classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Users can view classrooms" ON public.aulas;

-- Paso 2: Verificar que RLS esté habilitado
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;

-- Paso 3: Crear política simple y correcta para SELECT
-- Esta política permite ver aulas si el usuario tiene acceso a la ONG
CREATE POLICY "Users can view classrooms of their ONGs"
ON public.aulas
FOR SELECT
USING (
    -- Verificar que el usuario esté autenticado
    auth.uid() IS NOT NULL
    AND
    (
        -- Facilitadores y Secretarios ven todas las aulas de sus ONGs
        EXISTS (
            SELECT 1 
            FROM public.usuario_ong uo
            WHERE uo.usuario_id = auth.uid()
            AND uo.ong_id = aulas.ong_id
            AND uo.rol IN ('facilitador', 'secretario')
            AND uo.activo = true
        )
        OR
        -- Tutores solo ven aulas asignadas explícitamente
        EXISTS (
            SELECT 1 
            FROM public.usuario_ong uo
            JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
            WHERE uo.usuario_id = auth.uid()
            AND uo.ong_id = aulas.ong_id
            AND uo.rol = 'tutor'
            AND uo.activo = true
            AND ta.aula_id = aulas.id
            AND ta.activo = true
            AND ta.ong_id = aulas.ong_id
        )
    )
);

-- Paso 4: Verificar que existan políticas para INSERT, UPDATE, DELETE
-- INSERT: Solo facilitadores y secretarios
DROP POLICY IF EXISTS "Facilitators and Secretaries can create classrooms" ON public.aulas;
CREATE POLICY "Facilitators and Secretaries can create classrooms"
ON public.aulas
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

-- UPDATE: Solo facilitadores y secretarios
DROP POLICY IF EXISTS "Facilitators and Secretaries can update classrooms" ON public.aulas;
CREATE POLICY "Facilitators and Secretaries can update classrooms"
ON public.aulas
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 
        FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

-- DELETE: Solo facilitadores y secretarios
DROP POLICY IF EXISTS "Facilitators and Secretaries can delete classrooms" ON public.aulas;
CREATE POLICY "Facilitators and Secretaries can delete classrooms"
ON public.aulas
FOR DELETE
USING (
    EXISTS (
        SELECT 1 
        FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

COMMENT ON POLICY "Users can view classrooms of their ONGs" ON public.aulas IS 
'Permite a facilitadores y secretarios ver todas las aulas de sus ONGs, y a tutores solo las aulas asignadas explícitamente';

-- Paso 5: Crear función helper para debug (opcional, para verificar acceso)
CREATE OR REPLACE FUNCTION public.debug_aulas_access(p_aula_id UUID)
RETURNS TABLE (
    aula_id UUID,
    aula_nombre VARCHAR,
    usuario_id UUID,
    usuario_email VARCHAR,
    rol VARCHAR,
    tiene_acceso BOOLEAN,
    razon VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_aula_ong_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    SELECT a.id, a.nombre, a.ong_id INTO aula_id, aula_nombre, v_aula_ong_id
    FROM public.aulas a
    WHERE a.id = p_aula_id;
    
    IF aula_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Verificar acceso según rol
    IF EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = v_user_id
        AND ong_id = v_aula_ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    ) THEN
        SELECT u.id, u.email, uo.rol INTO usuario_id, usuario_email, rol
        FROM public.usuarios u
        JOIN public.usuario_ong uo ON uo.usuario_id = u.id
        WHERE u.id = v_user_id
        AND uo.ong_id = v_aula_ong_id
        AND uo.rol IN ('facilitador', 'secretario')
        AND uo.activo = true
        LIMIT 1;
        
        tiene_acceso := true;
        razon := 'Facilitador o Secretario de la ONG';
    ELSIF EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
        WHERE uo.usuario_id = v_user_id
        AND uo.ong_id = v_aula_ong_id
        AND uo.rol = 'tutor'
        AND uo.activo = true
        AND ta.aula_id = p_aula_id
        AND ta.activo = true
    ) THEN
        SELECT u.id, u.email, uo.rol INTO usuario_id, usuario_email, rol
        FROM public.usuarios u
        JOIN public.usuario_ong uo ON uo.usuario_id = u.id
        WHERE u.id = v_user_id
        AND uo.ong_id = v_aula_ong_id
        AND uo.rol = 'tutor'
        AND uo.activo = true
        LIMIT 1;
        
        tiene_acceso := true;
        razon := 'Tutor con aula asignada';
    ELSE
        SELECT u.id, u.email INTO usuario_id, usuario_email
        FROM public.usuarios u
        WHERE u.id = v_user_id
        LIMIT 1;
        
        rol := NULL;
        tiene_acceso := false;
        razon := 'No tiene acceso (no es facilitador/secretario y no tiene el aula asignada como tutor)';
    END IF;
    
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_aulas_access(UUID) TO authenticated;

COMMENT ON FUNCTION public.debug_aulas_access IS 'Función de debug para verificar si un usuario tiene acceso a un aula específica';

