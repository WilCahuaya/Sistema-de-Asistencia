-- ============================================
-- MIGRACIÓN: Función para asociar director por email
-- ============================================
-- Esta función permite asociar un usuario existente en auth.users a una FCP
-- como director, incluso si el usuario no existe en la tabla usuarios todavía.

-- Asegurarse de que la función no exista antes de crearla
DROP FUNCTION IF EXISTS public.asociar_director_por_email(UUID, TEXT);

CREATE FUNCTION public.asociar_director_por_email(
  p_fcp_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_usuario_id UUID;
  v_result JSONB;
BEGIN
  -- Buscar el usuario en auth.users por email
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = LOWER(p_email)
  LIMIT 1;

  -- Si no se encuentra en auth.users, retornar error
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Usuario no encontrado en auth.users'
    );
  END IF;

  -- Crear o actualizar el registro en usuarios si no existe
  INSERT INTO public.usuarios (id, email, nombre_completo, avatar_url)
  SELECT 
    v_auth_user_id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
    raw_user_meta_data->>'avatar_url'
  FROM auth.users
  WHERE id = v_auth_user_id
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    nombre_completo = COALESCE(
      EXCLUDED.nombre_completo,
      usuarios.nombre_completo,
      (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') FROM auth.users WHERE id = v_auth_user_id)
    ),
    avatar_url = COALESCE(
      EXCLUDED.avatar_url,
      usuarios.avatar_url,
      (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = v_auth_user_id)
    ),
    updated_at = NOW();

  v_usuario_id := v_auth_user_id;

  -- Verificar si ya existe un registro en fcp_miembros para este usuario y FCP
  -- Si existe una invitación pendiente (usuario_id IS NULL), actualizarla
  UPDATE public.fcp_miembros
  SET 
    usuario_id = v_usuario_id,
    email_pendiente = NULL,
    rol = 'director',
    activo = true,
    fecha_asignacion = COALESCE(fecha_asignacion, NOW()),
    updated_at = NOW()
  WHERE fcp_id = p_fcp_id
    AND (
      (usuario_id IS NULL AND email_pendiente = LOWER(p_email))
      OR usuario_id = v_usuario_id
    )
  RETURNING id INTO v_result;

  -- Si no se actualizó ningún registro, crear uno nuevo
  IF NOT FOUND THEN
    INSERT INTO public.fcp_miembros (
      usuario_id,
      fcp_id,
      rol,
      activo,
      fecha_asignacion
    )
    VALUES (
      v_usuario_id,
      p_fcp_id,
      'director',
      true,
      NOW()
    )
    RETURNING jsonb_build_object('id', id) INTO v_result;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Director asociado correctamente',
    'usuario_id', v_usuario_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al asociar director: ' || SQLERRM
    );
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.asociar_director_por_email(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.asociar_director_por_email(UUID, TEXT) IS 
'Función para asociar un usuario existente en auth.users a una FCP como director. Busca el usuario por email en auth.users y crea/actualiza el registro en fcp_miembros.';

