-- ============================================
-- SCRIPT AUXILIAR: Crear Usuarios de Prueba en auth.users
-- ============================================
-- 
-- IMPORTANTE: Este script crea usuarios en auth.users usando la función
-- de Supabase. Sin embargo, la forma más confiable es crear los usuarios
-- manualmente a través de:
-- 1. Google OAuth (iniciar sesión con cuentas de prueba)
-- 2. Supabase Dashboard > Authentication > Users > Add User
-- 3. Supabase Admin API
--
-- Este script intenta crear usuarios usando funciones de Supabase,
-- pero puede que necesites ajustar los UUIDs después de crearlos.
-- ============================================

-- NOTA: La creación directa de usuarios en auth.users desde SQL
-- requiere permisos especiales. La forma más confiable es:
-- 1. Crear usuarios manualmente en Supabase Dashboard
-- 2. O iniciar sesión con Google OAuth para crear usuarios automáticamente
-- 3. Luego ejecutar el script de datos de prueba

-- Si tienes acceso a la función auth.users, puedes usar esto:
-- Pero normalmente necesitarás crear los usuarios manualmente primero

-- ============================================
-- OPCIÓN 1: Crear usuarios manualmente en Supabase Dashboard
-- ============================================
-- Ve a: Authentication > Users > Add User
-- Crea usuarios con estos emails y contraseñas temporales:
-- 
-- facilitador1@test.com / Test123!
-- facilitador2@test.com / Test123!
-- director1@test.com / Test123!
-- director2@test.com / Test123!
-- director3@test.com / Test123!
-- secretario1@test.com / Test123!
-- secretario2@test.com / Test123!
-- tutor1@test.com / Test123!
-- tutor2@test.com / Test123!
-- tutor3@test.com / Test123!
-- tutor4@test.com / Test123!
-- tutor5@test.com / Test123!
-- multirole@test.com / Test123!
--
-- Después de crear cada usuario, copia su UUID y actualiza el script
-- 20240101000099_datos_prueba.sql con los UUIDs reales.

-- ============================================
-- OPCIÓN 2: Usar Google OAuth (Recomendado)
-- ============================================
-- 1. Crea cuentas de Gmail de prueba o usa cuentas existentes
-- 2. Inicia sesión en la aplicación con esas cuentas
-- 3. Esto creará automáticamente los usuarios en auth.users
-- 4. Luego ejecuta el script de datos de prueba

-- ============================================
-- OPCIÓN 3: Script SQL para obtener UUIDs después de crear usuarios
-- ============================================
-- Después de crear los usuarios (manual o OAuth), ejecuta esto para obtener los UUIDs:

SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE email IN (
  'facilitador1@test.com',
  'facilitador2@test.com',
  'director1@test.com',
  'director2@test.com',
  'director3@test.com',
  'secretario1@test.com',
  'secretario2@test.com',
  'tutor1@test.com',
  'tutor2@test.com',
  'tutor3@test.com',
  'tutor4@test.com',
  'tutor5@test.com',
  'multirole@test.com'
)
ORDER BY email;

-- Copia los UUIDs de la consulta anterior y actualiza el script
-- 20240101000099_datos_prueba.sql reemplazando los UUIDs fijos
-- con los UUIDs reales obtenidos.

-- ============================================
-- NOTA FINAL
-- ============================================
-- Si prefieres usar UUIDs fijos para testing, puedes crear los usuarios
-- manualmente en Supabase Dashboard usando estos UUIDs específicos:
-- 
-- aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (facilitador1@test.com)
-- bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb (facilitador2@test.com)
-- cccccccc-cccc-cccc-cccc-cccccccccccc (director1@test.com)
-- dddddddd-dddd-dddd-dddd-dddddddddddd (director2@test.com)
-- eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee (director3@test.com)
-- ffffffff-ffff-ffff-ffff-ffffffffffff (secretario1@test.com)
-- 11111111-1111-1111-1111-111111111100 (secretario2@test.com)
-- 22222222-2222-2222-2222-222222222200 (tutor1@test.com)
-- 33333333-3333-3333-3333-333333333300 (tutor2@test.com)
-- 44444444-4444-4444-4444-444444444400 (tutor3@test.com)
-- 55555555-5555-5555-5555-555555555500 (tutor4@test.com)
-- 66666666-6666-6666-6666-666666666600 (tutor5@test.com)
-- 77777777-7777-7777-7777-777777777700 (multirole@test.com)
--
-- Sin embargo, Supabase normalmente genera UUIDs aleatorios, así que
-- es mejor crear los usuarios primero y luego actualizar el script con
-- los UUIDs reales.

