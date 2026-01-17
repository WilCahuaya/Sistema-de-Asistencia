-- ============================================
-- QUERY DE DIAGNÓSTICO PARA TUTORES
-- Ejecuta estas consultas en el SQL Editor de Supabase
-- ============================================

-- 1. Verificar asignaciones del tutor (reemplaza el email)
SELECT 
    '=== ASIGNACIONES DEL TUTOR ===' as seccion,
    u.email,
    uo.id as usuario_ong_id,
    uo.ong_id,
    uo.rol,
    uo.activo as usuario_ong_activo,
    o.nombre as ong_nombre,
    ta.id as tutor_aula_id,
    ta.aula_id,
    ta.ong_id as tutor_aula_ong_id,
    ta.activo as tutor_aula_activo,
    a.nombre as aula_nombre,
    a.activa as aula_activa,
    (SELECT COUNT(*) FROM public.estudiantes e WHERE e.aula_id = a.id AND e.activo = true) as estudiantes_en_aula
FROM public.usuarios u
JOIN public.usuario_ong uo ON uo.usuario_id = u.id
JOIN public.ongs o ON o.id = uo.ong_id
LEFT JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
LEFT JOIN public.aulas a ON a.id = ta.aula_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND uo.activo = true;

-- 2. Verificar si tutor_aula tiene ong_id (si es NULL, hay problema)
SELECT 
    '=== VERIFICACIÓN DE ONG_ID EN TUTOR_AULA ===' as seccion,
    COUNT(*) as total_asignaciones,
    COUNT(ta.ong_id) as asignaciones_con_ong_id,
    COUNT(*) FILTER (WHERE ta.ong_id IS NULL) as asignaciones_sin_ong_id
FROM public.tutor_aula ta
JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
JOIN public.usuarios u ON u.id = uo.usuario_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND uo.activo = true;

-- 3. Corregir ong_id si falta (EJECUTA SOLO SI LA CONSULTA ANTERIOR MUESTRA asignaciones_sin_ong_id > 0)
UPDATE public.tutor_aula ta
SET ong_id = uo.ong_id
FROM public.usuario_ong uo
WHERE ta.usuario_ong_id = uo.id
AND ta.ong_id IS NULL;

-- 4a. Verificar qué puede ver el tutor según RLS (usa el email del tutor)
-- Esta query muestra: tipo, total, asignadas, puede_ver
SELECT 
    '=== VERIFICACIÓN DE ACCESO SEGÚN RLS ===' as seccion,
    vt.*
FROM public.usuarios u
JOIN public.usuario_ong uo ON uo.usuario_id = u.id
CROSS JOIN LATERAL public.verify_tutor_access(u.id, uo.ong_id) vt
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND uo.activo = true
AND uo.rol = 'tutor';

-- 4b. Verificación simplificada (sin función, solo consultas directas)
SELECT 
    '=== VERIFICACIÓN SIMPLIFICADA ===' as seccion,
    'Aulas totales en ONG' as descripcion,
    COUNT(*) as cantidad
FROM public.aulas a
JOIN public.usuario_ong uo ON uo.ong_id = a.ong_id
JOIN public.usuarios u ON u.id = uo.usuario_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND uo.rol = 'tutor'
AND uo.activo = true
AND a.activa = true

UNION ALL

SELECT 
    '=== VERIFICACIÓN SIMPLIFICADA ===' as seccion,
    'Aulas asignadas al tutor' as descripcion,
    COUNT(*) as cantidad
FROM public.tutor_aula ta
JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
JOIN public.usuarios u ON u.id = uo.usuario_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND uo.rol = 'tutor'
AND uo.activo = true
AND ta.activo = true

UNION ALL

SELECT 
    '=== VERIFICACIÓN SIMPLIFICADA ===' as seccion,
    'Aulas que el tutor puede ver (según RLS)' as descripcion,
    COUNT(*) as cantidad
FROM public.aulas a
WHERE EXISTS (
    SELECT 1 FROM public.usuario_ong uo
    JOIN public.usuarios u ON u.id = uo.usuario_id
    JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
    WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
    AND uo.rol = 'tutor'
    AND uo.activo = true
    AND ta.aula_id = a.id
    AND ta.activo = true
    AND a.ong_id = uo.ong_id
)
AND a.activa = true;

-- 5. Ver todas las aulas que DEBERÍA ver el tutor
SELECT 
    '=== AULAS QUE EL TUTOR DEBERÍA VER ===' as seccion,
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
LEFT JOIN public.tutor_aula ta ON ta.aula_id = a.id
LEFT JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
LEFT JOIN public.usuarios u ON u.id = uo.usuario_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND a.ong_id = (
    SELECT ong_id FROM public.usuario_ong uo2
    JOIN public.usuarios u2 ON u2.id = uo2.usuario_id
    WHERE u2.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
    AND uo2.rol = 'tutor'
    AND uo2.activo = true
    LIMIT 1
)
ORDER BY a.nombre;

-- 6. Ver todos los estudiantes que DEBERÍA ver el tutor
SELECT 
    '=== ESTUDIANTES QUE EL TUTOR DEBERÍA VER ===' as seccion,
    e.id,
    e.nombre_completo,
    e.codigo,
    a.nombre as aula_nombre,
    ta.id as tutor_aula_id,
    ta.activo as asignacion_activa,
    CASE 
        WHEN ta.id IS NOT NULL AND ta.activo = true THEN '✅ ASIGNADA'
        ELSE '❌ NO ASIGNADA'
    END as estado
FROM public.estudiantes e
JOIN public.aulas a ON a.id = e.aula_id
LEFT JOIN public.tutor_aula ta ON ta.aula_id = a.id
LEFT JOIN public.usuario_ong uo ON uo.id = ta.usuario_ong_id
LEFT JOIN public.usuarios u ON u.id = uo.usuario_id
WHERE u.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
AND e.ong_id = (
    SELECT ong_id FROM public.usuario_ong uo2
    JOIN public.usuarios u2 ON u2.id = uo2.usuario_id
    WHERE u2.email = '48217068@continental.edu.pe'  -- ⚠️ REEMPLAZA CON EL EMAIL DEL TUTOR
    AND uo2.rol = 'tutor'
    AND uo2.activo = true
    LIMIT 1
)
AND e.activo = true
ORDER BY a.nombre, e.nombre_completo;

