-- ============================================
-- MIGRACIÓN: Función para obtener email y nombre de usuario desde auth.users
-- ============================================
-- Esta función permite obtener el email y nombre completo de un usuario desde auth.users
-- como respaldo cuando no existe en la tabla usuarios

-- Eliminar la función anterior si existe (necesario porque cambiamos el tipo de retorno)
DROP FUNCTION IF EXISTS public.get_user_email_from_auth(UUID);

-- Crear la función con el nuevo tipo de retorno
CREATE FUNCTION public.get_user_email_from_auth(p_user_id UUID)
RETURNS TABLE(email TEXT, nombre_completo TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.email::TEXT,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      ''
    )::TEXT AS nombre_completo
  FROM auth.users u
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_email_from_auth(UUID) IS 
'Obtiene el email y nombre completo de un usuario desde auth.users como respaldo cuando no existe en la tabla usuarios.';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_user_email_from_auth(UUID) TO authenticated;

