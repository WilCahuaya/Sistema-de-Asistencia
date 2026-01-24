-- ============================================
-- SCRIPT DE DATOS DE PRUEBA
-- Genera datos completos para testing de la aplicación
-- ============================================
-- 
-- IMPORTANTE: Este script está diseñado para desarrollo/testing
-- NO ejecutar en producción sin revisar y adaptar los datos
--
-- ⚠️ REQUISITO PREVIO CRÍTICO ⚠️
-- ANTES de ejecutar este script, DEBES crear los usuarios en auth.users
-- Ver el script: 20240101000098_crear_usuarios_prueba.sql
-- 
-- Opciones para crear usuarios:
-- 1. Manualmente en Supabase Dashboard > Authentication > Users > Add User
-- 2. Iniciar sesión con Google OAuth (crea usuarios automáticamente)
-- 3. Usar Supabase Admin API
--
-- Después de crear los usuarios, obtén sus UUIDs con:
-- SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';
-- 
-- Luego actualiza los UUIDs en este script (líneas 60-75) con los UUIDs reales.
--
-- Este script crea:
-- - 5 FCPs con diferentes características
-- - 15 usuarios de prueba (DEBEN existir en auth.users primero)
-- - Múltiples roles por usuario en diferentes FCPs
-- - 15 aulas distribuidas entre las FCPs
-- - 200+ estudiantes distribuidos en las aulas
-- - Asistencias del mes actual (algunas completas, algunas incompletas)
-- - Relaciones tutor-aula
-- ============================================

-- ============================================
-- 1. LIMPIAR DATOS EXISTENTES (OPCIONAL - COMENTAR SI NO QUIERES BORRAR)
-- ============================================
-- Descomentar las siguientes líneas si quieres limpiar datos existentes antes de insertar
-- DELETE FROM public.asistencias;
-- DELETE FROM public.historial_movimientos;
-- DELETE FROM public.estudiantes;
-- DELETE FROM public.tutor_aula;
-- DELETE FROM public.aulas;
-- DELETE FROM public.fcp_miembros;
-- DELETE FROM public.fcps WHERE razon_social LIKE '%[TEST]%';
-- DELETE FROM public.usuarios WHERE email LIKE '%@test.com';

-- ============================================
-- 2. CREAR FCPs DE PRUEBA
-- ============================================
INSERT INTO public.fcps (id, razon_social, numero_identificacion, nombre_completo_contacto, ubicacion, telefono, email, rol_contacto, activa, created_at)
VALUES
  -- FCP 1: FCP grande con múltiples aulas
  ('11111111-1111-1111-1111-111111111111', 'FCP Desarrollo Comunitario [TEST]', 'FCP001', 'Carlos Director FCP001', 'Av. Principal 123, Ciudad', '555-0001', 'contacto@fcp001.test.com', 'Director', true, NOW() - INTERVAL '6 months'),
  
  -- FCP 2: FCP mediana
  ('22222222-2222-2222-2222-222222222222', 'FCP Educación Rural [TEST]', 'FCP002', 'Ana Directora FCP002', 'Calle Secundaria 456, Pueblo', '555-0002', 'contacto@fcp002.test.com', 'Director', true, NOW() - INTERVAL '4 months'),
  
  -- FCP 3: FCP pequeña
  ('33333333-3333-3333-3333-333333333333', 'FCP Jóvenes Emprendedores [TEST]', 'FCP003', 'Luis Director FCP003', 'Plaza Central 789, Villa', '555-0003', 'contacto@fcp003.test.com', 'Director', true, NOW() - INTERVAL '3 months'),
  
  -- FCP 4: FCP nueva (poca data)
  ('44444444-4444-4444-4444-444444444444', 'FCP Nuevos Horizontes [TEST]', 'FCP004', 'María Directora FCP004', 'Barrio Nuevo 321, Ciudad', '555-0004', 'contacto@fcp004.test.com', 'Director', true, NOW() - INTERVAL '1 month'),
  
  -- FCP 5: FCP inactiva (para probar filtros)
  ('55555555-5555-5555-5555-555555555555', 'FCP Inactiva [TEST]', 'FCP005', 'Pedro Director FCP005', 'Calle Vieja 654, Pueblo', '555-0005', 'contacto@fcp005.test.com', 'Director', false, NOW() - INTERVAL '2 months')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. CREAR USUARIOS DE PRUEBA EN public.usuarios
