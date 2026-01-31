-- ============================================
-- SCRIPT: Verificar si un usuario es Facilitador
-- ============================================
-- Opción A: Verificar por email
-- Opción B: Listar todos los facilitadores
--
-- Ejecuta en Supabase → SQL Editor
-- ============================================

-- Opción A: Verificar UN usuario por email (reemplaza el email)
SELECT
  u.id,
  u.email,
  CASE WHEN f.usuario_id IS NOT NULL THEN 'SÍ es Facilitador' ELSE 'NO es Facilitador' END AS rol_facilitador,
  (SELECT COUNT(*) FROM public.fcps WHERE facilitador_id = u.id) AS fcp_count
FROM auth.users u
LEFT JOIN public.facilitadores f ON f.usuario_id = u.id
WHERE u.email = 'email@ejemplo.com';  -- ⚠️ Reemplaza con el email a verificar

-- --------------------------------------------
-- Opción B: Listar TODOS los facilitadores
-- (comenta las líneas de Opción A y descomenta las de abajo)
-- --------------------------------------------
/*
SELECT
  f.usuario_id,
  u.email,
  u.created_at AS usuario_creado,
  (SELECT COUNT(*) FROM public.fcps WHERE facilitador_id = f.usuario_id) AS fcp_count
FROM public.facilitadores f
JOIN auth.users u ON u.id = f.usuario_id
ORDER BY u.email;
*/
