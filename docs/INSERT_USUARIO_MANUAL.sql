-- ============================================
-- INSERCIÓN MANUAL: Sincronizar usuario específico
-- Ejecuta esto si la migración no funcionó
-- ============================================

-- Insertar o actualizar usuario específico desde auth.users
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
        NULLIF(EXCLUDED.nombre_completo, ''),
        NULLIF(usuarios.nombre_completo, ''),
        ''
    ),
    avatar_url = COALESCE(
        EXCLUDED.avatar_url,
        usuarios.avatar_url
    ),
    updated_at = NOW();

-- Verificar que se insertó correctamente
SELECT id, email, nombre_completo, created_at, updated_at
FROM public.usuarios
WHERE id = '1e7fc978-275a-4ff0-aca2-7d6798b1247d';