-- ============================================
-- ⚠️ IMPORTANTE: Estos usuarios DEBEN existir primero en auth.users
-- 
-- Este script obtiene los UUIDs reales de auth.users dinámicamente
-- Si algún usuario no existe, se saltará ese usuario con una advertencia

DO $$
DECLARE
  user_id UUID;
  usuarios_creados INTEGER := 0;
  usuarios_no_encontrados INTEGER := 0;
BEGIN
  -- Usuarios facilitadores
  SELECT id INTO user_id FROM auth.users WHERE email = 'facilitador1@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'facilitador1@test.com', 'Juan Facilitador Principal', '555-1001', NULL, NOW() - INTERVAL '1 year')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario facilitador1@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'facilitador2@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'facilitador2@test.com', 'María Facilitadora Secundaria', '555-1002', NULL, NOW() - INTERVAL '10 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario facilitador2@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  -- Usuarios directores
  SELECT id INTO user_id FROM auth.users WHERE email = 'director1@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'director1@test.com', 'Carlos Director FCP001', '555-2001', NULL, NOW() - INTERVAL '6 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario director1@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'director2@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'director2@test.com', 'Ana Directora FCP002', '555-2002', NULL, NOW() - INTERVAL '4 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario director2@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'director3@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'director3@test.com', 'Luis Director FCP003', '555-2003', NULL, NOW() - INTERVAL '3 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario director3@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  -- Usuarios secretarios
  SELECT id INTO user_id FROM auth.users WHERE email = 'secretario1@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'secretario1@test.com', 'Patricia Secretaria FCP001', '555-3001', NULL, NOW() - INTERVAL '5 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario secretario1@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'secretario2@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'secretario2@test.com', 'Roberto Secretario FCP002', '555-3002', NULL, NOW() - INTERVAL '4 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario secretario2@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  -- Usuarios tutores
  SELECT id INTO user_id FROM auth.users WHERE email = 'tutor1@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'tutor1@test.com', 'Sofía Tutora Aula 1', '555-4001', NULL, NOW() - INTERVAL '5 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario tutor1@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'tutor2@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'tutor2@test.com', 'Miguel Tutor Aula 2', '555-4002', NULL, NOW() - INTERVAL '5 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario tutor2@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'tutor3@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'tutor3@test.com', 'Laura Tutora Aula 3', '555-4003', NULL, NOW() - INTERVAL '4 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario tutor3@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'tutor4@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'tutor4@test.com', 'Diego Tutor Aula 4', '555-4004', NULL, NOW() - INTERVAL '4 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario tutor4@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  SELECT id INTO user_id FROM auth.users WHERE email = 'tutor5@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'tutor5@test.com', 'Carmen Tutora Aula 5', '555-4005', NULL, NOW() - INTERVAL '3 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario tutor5@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  -- Usuario con múltiples roles
  SELECT id INTO user_id FROM auth.users WHERE email = 'multirole@test.com' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre_completo, telefono, avatar_url, created_at)
    VALUES (user_id, 'multirole@test.com', 'Pedro Multi-Rol', '555-5001', NULL, NOW() - INTERVAL '6 months')
    ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo;
    usuarios_creados := usuarios_creados + 1;
  ELSE
    RAISE WARNING 'Usuario multirole@test.com no encontrado en auth.users. Saltando...';
    usuarios_no_encontrados := usuarios_no_encontrados + 1;
  END IF;

  -- Resumen
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE CREACIÓN DE USUARIOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usuarios creados/actualizados en public.usuarios: %', usuarios_creados;
  RAISE NOTICE 'Usuarios no encontrados en auth.users: %', usuarios_no_encontrados;
  IF usuarios_no_encontrados > 0 THEN
    RAISE WARNING 'Algunos usuarios no se crearon porque no existen en auth.users.';
    RAISE WARNING 'Crea los usuarios primero en Supabase Dashboard > Authentication > Users';
    RAISE WARNING 'O inicia sesión con Google OAuth para crearlos automáticamente.';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 4. ASIGNAR ROLES A USUARIOS (fcp_miembros)
