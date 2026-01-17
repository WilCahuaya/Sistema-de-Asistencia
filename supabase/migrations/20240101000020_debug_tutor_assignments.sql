-- ============================================
-- MIGRACIÓN: Función de debug para verificar asignaciones de tutores
-- ============================================

-- Función para verificar qué aulas puede ver un tutor
CREATE OR REPLACE FUNCTION public.debug_tutor_classrooms(p_usuario_id UUID, p_ong_id UUID)
RETURNS TABLE (
    aula_id UUID,
    aula_nombre VARCHAR,
    usuario_ong_id UUID,
    tutor_aula_id UUID,
    tutor_aula_activo BOOLEAN,
    usuario_ong_activo BOOLEAN,
    usuario_ong_rol VARCHAR,
    rls_check BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_current_user_id UUID;
BEGIN
    -- Obtener el usuario actual del contexto de seguridad
    v_current_user_id := auth.uid();
    
    RETURN QUERY
    SELECT 
        a.id AS aula_id,
        a.nombre AS aula_nombre,
        uo.id AS usuario_ong_id,
        ta.id AS tutor_aula_id,
        ta.activo AS tutor_aula_activo,
        uo.activo AS usuario_ong_activo,
        uo.rol AS usuario_ong_rol,
        -- Verificar si la política RLS permitiría ver esta aula
        EXISTS (
            SELECT 1 FROM public.usuario_ong uo_check
            JOIN public.tutor_aula ta_check ON ta_check.usuario_ong_id = uo_check.id
            WHERE uo_check.usuario_id = v_current_user_id
            AND uo_check.ong_id = a.ong_id
            AND uo_check.rol = 'tutor'
            AND uo_check.activo = true
            AND ta_check.aula_id = a.id
            AND ta_check.activo = true
        ) AS rls_check
    FROM public.aulas a
    LEFT JOIN public.tutor_aula ta ON ta.aula_id = a.id
    LEFT JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
    WHERE a.ong_id = p_ong_id
    AND (uo.usuario_id = p_usuario_id OR uo.id IS NULL)
    ORDER BY a.nombre;
END;
$$;

COMMENT ON FUNCTION public.debug_tutor_classrooms IS 'Función de debug para verificar qué aulas puede ver un tutor según las políticas RLS';

