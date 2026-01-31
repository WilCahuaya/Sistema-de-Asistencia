-- ============================================
-- SCRIPT: Asignar rol de Facilitador (global)
-- ============================================
-- Agrega el rol de Facilitador a un usuario por email.
-- El facilitador podrá crear sus FCPs después de iniciar sesión.
-- Este rol SOLO se asigna desde la base de datos (no hay interfaz en la app).
--
-- Cómo ejecutar:
-- 1. El usuario debe existir en auth.users (haber iniciado sesión al menos una vez)
-- 2. Reemplaza 'email@ejemplo.com' con el email real
-- 3. Ejecuta en Supabase → SQL Editor
-- ============================================

DO $$
DECLARE
  v_usuario_id UUID;
  v_email TEXT := 'email@ejemplo.com';  -- ⚠️ Reemplaza con el email del usuario
BEGIN
  -- Buscar usuario por email
  SELECT id INTO v_usuario_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado con email: %. El usuario debe haber iniciado sesión al menos una vez.', v_email;
  END IF;

  -- Insertar en tabla facilitadores (rol global)
  INSERT INTO public.facilitadores (usuario_id)
  VALUES (v_usuario_id)
  ON CONFLICT (usuario_id) DO NOTHING;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Facilitador asignado correctamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Email: %', v_email;
  RAISE NOTICE '  Usuario ID: %', v_usuario_id;
  RAISE NOTICE '';
  RAISE NOTICE 'El usuario puede:';
  RAISE NOTICE '1. Iniciar sesión';
  RAISE NOTICE '2. Seleccionar rol "Facilitador" en /seleccionar-rol';
  RAISE NOTICE '3. Crear sus FCPs desde la página FCPs';
  RAISE NOTICE '========================================';
END $$;
