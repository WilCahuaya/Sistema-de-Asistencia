-- ============================================
-- SCRIPT: Agregar Facilitador y asignar FCPs
-- ============================================
-- 1. Agrega el rol de Facilitador a un usuario por email.
-- 2. (Opcional) Asigna FCPs al facilitador recién creado.
-- Este rol SOLO se asigna desde la base de datos (no hay interfaz en la app).
--
-- REQUISITOS:
-- 1. El usuario DEBE existir en auth.users (haber iniciado sesión al menos una vez)
-- 2. Este script debe ejecutarse con privilegios de administrador (SQL Editor de Supabase)
--
-- CÓMO USAR:
-- 1. Reemplaza 'TU_EMAIL@ejemplo.com' con el email del usuario
-- 2. (Opcional) Agrega FCPs a asignar en v_fcp_ids o v_fcp_razones_sociales
-- 3. Ejecuta en Supabase → SQL Editor
-- ============================================

DO $$
DECLARE
  v_usuario_id UUID;
  v_email TEXT := 'TU_EMAIL@ejemplo.com';  -- ⚠️ Reemplaza con el email del usuario
  v_nombre_completo TEXT;
  -- FCPs a asignar al facilitador (elige una opción):
  v_fcp_ids UUID[] := ARRAY[]::UUID[];  -- Por ID: ARRAY['uuid-fcp-1'::UUID, 'uuid-fcp-2'::UUID]
  v_fcp_razones_sociales TEXT[] := ARRAY[]::TEXT[];  -- Por razon_social: ARRAY['Mi FCP A', 'Mi FCP B']
  v_fcp_id UUID;
  v_asignadas INT := 0;
  v_r TEXT;
BEGIN
  -- 1. Buscar usuario por email
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') 
    INTO v_usuario_id, v_nombre_completo
  FROM auth.users
  WHERE email = LOWER(TRIM(v_email))
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado con email: %. El usuario debe haberse registrado e iniciado sesión al menos una vez en la aplicación.', v_email;
  END IF;

  -- 2. Sincronizar en public.usuarios (para que aparezca el nombre en la app)
  INSERT INTO public.usuarios (id, email, nombre_completo, created_at, updated_at)
  SELECT 
    v_usuario_id,
    v_email,
    COALESCE(NULLIF(TRIM(v_nombre_completo), ''), v_email),
    NOW(),
    NOW()
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nombre_completo = COALESCE(NULLIF(TRIM(EXCLUDED.nombre_completo), ''), usuarios.nombre_completo, usuarios.email),
    updated_at = NOW();

  -- 3. Agregar a tabla facilitadores
  INSERT INTO public.facilitadores (usuario_id)
  VALUES (v_usuario_id)
  ON CONFLICT (usuario_id) DO NOTHING;

  -- 4. Asignar FCPs al facilitador
  -- Opción A: Por UUID de FCP
  IF array_length(v_fcp_ids, 1) > 0 THEN
    UPDATE public.fcps
    SET facilitador_id = v_usuario_id
    WHERE id = ANY(v_fcp_ids);
    GET DIAGNOSTICS v_asignadas = ROW_COUNT;
  END IF;

  -- Opción B: Por razon_social (si no usaste v_fcp_ids)
  IF v_asignadas = 0 AND array_length(v_fcp_razones_sociales, 1) > 0 THEN
    FOR v_r IN SELECT unnest(v_fcp_razones_sociales) LOOP
      SELECT id INTO v_fcp_id FROM public.fcps WHERE razon_social = TRIM(v_r) LIMIT 1;
      IF v_fcp_id IS NOT NULL THEN
        UPDATE public.fcps SET facilitador_id = v_usuario_id WHERE id = v_fcp_id;
        v_asignadas := v_asignadas + 1;
      ELSE
        RAISE WARNING 'FCP no encontrada con razon_social: %', v_r;
      END IF;
    END LOOP;
  END IF;

  -- Resultado
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Facilitador agregado correctamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Email: %', v_email;
  RAISE NOTICE '  Usuario ID: %', v_usuario_id;
  RAISE NOTICE '  FCPs asignadas: %', v_asignadas;
  RAISE NOTICE '';
  RAISE NOTICE 'El usuario puede ahora:';
  RAISE NOTICE '1. Iniciar sesión en la aplicación';
  RAISE NOTICE '2. Seleccionar rol "Facilitador" en /seleccionar-rol';
  RAISE NOTICE '3. Ver y gestionar sus FCPs asignadas en la sección FCPs';
  RAISE NOTICE '========================================';
END $$;

-- Verificación (opcional): descomenta para confirmar
-- SELECT f.id, f.razon_social, f.facilitador_id, u.email
-- FROM public.fcps f
-- LEFT JOIN auth.users u ON u.id = f.facilitador_id
-- WHERE u.email = 'TU_EMAIL@ejemplo.com';
