-- ============================================
-- SCRIPT DE CONSULTA: Ver Roles de Usuarios Reales
-- ============================================
-- Este script consulta los roles y FCPs asignados a los usuarios reales
-- para poder crear datos de prueba apropiados según sus roles
-- ============================================

-- Consultar información completa de los usuarios y sus roles
SELECT 
  u.id as usuario_id,
  u.email,
  COALESCE(pu.nombre_completo, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', SPLIT_PART(u.email, '@', 1)) as nombre_completo,
  f.id as fcp_id,
  f.razon_social as fcp_nombre,
  f.numero_identificacion as fcp_codigo,
  fm.rol,
  fm.activo as rol_activo,
  fm.fecha_asignacion,
  COUNT(DISTINCT a.id) as total_aulas,
  COUNT(DISTINCT e.id) as total_estudiantes
FROM auth.users u
LEFT JOIN public.usuarios pu ON u.id = pu.id
LEFT JOIN public.fcp_miembros fm ON u.id = fm.usuario_id AND fm.activo = true
LEFT JOIN public.fcps f ON fm.fcp_id = f.id
LEFT JOIN public.aulas a ON f.id = a.fcp_id AND a.activa = true
LEFT JOIN public.estudiantes e ON a.id = e.aula_id AND e.activo = true
WHERE u.email IN (
  '48217068@continental.edu.pe',
  'i2320674@continental.edu.pe',
  'cahuayaquispew@gmail.com',
  'wcahuayaquispe@gmail.com'
)
GROUP BY u.id, u.email, pu.nombre_completo, u.raw_user_meta_data, f.id, f.razon_social, f.numero_identificacion, fm.rol, fm.activo, fm.fecha_asignacion
ORDER BY u.email, f.razon_social, fm.rol;

-- Resumen por usuario
SELECT 
  u.email,
  COUNT(DISTINCT fm.fcp_id) as total_fcps,
  COUNT(DISTINCT fm.id) as total_roles,
  STRING_AGG(DISTINCT fm.rol, ', ' ORDER BY fm.rol) as roles,
  STRING_AGG(DISTINCT f.razon_social, ' | ' ORDER BY f.razon_social) as fcps_asignadas
FROM auth.users u
LEFT JOIN public.fcp_miembros fm ON u.id = fm.usuario_id AND fm.activo = true
LEFT JOIN public.fcps f ON fm.fcp_id = f.id
WHERE u.email IN (
  '48217068@continental.edu.pe',
  'i2320674@continental.edu.pe',
  'cahuayaquispew@gmail.com',
  'wcahuayaquispe@gmail.com'
)
GROUP BY u.email
ORDER BY u.email;

-- Verificar si los usuarios existen en public.usuarios
SELECT 
  u.id,
  u.email,
  CASE 
    WHEN pu.id IS NOT NULL THEN 'Sí existe en public.usuarios'
    ELSE 'NO existe en public.usuarios'
  END as estado_public_usuarios,
  pu.nombre_completo
FROM auth.users u
LEFT JOIN public.usuarios pu ON u.id = pu.id
WHERE u.email IN (
  '48217068@continental.edu.pe',
  'i2320674@continental.edu.pe',
  'cahuayaquispew@gmail.com',
  'wcahuayaquispe@gmail.com'
)
ORDER BY u.email;

