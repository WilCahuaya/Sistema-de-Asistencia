-- ============================================
-- MIGRACIÓN: Recrear función obtener_rol_ong después del cambio de ENUM
-- ============================================

-- Eliminar la función si existe (por si acaso tiene referencias al ENUM antiguo)
DROP FUNCTION IF EXISTS public.obtener_rol_ong(UUID, UUID);

-- Recrear la función con el nuevo tipo ENUM
CREATE OR REPLACE FUNCTION public.obtener_rol_ong(
    p_ong_id UUID, 
    p_usuario_id UUID
)
RETURNS rol_type 
LANGUAGE plpgsql 
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_rol rol_type;
BEGIN
    SELECT rol INTO v_rol
    FROM public.usuario_ong 
    WHERE usuario_id = p_usuario_id 
    AND ong_id = p_ong_id 
    AND activo = true
    LIMIT 1;
    
    RETURN v_rol;
END;
$$;

-- Otorgar permisos para que sea accesible vía RPC
GRANT EXECUTE ON FUNCTION public.obtener_rol_ong(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_rol_ong(UUID, UUID) TO anon;

-- Comentario
COMMENT ON FUNCTION public.obtener_rol_ong IS 'Obtiene el rol de un usuario en una ONG específica';

