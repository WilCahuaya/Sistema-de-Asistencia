-- ============================================
-- MIGRACIÓN: Actualizar función RPC get_dashboard_stats para usar fcps
-- ============================================

-- Eliminar función antigua
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID);

-- Crear nueva función con nombres actualizados
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_fcp_id UUID DEFAULT NULL)
RETURNS TABLE (
    fcp_id UUID,
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

    -- Si se especifica una FCP, solo devolver stats de esa FCP
    -- Si no, devolver stats de todas las FCPs del usuario
    IF p_fcp_id IS NOT NULL THEN
        -- Verificar que el usuario tenga acceso a esta FCP
        SELECT fm.rol INTO v_rol
        FROM public.fcp_miembros fm
        WHERE fm.usuario_id = v_user_id
        AND fm.fcp_id = p_fcp_id
        AND fm.activo = true;
        
        IF v_rol IS NULL THEN
            RAISE EXCEPTION 'Usuario no tiene acceso a esta FCP';
        END IF;

        RETURN QUERY
        SELECT 
            p_fcp_id,
            -- Contar aulas según el rol
            CASE 
                WHEN v_rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.aulas WHERE fcp_id = p_fcp_id AND activa = true)
                WHEN v_rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.aulas a
                     WHERE a.fcp_id = p_fcp_id
                     AND a.activa = true
                     AND EXISTS (
                         SELECT 1 FROM public.fcp_miembros fm2
                         JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm2.id
                         WHERE fm2.usuario_id = v_user_id
                         AND fm2.fcp_id = p_fcp_id
                         AND fm2.rol = 'tutor'
                         AND fm2.activo = true
                         AND ta.aula_id = a.id
                         AND ta.activo = true
                         AND ta.fcp_id = a.fcp_id
                     ))
                ELSE 0
            END::INTEGER,
            -- Contar estudiantes según el rol
            CASE 
                WHEN v_rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.estudiantes WHERE fcp_id = p_fcp_id AND activo = true)
                WHEN v_rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.estudiantes e
                     WHERE e.fcp_id = p_fcp_id
                     AND e.activo = true
                     AND EXISTS (
                         SELECT 1 FROM public.fcp_miembros fm2
                         JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm2.id
                         WHERE fm2.usuario_id = v_user_id
                         AND fm2.fcp_id = p_fcp_id
                         AND fm2.rol = 'tutor'
                         AND fm2.activo = true
                         AND ta.aula_id = e.aula_id
                         AND ta.activo = true
                         AND ta.fcp_id = e.fcp_id
                     ))
                ELSE 0
            END::INTEGER;
    ELSE
        -- Devolver stats de todas las FCPs del usuario
        RETURN QUERY
        SELECT 
            fm.fcp_id,
            -- Contar aulas según el rol
            CASE 
                WHEN fm.rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.aulas WHERE fcp_id = fm.fcp_id AND activa = true)
                WHEN fm.rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.aulas a
                     WHERE a.fcp_id = fm.fcp_id
                     AND a.activa = true
                     AND EXISTS (
                         SELECT 1 FROM public.tutor_aula ta
                         WHERE ta.fcp_miembro_id = fm.id
                         AND ta.aula_id = a.id
                         AND ta.activo = true
                         AND ta.fcp_id = a.fcp_id
                     ))
                ELSE 0
            END::INTEGER,
            -- Contar estudiantes según el rol
            CASE 
                WHEN fm.rol IN ('facilitador', 'secretario') THEN
                    (SELECT COUNT(*) FROM public.estudiantes WHERE fcp_id = fm.fcp_id AND activo = true)
                WHEN fm.rol = 'tutor' THEN
                    (SELECT COUNT(*) FROM public.estudiantes e
                     WHERE e.fcp_id = fm.fcp_id
                     AND e.activo = true
                     AND EXISTS (
                         SELECT 1 FROM public.tutor_aula ta
                         WHERE ta.fcp_miembro_id = fm.id
                         AND ta.aula_id = e.aula_id
                         AND ta.activo = true
                         AND ta.fcp_id = e.fcp_id
                     ))
                ELSE 0
            END::INTEGER
        FROM public.fcp_miembros fm
        WHERE fm.usuario_id = v_user_id
        AND fm.activo = true;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats(UUID) IS 'Obtiene estadísticas del dashboard (aulas y estudiantes) respetando las políticas RLS según el rol del usuario';

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) TO authenticated;

