-- Función de debug para verificar el acceso de un usuario
-- Útil para diagnosticar problemas de acceso

CREATE OR REPLACE FUNCTION public.debug_user_access(p_user_email TEXT)
RETURNS TABLE (
  user_exists_in_auth BOOLEAN,
  user_id_auth UUID,
  user_exists_in_usuarios BOOLEAN,
  user_id_usuarios UUID,
  has_usuario_ong_records BOOLEAN,
  usuario_ong_count INTEGER,
  usuario_ong_active_count INTEGER,
  usuario_ong_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id_auth UUID;
  v_user_id_usuarios UUID;
  v_usuario_ong_count INTEGER;
  v_usuario_ong_active_count INTEGER;
BEGIN
  -- Verificar si existe en auth.users
  SELECT id INTO v_user_id_auth
  FROM auth.users
  WHERE email = p_user_email
  LIMIT 1;

  -- Verificar si existe en public.usuarios
  IF v_user_id_auth IS NOT NULL THEN
    SELECT id INTO v_user_id_usuarios
    FROM public.usuarios
    WHERE id = v_user_id_auth
    LIMIT 1;
  END IF;

  -- Contar registros en usuario_ong
  IF v_user_id_usuarios IS NOT NULL THEN
    SELECT 
      COUNT(*) FILTER (WHERE usuario_id = v_user_id_usuarios),
      COUNT(*) FILTER (WHERE usuario_id = v_user_id_usuarios AND activo = true)
    INTO v_usuario_ong_count, v_usuario_ong_active_count
    FROM public.usuario_ong
    WHERE usuario_id = v_user_id_usuarios;
  END IF;

  RETURN QUERY
  SELECT
    v_user_id_auth IS NOT NULL AS user_exists_in_auth,
    v_user_id_auth AS user_id_auth,
    v_user_id_usuarios IS NOT NULL AS user_exists_in_usuarios,
    v_user_id_usuarios AS user_id_usuarios,
    (v_usuario_ong_count > 0) AS has_usuario_ong_records,
    COALESCE(v_usuario_ong_count, 0) AS usuario_ong_count,
    COALESCE(v_usuario_ong_active_count, 0) AS usuario_ong_active_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'ong_id', ong_id,
            'rol', rol,
            'activo', activo,
            'fecha_asignacion', fecha_asignacion
          )
        )
        FROM public.usuario_ong
        WHERE usuario_id = v_user_id_usuarios
      ),
      '[]'::jsonb
    ) AS usuario_ong_details;
END;
$$;

COMMENT ON FUNCTION public.debug_user_access IS 'Función de debug para verificar el estado de acceso de un usuario por email';