-- ============================================
INSERT INTO public.fcp_miembros (id, usuario_id, fcp_id, rol, activo, fecha_asignacion, created_at)
VALUES
  -- Facilitadores
  (uuid_generate_v4(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'facilitador', true, NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months'),
  (uuid_generate_v4(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'facilitador', true, NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months'),
  (uuid_generate_v4(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'facilitador', true, NOW() - INTERVAL '3 months', NOW() - INTERVAL '3 months'),
  
  -- Directores
  (uuid_generate_v4(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'director', true, NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months'),
  (uuid_generate_v4(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'director', true, NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months'),
  (uuid_generate_v4(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'director', true, NOW() - INTERVAL '3 months', NOW() - INTERVAL '3 months'),
  
  -- Secretarios
  (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'secretario', true, NOW() - INTERVAL '5 months', NOW() - INTERVAL '5 months'),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111100', '22222222-2222-2222-2222-222222222222', 'secretario', true, NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months'),
  
  -- Tutores
  (uuid_generate_v4(), '22222222-2222-2222-2222-222222222200', '11111111-1111-1111-1111-111111111111', 'tutor', true, NOW() - INTERVAL '5 months', NOW() - INTERVAL '5 months'),
  (uuid_generate_v4(), '33333333-3333-3333-3333-333333333300', '11111111-1111-1111-1111-111111111111', 'tutor', true, NOW() - INTERVAL '5 months', NOW() - INTERVAL '5 months'),
  (uuid_generate_v4(), '44444444-4444-4444-4444-444444444400', '22222222-2222-2222-2222-222222222222', 'tutor', true, NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months'),
  (uuid_generate_v4(), '55555555-5555-5555-5555-555555555500', '22222222-2222-2222-2222-222222222222', 'tutor', true, NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months'),
  (uuid_generate_v4(), '66666666-6666-6666-6666-666666666600', '33333333-3333-3333-3333-333333333333', 'tutor', true, NOW() - INTERVAL '3 months', NOW() - INTERVAL '3 months'),
  
  -- Usuario multi-rol (tiene múltiples roles en diferentes FCPs)
  (uuid_generate_v4(), '77777777-7777-7777-7777-777777777700', '11111111-1111-1111-1111-111111111111', 'director', true, NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months'),
  (uuid_generate_v4(), '77777777-7777-7777-7777-777777777700', '22222222-2222-2222-2222-222222222222', 'secretario', true, NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months'),
  (uuid_generate_v4(), '77777777-7777-7777-7777-777777777700', '33333333-3333-3333-3333-333333333333', 'tutor', true, NOW() - INTERVAL '3 months', NOW() - INTERVAL '3 months')
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. CREAR AULAS
-- ============================================
-- FCP 1: 5 aulas
INSERT INTO public.aulas (id, fcp_id, nombre, descripcion, activa, created_at, created_by)
VALUES
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Aula Inicial', 'Aula para estudiantes de nivel inicial', true, NOW() - INTERVAL '5 months', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Aula Intermedia', 'Aula para estudiantes de nivel intermedio', true, NOW() - INTERVAL '5 months', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Aula Avanzada', 'Aula para estudiantes de nivel avanzado', true, NOW() - INTERVAL '4 months', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Aula Especial', 'Aula para estudiantes con necesidades especiales', true, NOW() - INTERVAL '4 months', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Aula Adultos', 'Aula para estudiantes adultos', true, NOW() - INTERVAL '3 months', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- FCP 2: 4 aulas
INSERT INTO public.aulas (id, fcp_id, nombre, descripcion, activa, created_at, created_by)
VALUES
  (uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Aula Rural 1', 'Primera aula rural', true, NOW() - INTERVAL '4 months', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  (uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Aula Rural 2', 'Segunda aula rural', true, NOW() - INTERVAL '4 months', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  (uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Aula Rural 3', 'Tercera aula rural', true, NOW() - INTERVAL '3 months', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  (uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Aula Rural 4', 'Cuarta aula rural', true, NOW() - INTERVAL '3 months', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- FCP 3: 3 aulas
INSERT INTO public.aulas (id, fcp_id, nombre, descripcion, activa, created_at, created_by)
VALUES
  (uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'Aula Emprendimiento 1', 'Primera aula de emprendimiento', true, NOW() - INTERVAL '3 months', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  (uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'Aula Emprendimiento 2', 'Segunda aula de emprendimiento', true, NOW() - INTERVAL '2 months', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  (uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'Aula Emprendimiento 3', 'Tercera aula de emprendimiento', true, NOW() - INTERVAL '2 months', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

-- FCP 4: 2 aulas (FCP nueva)
INSERT INTO public.aulas (id, fcp_id, nombre, descripcion, activa, created_at, created_by)
VALUES
  (uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'Aula Nuevos Horizontes 1', 'Primera aula de nuevos horizontes', true, NOW() - INTERVAL '1 month', NULL),
  (uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'Aula Nuevos Horizontes 2', 'Segunda aula de nuevos horizontes', true, NOW() - INTERVAL '3 weeks', NULL);

-- FCP 5: 1 aula inactiva
INSERT INTO public.aulas (id, fcp_id, nombre, descripcion, activa, created_at, created_by)
VALUES
  (uuid_generate_v4(), '55555555-5555-5555-5555-555555555555', 'Aula Inactiva', 'Aula de FCP inactiva', false, NOW() - INTERVAL '2 months', NULL);

-- ============================================
-- 6. ASIGNAR TUTORES A AULAS (tutor_aula)
-- ============================================
-- Obtener IDs de aulas recién creadas y IDs de fcp_miembros para tutores
DO $$
DECLARE
  aula_fcp1_1 UUID;
  aula_fcp1_2 UUID;
  aula_fcp2_1 UUID;
  aula_fcp2_2 UUID;
  aula_fcp3_1 UUID;
  aula_fcp3_2 UUID;
  fcp_miembro_tutor1 UUID;
  fcp_miembro_tutor2 UUID;
  fcp_miembro_tutor3 UUID;
  fcp_miembro_tutor4 UUID;
  fcp_miembro_tutor5 UUID;
  fcp_miembro_multirole UUID;
BEGIN
  -- Obtener IDs de aulas de FCP 1
  SELECT id INTO aula_fcp1_1 FROM public.aulas WHERE fcp_id = '11111111-1111-1111-1111-111111111111' AND nombre = 'Aula Inicial' LIMIT 1;
  SELECT id INTO aula_fcp1_2 FROM public.aulas WHERE fcp_id = '11111111-1111-1111-1111-111111111111' AND nombre = 'Aula Intermedia' LIMIT 1;
  
  -- Obtener IDs de aulas de FCP 2
  SELECT id INTO aula_fcp2_1 FROM public.aulas WHERE fcp_id = '22222222-2222-2222-2222-222222222222' AND nombre = 'Aula Rural 1' LIMIT 1;
  SELECT id INTO aula_fcp2_2 FROM public.aulas WHERE fcp_id = '22222222-2222-2222-2222-222222222222' AND nombre = 'Aula Rural 2' LIMIT 1;
  
  -- Obtener IDs de aulas de FCP 3
  SELECT id INTO aula_fcp3_1 FROM public.aulas WHERE fcp_id = '33333333-3333-3333-3333-333333333333' AND nombre = 'Aula Emprendimiento 1' LIMIT 1;
  SELECT id INTO aula_fcp3_2 FROM public.aulas WHERE fcp_id = '33333333-3333-3333-3333-333333333333' AND nombre = 'Aula Emprendimiento 2' LIMIT 1;
  
  -- Obtener IDs de fcp_miembros para los tutores (usando emails en lugar de UUIDs fijos)
  SELECT fm.id INTO fcp_miembro_tutor1 
  FROM public.fcp_miembros fm
  JOIN auth.users u ON fm.usuario_id = u.id
  WHERE u.email = 'tutor1@test.com' AND fm.fcp_id = '11111111-1111-1111-1111-111111111111' AND fm.rol = 'tutor' LIMIT 1;
  
  SELECT fm.id INTO fcp_miembro_tutor2 
  FROM public.fcp_miembros fm
  JOIN auth.users u ON fm.usuario_id = u.id
  WHERE u.email = 'tutor2@test.com' AND fm.fcp_id = '11111111-1111-1111-1111-111111111111' AND fm.rol = 'tutor' LIMIT 1;
  
  SELECT fm.id INTO fcp_miembro_tutor3 
  FROM public.fcp_miembros fm
  JOIN auth.users u ON fm.usuario_id = u.id
  WHERE u.email = 'tutor3@test.com' AND fm.fcp_id = '22222222-2222-2222-2222-222222222222' AND fm.rol = 'tutor' LIMIT 1;
  
  SELECT fm.id INTO fcp_miembro_tutor4 
  FROM public.fcp_miembros fm
  JOIN auth.users u ON fm.usuario_id = u.id
  WHERE u.email = 'tutor4@test.com' AND fm.fcp_id = '22222222-2222-2222-2222-222222222222' AND fm.rol = 'tutor' LIMIT 1;
  
  SELECT fm.id INTO fcp_miembro_tutor5 
  FROM public.fcp_miembros fm
  JOIN auth.users u ON fm.usuario_id = u.id
  WHERE u.email = 'tutor5@test.com' AND fm.fcp_id = '33333333-3333-3333-3333-333333333333' AND fm.rol = 'tutor' LIMIT 1;
  
  SELECT fm.id INTO fcp_miembro_multirole 
  FROM public.fcp_miembros fm
  JOIN auth.users u ON fm.usuario_id = u.id
  WHERE u.email = 'multirole@test.com' AND fm.fcp_id = '33333333-3333-3333-3333-333333333333' AND fm.rol = 'tutor' LIMIT 1;
  
  -- Asignar tutores a aulas de FCP 1
  IF aula_fcp1_1 IS NOT NULL AND fcp_miembro_tutor1 IS NOT NULL THEN
    INSERT INTO public.tutor_aula (fcp_miembro_id, aula_id, activo, created_at)
    VALUES (fcp_miembro_tutor1, aula_fcp1_1, true, NOW() - INTERVAL '5 months')
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF aula_fcp1_2 IS NOT NULL AND fcp_miembro_tutor2 IS NOT NULL THEN
    INSERT INTO public.tutor_aula (fcp_miembro_id, aula_id, activo, created_at)
    VALUES (fcp_miembro_tutor2, aula_fcp1_2, true, NOW() - INTERVAL '5 months')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Asignar tutores a aulas de FCP 2
  IF aula_fcp2_1 IS NOT NULL AND fcp_miembro_tutor3 IS NOT NULL THEN
    INSERT INTO public.tutor_aula (fcp_miembro_id, aula_id, activo, created_at)
    VALUES (fcp_miembro_tutor3, aula_fcp2_1, true, NOW() - INTERVAL '4 months')
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF aula_fcp2_2 IS NOT NULL AND fcp_miembro_tutor4 IS NOT NULL THEN
    INSERT INTO public.tutor_aula (fcp_miembro_id, aula_id, activo, created_at)
    VALUES (fcp_miembro_tutor4, aula_fcp2_2, true, NOW() - INTERVAL '4 months')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Asignar tutores a aulas de FCP 3
  IF aula_fcp3_1 IS NOT NULL AND fcp_miembro_tutor5 IS NOT NULL THEN
    INSERT INTO public.tutor_aula (fcp_miembro_id, aula_id, activo, created_at)
    VALUES (fcp_miembro_tutor5, aula_fcp3_1, true, NOW() - INTERVAL '3 months')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Usuario multi-rol como tutor en FCP 3
  IF aula_fcp3_2 IS NOT NULL AND fcp_miembro_multirole IS NOT NULL THEN
    INSERT INTO public.tutor_aula (fcp_miembro_id, aula_id, activo, created_at)
    VALUES (fcp_miembro_multirole, aula_fcp3_2, true, NOW() - INTERVAL '3 months')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 7. CREAR ESTUDIANTES
-- ============================================
-- Función auxiliar para crear estudiantes en una aula
DO $$
DECLARE
  aula_record RECORD;
  estudiante_counter INTEGER;
  codigo_base VARCHAR(50);
  nombres_masculinos TEXT[] := ARRAY['Juan', 'Carlos', 'Miguel', 'Luis', 'Pedro', 'Diego', 'Roberto', 'Fernando', 'Andrés', 'José', 'Manuel', 'Ricardo', 'Francisco', 'Antonio', 'Alejandro'];
  nombres_femeninos TEXT[] := ARRAY['María', 'Ana', 'Laura', 'Sofía', 'Carmen', 'Patricia', 'Elena', 'Isabel', 'Lucía', 'Paula', 'Marta', 'Cristina', 'Beatriz', 'Rosa', 'Diana'];
  apellidos TEXT[] := ARRAY['García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales'];
  nombre_completo TEXT;
  genero TEXT;
  nombre_primero TEXT;
BEGIN
  -- Crear estudiantes para cada aula activa
  FOR aula_record IN 
    SELECT id, fcp_id, nombre 
    FROM public.aulas 
    WHERE activa = true
    ORDER BY fcp_id, nombre
  LOOP
    -- Determinar cantidad de estudiantes por aula (entre 15 y 30)
    estudiante_counter := 15 + floor(random() * 16)::INTEGER;
    codigo_base := 'EST-' || SUBSTRING(aula_record.id::text, 1, 8) || '-';
    
    -- Crear estudiantes
    FOR i IN 1..estudiante_counter LOOP
      -- Determinar género aleatorio
      IF random() < 0.5 THEN
        genero := 'masculino';
        nombre_primero := nombres_masculinos[1 + floor(random() * array_length(nombres_masculinos, 1))::INTEGER];
      ELSE
        genero := 'femenino';
        nombre_primero := nombres_femeninos[1 + floor(random() * array_length(nombres_femeninos, 1))::INTEGER];
      END IF;
      
      nombre_completo := nombre_primero || ' ' || apellidos[1 + floor(random() * array_length(apellidos, 1))::INTEGER] || ' ' || apellidos[1 + floor(random() * array_length(apellidos, 1))::INTEGER];
      
      -- Insertar estudiante
      INSERT INTO public.estudiantes (id, fcp_id, aula_id, codigo, nombre_completo, activo, created_at)
      VALUES (
        uuid_generate_v4(),
        aula_record.fcp_id,
        aula_record.id,
        codigo_base || LPAD(i::TEXT, 3, '0'),
        nombre_completo,
        true,
        NOW() - INTERVAL '6 months' + (random() * INTERVAL '5 months')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 8. CREAR ASISTENCIAS (Mes actual y mes anterior)
-- ============================================
-- Crear asistencias para el mes actual y el mes anterior
-- Algunos días completos, algunos incompletos (para probar alertas)
DO $$
DECLARE
  estudiante_record RECORD;
  fecha_actual DATE;
  fecha_inicio DATE;
  fecha_fin DATE;
  dia_actual DATE;
  estado_asistencia TEXT;
  estudiantes_por_aula INTEGER;
  estudiantes_marcados INTEGER;
  aula_record RECORD;
BEGIN
  -- Mes actual
  fecha_inicio := DATE_TRUNC('month', CURRENT_DATE);
  fecha_fin := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
  
  -- Mes anterior
  fecha_inicio := fecha_inicio - INTERVAL '1 month';
  fecha_fin := fecha_fin - INTERVAL '1 month';
  
  -- Procesar cada aula
  FOR aula_record IN 
    SELECT id, fcp_id, nombre 
    FROM public.aulas 
    WHERE activa = true
  LOOP
    -- Contar estudiantes en esta aula
    SELECT COUNT(*) INTO estudiantes_por_aula
    FROM public.estudiantes
    WHERE aula_id = aula_record.id AND activo = true;
    
    -- Si no hay estudiantes, continuar
    IF estudiantes_por_aula = 0 THEN
      CONTINUE;
    END IF;
    
    -- Generar asistencias para cada día del mes anterior
    dia_actual := fecha_inicio;
    WHILE dia_actual <= fecha_fin LOOP
      -- Saltar fines de semana (sábado=6, domingo=0)
      IF EXTRACT(DOW FROM dia_actual) IN (0, 6) THEN
        dia_actual := dia_actual + INTERVAL '1 day';
        CONTINUE;
      END IF;
      
      -- Determinar si el día será completo o incompleto
      -- 70% de días completos, 30% incompletos
      IF random() < 0.7 THEN
        estudiantes_marcados := estudiantes_por_aula; -- Día completo
      ELSE
        -- Día incompleto: marcar entre 60% y 90% de estudiantes
        estudiantes_marcados := GREATEST(1, floor(estudiantes_por_aula * (0.6 + random() * 0.3))::INTEGER);
      END IF;
      
      -- Crear asistencias para estudiantes seleccionados
      FOR estudiante_record IN 
        SELECT id 
        FROM public.estudiantes 
        WHERE aula_id = aula_record.id 
          AND activo = true
          AND created_at <= dia_actual  -- Solo estudiantes que existían en esa fecha
        ORDER BY random()
        LIMIT estudiantes_marcados
      LOOP
        -- Determinar estado de asistencia aleatorio
        -- 70% presente, 20% faltó, 10% permiso
        IF random() < 0.7 THEN
          estado_asistencia := 'presente';
        ELSIF random() < 0.9 THEN
          estado_asistencia := 'falto';
        ELSE
          estado_asistencia := 'permiso';
        END IF;
        
        -- Insertar asistencia
        INSERT INTO public.asistencias (id, fcp_id, estudiante_id, fecha, estado, created_at)
        VALUES (
          uuid_generate_v4(),
          aula_record.fcp_id,
          estudiante_record.id,
          dia_actual,
          estado_asistencia::estado_asistencia,
          NOW() - INTERVAL '1 month' + (random() * INTERVAL '1 day')
        )
        ON CONFLICT (estudiante_id, fecha) DO NOTHING;
      END LOOP;
      
      dia_actual := dia_actual + INTERVAL '1 day';
    END LOOP;
    
    -- También crear algunas asistencias para el mes actual (menos días)
    fecha_inicio := DATE_TRUNC('month', CURRENT_DATE);
    fecha_fin := CURRENT_DATE; -- Solo hasta hoy
    
    dia_actual := fecha_inicio;
    WHILE dia_actual <= fecha_fin LOOP
      -- Saltar fines de semana
      IF EXTRACT(DOW FROM dia_actual) IN (0, 6) THEN
        dia_actual := dia_actual + INTERVAL '1 day';
        CONTINUE;
      END IF;
      
      -- 80% de días completos en el mes actual
      IF random() < 0.8 THEN
        estudiantes_marcados := estudiantes_por_aula;
      ELSE
        estudiantes_marcados := GREATEST(1, floor(estudiantes_por_aula * (0.7 + random() * 0.2))::INTEGER);
      END IF;
      
      FOR estudiante_record IN 
        SELECT id 
        FROM public.estudiantes 
        WHERE aula_id = aula_record.id 
          AND activo = true
          AND created_at <= dia_actual
        ORDER BY random()
        LIMIT estudiantes_marcados
      LOOP
        IF random() < 0.75 THEN
          estado_asistencia := 'presente';
        ELSIF random() < 0.9 THEN
          estado_asistencia := 'falto';
        ELSE
          estado_asistencia := 'permiso';
        END IF;
        
        INSERT INTO public.asistencias (id, fcp_id, estudiante_id, fecha, estado, created_at)
        VALUES (
          uuid_generate_v4(),
          aula_record.fcp_id,
          estudiante_record.id,
          dia_actual,
          estado_asistencia::estado_asistencia,
          NOW() - (CURRENT_DATE - dia_actual) + (random() * INTERVAL '1 hour')
        )
        ON CONFLICT (estudiante_id, fecha) DO NOTHING;
      END LOOP;
      
      dia_actual := dia_actual + INTERVAL '1 day';
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 9. RESUMEN DE DATOS CREADOS
-- ============================================
DO $$
DECLARE
  total_fcps INTEGER;
  total_usuarios INTEGER;
  total_aulas INTEGER;
  total_estudiantes INTEGER;
  total_asistencias INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_fcps FROM public.fcps WHERE razon_social LIKE '%[TEST]%';
  SELECT COUNT(*) INTO total_usuarios FROM public.usuarios WHERE email LIKE '%@test.com';
  SELECT COUNT(*) INTO total_aulas FROM public.aulas WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');
  SELECT COUNT(*) INTO total_estudiantes FROM public.estudiantes WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');
  SELECT COUNT(*) INTO total_asistencias FROM public.asistencias WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATOS DE PRUEBA CREADOS EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FCPs creadas: %', total_fcps;
  RAISE NOTICE 'Usuarios creados: %', total_usuarios;
  RAISE NOTICE 'Aulas creadas: %', total_aulas;
  RAISE NOTICE 'Estudiantes creados: %', total_estudiantes;
  RAISE NOTICE 'Asistencias creadas: %', total_asistencias;
  RAISE NOTICE '========================================';
END $$;

