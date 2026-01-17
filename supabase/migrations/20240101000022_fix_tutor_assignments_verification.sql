-- ============================================
-- MIGRACIÓN: Verificar y corregir asignaciones de tutores
-- ============================================

-- Esta migración verifica que las asignaciones de tutores estén correctamente configuradas
-- y corrige cualquier problema encontrado

-- Paso 1: Verificar si hay asignaciones sin ong_id (por si la migración anterior no se ejecutó)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.tutor_aula ta
    WHERE ta.ong_id IS NULL;
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Encontradas % asignaciones sin ong_id. Actualizando...', v_count;
        
        UPDATE public.tutor_aula ta
        SET ong_id = uo.ong_id
        FROM public.usuario_ong uo
        WHERE ta.usuario_ong_id = uo.id
        AND ta.ong_id IS NULL;
    ELSE
        RAISE NOTICE 'Todas las asignaciones tienen ong_id.';
    END IF;
END $$;

-- Paso 2: Verificar que todas las asignaciones activas tengan el usuario_ong activo
-- Si el usuario_ong está inactivo, desactivar las asignaciones
UPDATE public.tutor_aula ta
SET activo = false
FROM public.usuario_ong uo
WHERE ta.usuario_ong_id = uo.id
AND ta.activo = true
AND uo.activo = false;

-- Paso 3: Crear función helper para verificar qué puede ver un tutor
CREATE OR REPLACE FUNCTION public.verify_tutor_access(p_usuario_id UUID, p_ong_id UUID)
RETURNS TABLE (
    tipo VARCHAR,
    total INTEGER,
    asignadas INTEGER,
    puede_ver INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_rol VARCHAR;
    v_usuario_ong_id UUID;
BEGIN
    -- Obtener el rol y usuario_ong_id
    SELECT uo.rol, uo.id INTO v_rol, v_usuario_ong_id
    FROM public.usuario_ong uo
    WHERE uo.usuario_id = p_usuario_id
    AND uo.ong_id = p_ong_id
    AND uo.activo = true;
    
    IF v_rol IS NULL THEN
        RAISE EXCEPTION 'Usuario no tiene acceso a esta ONG';
    END IF;
    
    -- Si es tutor, mostrar información específica
    IF v_rol = 'tutor' THEN
        -- Aulas
        RETURN QUERY
        SELECT 
            'aulas'::VARCHAR,
            (SELECT COUNT(*) FROM public.aulas WHERE ong_id = p_ong_id AND activa = true)::INTEGER,
            (SELECT COUNT(*) FROM public.tutor_aula ta 
             WHERE ta.usuario_ong_id = v_usuario_ong_id 
             AND ta.ong_id = p_ong_id 
             AND ta.activo = true)::INTEGER,
            (SELECT COUNT(*) FROM public.aulas a
             WHERE a.ong_id = p_ong_id
             AND a.activa = true
             AND EXISTS (
                 SELECT 1 FROM public.tutor_aula ta
                 WHERE ta.usuario_ong_id = v_usuario_ong_id
                 AND ta.aula_id = a.id
                 AND ta.activo = true
             ))::INTEGER;
        
        -- Estudiantes
        RETURN QUERY
        SELECT 
            'estudiantes'::VARCHAR,
            (SELECT COUNT(*) FROM public.estudiantes WHERE ong_id = p_ong_id AND activo = true)::INTEGER,
            (SELECT COUNT(DISTINCT e.id) FROM public.estudiantes e
             JOIN public.tutor_aula ta ON ta.aula_id = e.aula_id
             WHERE ta.usuario_ong_id = v_usuario_ong_id
             AND ta.ong_id = p_ong_id
             AND ta.activo = true
             AND e.activo = true)::INTEGER,
            (SELECT COUNT(*) FROM public.estudiantes e
             WHERE e.ong_id = p_ong_id
             AND e.activo = true
             AND EXISTS (
                 SELECT 1 FROM public.tutor_aula ta
                 WHERE ta.usuario_ong_id = v_usuario_ong_id
                 AND ta.aula_id = e.aula_id
                 AND ta.activo = true
             ))::INTEGER;
    ELSE
        -- Facilitadores y secretarios ven todo
        RETURN QUERY
        SELECT 
            'aulas'::VARCHAR,
            (SELECT COUNT(*) FROM public.aulas WHERE ong_id = p_ong_id AND activa = true)::INTEGER,
            (SELECT COUNT(*) FROM public.aulas WHERE ong_id = p_ong_id AND activa = true)::INTEGER,
            (SELECT COUNT(*) FROM public.aulas WHERE ong_id = p_ong_id AND activa = true)::INTEGER;
        
        RETURN QUERY
        SELECT 
            'estudiantes'::VARCHAR,
            (SELECT COUNT(*) FROM public.estudiantes WHERE ong_id = p_ong_id AND activo = true)::INTEGER,
            (SELECT COUNT(*) FROM public.estudiantes WHERE ong_id = p_ong_id AND activo = true)::INTEGER,
            (SELECT COUNT(*) FROM public.estudiantes WHERE ong_id = p_ong_id AND activo = true)::INTEGER;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.verify_tutor_access IS 'Verifica qué puede ver un usuario en una ONG específica';

