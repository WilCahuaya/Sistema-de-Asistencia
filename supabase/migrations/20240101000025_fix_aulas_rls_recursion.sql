-- ============================================
-- MIGRACIÓN: Corregir recursión infinita en políticas RLS de aulas
-- El problema: La política SELECT de aulas consulta tutor_aula/usuario_ong
-- que pueden tener políticas que consultan aulas, creando recursión
-- Solución: Usar función SECURITY DEFINER para romper el ciclo
-- ============================================

-- Paso 1: Crear función helper SECURITY DEFINER para verificar acceso a aulas
-- Esta función se ejecuta con permisos del propietario, no del usuario,
-- por lo que no se aplican las políticas RLS y se rompe el ciclo de recursión
CREATE OR REPLACE FUNCTION public.check_aula_access(p_aula_id UUID, p_ong_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_rol VARCHAR;
BEGIN
    v_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, no tiene acceso
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar si es facilitador o secretario de la ONG
    SELECT uo.rol INTO v_rol
    FROM public.usuario_ong uo
    WHERE uo.usuario_id = v_user_id
    AND uo.ong_id = p_ong_id
    AND uo.rol IN ('facilitador', 'secretario')
    AND uo.activo = true
    LIMIT 1;
    
    IF v_rol IS NOT NULL THEN
        -- Es facilitador o secretario, tiene acceso
        RETURN TRUE;
    END IF;
    
    -- Verificar si es tutor con el aula asignada
    SELECT 1 INTO v_rol
    FROM public.usuario_ong uo
    JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
    WHERE uo.usuario_id = v_user_id
    AND uo.ong_id = p_ong_id
    AND uo.rol = 'tutor'
    AND uo.activo = true
    AND ta.aula_id = p_aula_id
    AND ta.activo = true
    AND ta.ong_id = p_ong_id
    LIMIT 1;
    
    RETURN v_rol IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_aula_access(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.check_aula_access(UUID, UUID) IS 
'Verifica si el usuario actual tiene acceso a un aula específica. Usa SECURITY DEFINER para evitar recursión en políticas RLS.';

-- Paso 2: Eliminar la política problemática
DROP POLICY IF EXISTS "Users can view classrooms of their ONGs" ON public.aulas;

-- Paso 3: Crear nueva política que usa la función helper
-- Esta política no consulta directamente tutor_aula/usuario_ong,
-- sino que llama a una función SECURITY DEFINER que lo hace sin aplicar RLS
CREATE POLICY "Users can view classrooms of their ONGs"
ON public.aulas
FOR SELECT
USING (
    auth.uid() IS NOT NULL
    AND public.check_aula_access(aulas.id, aulas.ong_id)
);

COMMENT ON POLICY "Users can view classrooms of their ONGs" ON public.aulas IS 
'Permite a facilitadores y secretarios ver todas las aulas de sus ONGs, y a tutores solo las aulas asignadas explícitamente. Usa función SECURITY DEFINER para evitar recursión.';

-- Paso 4: Las políticas de INSERT, UPDATE, DELETE también pueden causar problemas similares
-- Crear función helper para verificar permisos de escritura
CREATE OR REPLACE FUNCTION public.check_aula_write_access(p_ong_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, no tiene acceso
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Solo facilitadores y secretarios pueden escribir
    RETURN EXISTS (
        SELECT 1
        FROM public.usuario_ong
        WHERE usuario_id = v_user_id
        AND ong_id = p_ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_aula_write_access(UUID) TO authenticated;

COMMENT ON FUNCTION public.check_aula_write_access(UUID) IS 
'Verifica si el usuario actual puede crear/actualizar/eliminar aulas de una ONG. Solo facilitadores y secretarios.';

-- Paso 5: Actualizar políticas de INSERT, UPDATE, DELETE para usar la función helper
DROP POLICY IF EXISTS "Facilitators and Secretaries can create classrooms" ON public.aulas;
CREATE POLICY "Facilitators and Secretaries can create classrooms"
ON public.aulas
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.check_aula_write_access(aulas.ong_id)
);

DROP POLICY IF EXISTS "Facilitators and Secretaries can update classrooms" ON public.aulas;
CREATE POLICY "Facilitators and Secretaries can update classrooms"
ON public.aulas
FOR UPDATE
USING (
    auth.uid() IS NOT NULL
    AND public.check_aula_write_access(aulas.ong_id)
)
WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.check_aula_write_access(aulas.ong_id)
);

DROP POLICY IF EXISTS "Facilitators and Secretaries can delete classrooms" ON public.aulas;
CREATE POLICY "Facilitators and Secretaries can delete classrooms"
ON public.aulas
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    AND public.check_aula_write_access(aulas.ong_id)
);

