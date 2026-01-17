-- ============================================
-- VERIFICACIÓN: Diagnosticar problema de sincronización de usuario
-- ============================================

-- 1. Verificar si el usuario existe en auth.users
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as nombre_full_name,
    raw_user_meta_data->>'name' as nombre_name,
    created_at,
    updated_at
FROM auth.users
WHERE id = '1e7fc978-275a-4ff0-aca2-7d6798b1247d';

-- 2. Verificar si el usuario existe en public.usuarios
SELECT 
    id,
    email,
    nombre_completo,
    created_at,
    updated_at
FROM public.usuarios
WHERE id = '1e7fc978-275a-4ff0-aca2-7d6798b1247d';

-- 3. Verificar usuario_ong para este usuario
SELECT 
    id,
    usuario_id,
    email_pendiente,
    ong_id,
    rol,
    activo,
    fecha_asignacion
FROM public.usuario_ong
WHERE usuario_id = '1e7fc978-275a-4ff0-aca2-7d6798b1247d';

-- 4. Intentar sincronizar manualmente este usuario específico
INSERT INTO public.usuarios (id, email, nombre_completo, avatar_url, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        ''
    ) as nombre_completo,
    au.raw_user_meta_data->>'avatar_url' as avatar_url,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.id = '1e7fc978-275a-4ff0-aca2-7d6798b1247d'
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    nombre_completo = COALESCE(
        EXCLUDED.nombre_completo,
        usuarios.nombre_completo,
        ''
    ),
    avatar_url = COALESCE(
        EXCLUDED.avatar_url,
        usuarios.avatar_url
    ),
    updated_at = NOW();

-- 5. Verificar nuevamente después de la inserción
SELECT 
    id,
    email,
    nombre_completo,
    created_at,
    updated_at
FROM public.usuarios
WHERE id = '1e7fc978-275a-4ff0-aca2-7d6798b1247d';

-- 6. Verificar la función sync_missing_usuarios
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'sync_missing_usuarios';

-- 7. Ejecutar la función manualmente
SELECT public.sync_missing_usuarios() as usuarios_sincronizados;

