-- ============================================
-- MIGRACIÓN: Actualizar obtener_rol_fcp para devolver el rol de mayor jerarquía
-- ============================================
-- Esta migración actualiza la función obtener_rol_fcp para que cuando un usuario
-- tenga múltiples roles en la misma FCP, devuelva el rol de mayor jerarquía.
--
-- Jerarquía de roles (de mayor a menor):
-- 1. facilitador (más alto)
-- 2. director
-- 3. secretario
-- 4. tutor (más bajo)

-- Paso 1: Crear función helper para obtener la prioridad de un rol
CREATE OR REPLACE FUNCTION public.get_rol_priority(p_rol rol_type)
RETURNS INTEGER AS $$
BEGIN
    CASE p_rol
        WHEN 'facilitador' THEN RETURN 4;
        WHEN 'director' THEN RETURN 3;
        WHEN 'secretario' THEN RETURN 2;
        WHEN 'tutor' THEN RETURN 1;
        ELSE RETURN 0;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.get_rol_priority(rol_type) IS 
'Devuelve la prioridad numérica de un rol (mayor número = mayor jerarquía)';

-- Paso 2: Actualizar la función obtener_rol_fcp para devolver el rol de mayor jerarquía
CREATE OR REPLACE FUNCTION public.obtener_rol_fcp(p_fcp_id UUID, p_usuario_id UUID)
RETURNS rol_type AS $$
DECLARE
    v_rol rol_type;
BEGIN
    -- Obtener el rol con mayor prioridad (jerarquía más alta)
    SELECT rol INTO v_rol
    FROM public.fcp_miembros 
    WHERE usuario_id = p_usuario_id 
    AND fcp_id = p_fcp_id 
    AND activo = true
    ORDER BY public.get_rol_priority(rol) DESC
    LIMIT 1;
    
    RETURN v_rol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.obtener_rol_fcp(UUID, UUID) IS 
'Obtiene el rol de mayor jerarquía de un usuario en una FCP. Si el usuario tiene múltiples roles, devuelve el de mayor jerarquía (facilitador > director > secretario > tutor)';

-- Paso 3: Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_rol_priority(rol_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_rol_fcp(UUID, UUID) TO authenticated;

