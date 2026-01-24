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
  v_existing_director_id UUID;
  v_existing_invitation_id UUID;
  v_has_other_roles BOOLEAN;
  v_director_registro_id UUID;
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

  -- Buscar registro existente como director
  SELECT id INTO v_existing_director_id
  FROM public.fcp_miembros
  WHERE fcp_id = p_fcp_id
    AND usuario_id = v_usuario_id
    AND rol = 'director'
  LIMIT 1;

  -- Buscar invitación pendiente con este email
  SELECT id INTO v_existing_invitation_id
  FROM public.fcp_miembros
  WHERE fcp_id = p_fcp_id
    AND usuario_id IS NULL
    AND email_pendiente = LOWER(p_email)
    AND rol = 'director'
  LIMIT 1;

  -- Verificar si el usuario tiene otros roles activos en esta FCP
  SELECT EXISTS(
    SELECT 1 FROM public.fcp_miembros
    WHERE fcp_id = p_fcp_id
      AND usuario_id = v_usuario_id
      AND rol != 'director'
      AND activo = true
  ) INTO v_has_other_roles;

  -- Si existe una invitación pendiente, actualizarla
  IF v_existing_invitation_id IS NOT NULL THEN
    UPDATE public.fcp_miembros
    SET 
      usuario_id = v_usuario_id,
      email_pendiente = NULL,
      rol = 'director',
      activo = true,
      fecha_asignacion = COALESCE(fecha_asignacion, NOW()),
      updated_at = NOW()
    WHERE id = v_existing_invitation_id
    RETURNING jsonb_build_object('id', id) INTO v_result;
  -- Si ya existe un registro como director, actualizarlo
  ELSIF v_existing_director_id IS NOT NULL THEN
    UPDATE public.fcp_miembros
    SET 
      activo = true,
      updated_at = NOW()
    WHERE id = v_existing_director_id
    RETURNING jsonb_build_object('id', id) INTO v_result;
  -- Si el usuario tiene otros roles, crear un nuevo registro como director
  -- para preservar los otros roles
  ELSIF v_has_other_roles THEN
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
  -- Si no tiene otros roles, verificar si hay algún registro inactivo para reactivar
  ELSE
    -- Buscar registro inactivo del usuario en esta FCP
    SELECT id INTO v_existing_director_id
    FROM public.fcp_miembros
    WHERE fcp_id = p_fcp_id
      AND usuario_id = v_usuario_id
      AND activo = false
    LIMIT 1;

    IF v_existing_director_id IS NOT NULL THEN
      -- Reactivar y actualizar a director
      UPDATE public.fcp_miembros
      SET 
        rol = 'director',
        activo = true,
        updated_at = NOW()
      WHERE id = v_existing_director_id
      RETURNING jsonb_build_object('id', id) INTO v_result;
    ELSE
      -- Crear nuevo registro como director
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
  END IF;

  -- IMPORTANTE: Después de crear o actualizar el director, asegurar que solo haya uno activo
  -- Llamar a manejar_cambio_director para eliminar otros directores de OTROS usuarios
  -- Obtener el ID del registro de director que acabamos de crear/actualizar
  -- Primero intentar obtenerlo del resultado si está disponible
  IF v_result IS NOT NULL AND v_result->>'id' IS NOT NULL THEN
    v_director_registro_id := (v_result->>'id')::UUID;
  ELSE
    -- Si no está en el resultado, buscarlo en la base de datos
    SELECT id INTO v_director_registro_id
    FROM public.fcp_miembros
    WHERE fcp_id = p_fcp_id
      AND usuario_id = v_usuario_id
      AND rol = 'director'
      AND activo = true
    ORDER BY fecha_asignacion DESC, created_at DESC
    LIMIT 1;
  END IF;
  
  -- Si encontramos el registro, llamar a manejar_cambio_director
  IF v_director_registro_id IS NOT NULL THEN
    PERFORM public.manejar_cambio_director(
      p_fcp_id,
      v_director_registro_id,
      v_usuario_id
    );
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
'Función para asociar un usuario existente en auth.users a una FCP como director. Busca el usuario por email en auth.users y crea/actualiza el registro en fcp_miembros. Si el usuario tiene otros roles activos en la FCP, crea un nuevo registro como director para preservar los otros roles.';

