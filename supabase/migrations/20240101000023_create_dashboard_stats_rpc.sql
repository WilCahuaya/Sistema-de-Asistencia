-- ============================================
-- MIGRACIÓN: Crear función RPC para estadísticas del dashboard
-- Esta función asegura que las políticas RLS se apliquen correctamente
-- ============================================

-- Función para obtener estadísticas del dashboard respetando RLS
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_ong_id UUID DEFAULT NULL)
RETURNS TABLE (
    ong_id UUID,
    total_aulas INTEGER,
    total_estudiantes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_rol VARCHAR;
BEGIN
    -- Obtener el usuario actual del contexto de seguridad
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Si se especifica una ONG, solo devolver stats de esa ONG
    -- Si no, devolver stats de todas las ONGs del usuario
    IF p_ong_id IS NOT NULL THEN
        -- Verificar que el usuario tenga acceso a esta ONG
        SELECT uo.rol INTO v_rol
        FROM public.usuario_ong uo
        WHERE uo.usuario_id = v_user_id
        AND uo.ong_id = p_ong_id
        AND uo.activo = true;
        
        IF v_rol IS NULL THEN
            RAISE EXCEPTION 'Usuario no tiene acceso a esta ONG';
        END IF;

        RETURN QUERY
        SELECT 
            p_ong_id,
            -- Contar aulas según el rol
            CASE 
                WHEN v_rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.aulas WHERE ong_id = p_ong_id AND activa = true)
                WHEN v_rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.aulas a
                     WHERE a.ong_id = p_ong_id
                     AND a.activa = true
                     AND EXISTS (
                         SELECT 1 FROM public.usuario_ong uo2
                         JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo2.id
                         WHERE uo2.usuario_id = v_user_id
                         AND uo2.ong_id = p_ong_id
                         AND uo2.rol = 'tutor'
                         AND uo2.activo = true
                         AND ta.aula_id = a.id
                         AND ta.activo = true
                         AND ta.ong_id = a.ong_id
                     ))
                ELSE 0
            END::INTEGER,
            -- Contar estudiantes según el rol
            CASE 
                WHEN v_rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.estudiantes WHERE ong_id = p_ong_id AND activo = true)
                WHEN v_rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.estudiantes e
                     WHERE e.ong_id = p_ong_id
                     AND e.activo = true
                     AND EXISTS (
                         SELECT 1 FROM public.usuario_ong uo2
                         JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo2.id
                         WHERE uo2.usuario_id = v_user_id
                         AND uo2.ong_id = p_ong_id
                         AND uo2.rol = 'tutor'
                         AND uo2.activo = true
                         AND ta.aula_id = e.aula_id
                         AND ta.activo = true
                         AND ta.ong_id = e.ong_id
                     ))
                ELSE 0
            END::INTEGER;
    ELSE
        -- Devolver stats de todas las ONGs del usuario
        RETURN QUERY
        SELECT 
            uo.ong_id,
            -- Contar aulas según el rol
            CASE 
                WHEN uo.rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.aulas WHERE ong_id = uo.ong_id AND activa = true)
                WHEN uo.rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.aulas a
                     WHERE a.ong_id = uo.ong_id
                     AND a.activa = true
                     AND EXISTS (
                         SELECT 1 FROM public.tutor_aula ta
                         WHERE ta.usuario_ong_id = uo.id
                         AND ta.aula_id = a.id
                         AND ta.activo = true
                         AND ta.ong_id = a.ong_id
                     ))
                ELSE 0
            END::INTEGER,
            -- Contar estudiantes según el rol
            CASE 
                WHEN uo.rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.estudiantes WHERE ong_id = uo.ong_id AND activo = true)
                WHEN uo.rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.estudiantes e
                     WHERE e.ong_id = uo.ong_id
                     AND e.activo = true
                     AND EXISTS (
                         SELECT 1 FROM public.tutor_aula ta
                         WHERE ta.usuario_ong_id = uo.id
                         AND ta.aula_id = e.aula_id
                         AND ta.activo = true
                         AND ta.ong_id = e.ong_id
                     ))
                ELSE 0
            END::INTEGER
        FROM public.usuario_ong uo
        WHERE uo.usuario_id = v_user_id
        AND uo.activo = true;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats(UUID) IS 'Obtiene estadísticas del dashboard (aulas y estudiantes) respetando las políticas RLS según el rol del usuario';

-- Otorgar permisos de ejecución a usuarios autenticados
-- Nota: PostgreSQL requiere especificar la firma completa de la función
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) TO authenticated;

