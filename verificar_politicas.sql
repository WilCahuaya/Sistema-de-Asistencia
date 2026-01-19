-- ============================================
-- SCRIPT DE VERIFICACIÓN: Estado de políticas de fcp_miembros
-- ============================================
-- Ejecuta este script en Supabase SQL Editor para verificar el estado actual

-- 1. Verificar si RLS está habilitado
SELECT 
    relname AS tabla,
    relrowsecurity AS rls_habilitado
FROM pg_class
WHERE relname = 'fcp_miembros'
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Listar TODAS las políticas existentes
SELECT 
    policyname,
    cmd,
    qual,
    with_check,
    roles
FROM pg_policies
WHERE tablename = 'fcp_miembros'
ORDER BY cmd, policyname;

-- 3. Verificar si existe la función es_facilitador_sin_rls
SELECT 
    proname AS nombre_funcion,
    prosecdef AS security_definer,
    proconfig AS configuracion
FROM pg_proc
WHERE proname = 'es_facilitador_sin_rls'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 4. Contar políticas por tipo
SELECT 
    cmd,
    COUNT(*) AS cantidad
FROM pg_policies
WHERE tablename = 'fcp_miembros'
GROUP BY cmd
ORDER BY cmd;

-- 5. Verificar permisos de la tabla
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'fcp_miembros'
ORDER BY grantee, privilege_type;

