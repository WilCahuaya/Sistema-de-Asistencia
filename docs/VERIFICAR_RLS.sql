-- ============================================
-- VERIFICAR POLÍTICAS RLS PARA TUTORES
-- Ejecuta estas queries para verificar que las políticas RLS estén funcionando
-- ============================================

-- 1. Verificar que RLS esté habilitado
SELECT 
    '=== VERIFICAR RLS HABILITADO ===' as seccion,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('aulas', 'estudiantes', 'tutor_aula')
ORDER BY tablename;

-- 2. Ver todas las políticas RLS para aulas
SELECT 
    '=== POLÍTICAS RLS PARA AULAS ===' as seccion,
    policyname,
    permissive,
    roles,
    cmd as command,
    CASE 
        WHEN qual IS NULL THEN 'Sin condición USING'
        ELSE substring(qual, 1, 100) || '...'
    END as using_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'aulas'
ORDER BY policyname;

-- 3. Ver todas las políticas RLS para estudiantes
SELECT 
    '=== POLÍTICAS RLS PARA ESTUDIANTES ===' as seccion,
    policyname,
    permissive,
    roles,
    cmd as command,
    CASE 
        WHEN qual IS NULL THEN 'Sin condición USING'
        ELSE substring(qual, 1, 100) || '...'
    END as using_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'estudiantes'
ORDER BY policyname;

-- 4. Probar acceso directo como el tutor (reemplaza el email)
-- Esta query simula lo que debería ver el tutor según las políticas RLS
SELECT 
    '=== AULAS VISIBLES PARA TUTOR (SEGÚN RLS) ===' as seccion,
    a.id,
    a.nombre,
    a.ong_id,
    a.activa,
    ta.id as tutor_aula_id,
    ta.activo as asignacion_activa,
    CASE 
        WHEN ta.id IS NOT NULL AND ta.activo = true THEN '✅ ASIGNADA'
        ELSE '❌ NO ASIGNADA'
    END as estado
FROM public.aulas a
WHERE EXISTS (
    -- Condición de las políticas RLS para tutores
    SELECT 1 FROM public.usuario_ong uo
    JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
    JOIN public.usuarios u ON u.id = uo.usuario_id
    WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
    AND uo.usuario_id = (SELECT id FROM public.usuarios WHERE email = '48217068@continental.edu.pe')  -- ⚠️ REEMPLAZA
    AND uo.ong_id = a.ong_id
    AND uo.rol = 'tutor'
    AND uo.activo = true
    AND ta.aula_id = a.id
    AND ta.activo = true
    AND ta.ong_id = a.ong_id  -- Verificar que ong_id coincida
)
AND a.activa = true;

-- 5. Probar COUNT directamente (como lo hace el dashboard)
-- Esta query simula la query del dashboard
SELECT 
    '=== COUNT DE AULAS (COMO DASHBOARD) ===' as seccion,
    COUNT(*) as total_aulas
FROM public.aulas a
WHERE EXISTS (
    SELECT 1 FROM public.usuario_ong uo
    JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
    JOIN public.usuarios u ON u.id = uo.usuario_id
    WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
    AND uo.usuario_id = (SELECT id FROM public.usuarios WHERE email = '48217068@continental.edu.pe')  -- ⚠️ REEMPLAZA
    AND uo.ong_id = a.ong_id
    AND uo.rol = 'tutor'
    AND uo.activo = true
    AND ta.aula_id = a.id
    AND ta.activo = true
    AND ta.ong_id = a.ong_id
)
AND a.activa = true;

-- 6. Verificar que las asignaciones de tutor_aula coincidan con las aulas
SELECT 
    '=== VERIFICAR COINCIDENCIAS ===' as seccion,
    COUNT(*) as total_asignaciones,
    COUNT(DISTINCT ta.aula_id) as aulas_unicas_asignadas,
    COUNT(DISTINCT a.id) as aulas_unicas_en_tabla
FROM public.tutor_aula ta
JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
JOIN public.usuarios u ON u.id = uo.usuario_id
JOIN public.aulas a ON a.id = ta.aula_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND uo.activo = true
AND ta.activo = true
AND a.activa = true
AND ta.ong_id = a.ong_id;  -- Verificar que coincidan los ong_id

