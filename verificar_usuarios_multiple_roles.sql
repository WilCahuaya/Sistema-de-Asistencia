-- ============================================
-- VERIFICACIÓN: Usuarios con múltiples roles en la misma FCP
-- ============================================
-- Esta consulta identifica usuarios que tienen más de un rol activo en la misma FCP

-- 1. Usuarios con múltiples roles en la misma FCP
SELECT 
    fm.usuario_id,
    u.email,
    fm.fcp_id,
    f.razon_social AS fcp_nombre,
    COUNT(*) AS cantidad_roles,
    STRING_AGG(fm.rol::TEXT, ', ' ORDER BY fm.rol) AS roles,
    STRING_AGG(fm.id::TEXT, ', ') AS ids_miembros
FROM public.fcp_miembros fm
LEFT JOIN public.usuarios u ON u.id = fm.usuario_id
LEFT JOIN public.fcps f ON f.id = fm.fcp_id
WHERE fm.activo = true
AND fm.usuario_id IS NOT NULL
GROUP BY fm.usuario_id, u.email, fm.fcp_id, f.razon_social
HAVING COUNT(*) > 1
ORDER BY cantidad_roles DESC, u.email;

-- 2. Usuarios con múltiples roles en diferentes FCPs (esto es normal)
SELECT 
    fm.usuario_id,
    u.email,
    COUNT(DISTINCT fm.fcp_id) AS cantidad_fcps,
    COUNT(*) AS total_miembros,
    STRING_AGG(DISTINCT fm.rol::TEXT, ', ' ORDER BY fm.rol) AS roles_distintos
FROM public.fcp_miembros fm
LEFT JOIN public.usuarios u ON u.id = fm.usuario_id
WHERE fm.activo = true
AND fm.usuario_id IS NOT NULL
GROUP BY fm.usuario_id, u.email
HAVING COUNT(*) > 1
ORDER BY cantidad_fcps DESC, u.email;

-- 3. Resumen: Total de usuarios con múltiples roles en la misma FCP
SELECT 
    COUNT(DISTINCT usuario_id) AS usuarios_con_multiple_roles_misma_fcp,
    COUNT(*) AS total_registros_duplicados
FROM (
    SELECT 
        fm.usuario_id,
        fm.fcp_id,
        COUNT(*) AS cantidad
    FROM public.fcp_miembros fm
    WHERE fm.activo = true
    AND fm.usuario_id IS NOT NULL
    GROUP BY fm.usuario_id, fm.fcp_id
    HAVING COUNT(*) > 1
) AS duplicados;

