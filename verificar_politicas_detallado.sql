-- ============================================
-- VERIFICACIÓN DETALLADA: Políticas de fcp_miembros
-- ============================================
-- Ejecuta estas consultas UNA POR UNA y comparte los resultados

-- 1. Verificar si RLS está habilitado
SELECT 
    relname AS tabla,
    CASE WHEN relrowsecurity THEN 'SÍ' ELSE 'NO' END AS rls_habilitado
FROM pg_class
WHERE relname = 'fcp_miembros'
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Listar TODAS las políticas INSERT existentes (MUY IMPORTANTE)
SELECT 
    policyname,
    cmd,
    qual,
    with_check,
    roles
FROM pg_policies
WHERE tablename = 'fcp_miembros'
AND cmd = 'INSERT';

-- 3. Listar TODAS las políticas existentes
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'fcp_miembros'
ORDER BY cmd, policyname;

-- 4. Contar políticas por tipo
SELECT 
    cmd,
    COUNT(*) AS cantidad
FROM pg_policies
WHERE tablename = 'fcp_miembros'
GROUP BY cmd
ORDER BY cmd;

-- 5. Verificar si existe la función es_facilitador_sin_rls
SELECT 
    proname AS nombre_funcion,
    CASE WHEN prosecdef THEN 'SÍ' ELSE 'NO' END AS security_definer
FROM pg_proc
WHERE proname = 'es_facilitador_sin_rls'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 6. Verificar el usuario actual de autenticación (ejecutar como el usuario que tiene el problema)
SELECT 
    auth.uid() AS usuario_actual,
    auth.role() AS rol_actual;

