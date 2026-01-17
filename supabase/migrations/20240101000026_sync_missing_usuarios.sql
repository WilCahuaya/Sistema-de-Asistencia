-- ============================================
-- MIGRACIÓN: Sincronizar usuarios que existen en auth.users pero no en public.usuarios
-- Este script crea registros en public.usuarios para usuarios que faltan
-- ============================================

-- Paso 1: Crear función SECURITY DEFINER para sincronizar usuarios
-- Esta función necesita SECURITY DEFINER para acceder a auth.users
CREATE OR REPLACE FUNCTION public.sync_missing_usuarios()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_synced_count INTEGER := 0;
    v_user RECORD;
BEGIN
    -- Iterar sobre todos los usuarios en auth.users que no existen en public.usuarios
    FOR v_user IN
        SELECT 
            au.id,
            au.email,
            COALESCE(
                au.raw_user_meta_data->>'full_name',
                au.raw_user_meta_data->>'name',
                ''
            ) as nombre_completo,
            au.raw_user_meta_data->>'avatar_url' as avatar_url,
            au.created_at
        FROM auth.users au
        LEFT JOIN public.usuarios pu ON pu.id = au.id
        WHERE pu.id IS NULL  -- Solo usuarios que no existen en public.usuarios
    LOOP
        -- Insertar o actualizar el registro en public.usuarios
        INSERT INTO public.usuarios (id, email, nombre_completo, avatar_url, created_at, updated_at)
        VALUES (
            v_user.id,
            v_user.email,
            v_user.nombre_completo,
            v_user.avatar_url,
            v_user.created_at,
            NOW()
        )
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
        
        v_synced_count := v_synced_count + 1;
    END LOOP;
    
    RETURN v_synced_count;
END;
$$;

-- Paso 2: Ejecutar la función para sincronizar usuarios faltantes
SELECT public.sync_missing_usuarios() as usuarios_sincronizados;

COMMENT ON FUNCTION public.handle_new_user() IS 
'Función trigger que crea automáticamente un registro en public.usuarios cuando un usuario se registra en auth.users. También asocia invitaciones pendientes en usuario_ong.';

-- Paso 2: Verificar que el trigger esté activo
-- (El trigger ya debería estar creado por las migraciones anteriores)

-- Mostrar estadísticas de sincronización
DO $$
DECLARE
    v_total_auth_users INTEGER;
    v_total_public_usuarios INTEGER;
    v_missing_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_auth_users FROM auth.users;
    SELECT COUNT(*) INTO v_total_public_usuarios FROM public.usuarios;
    SELECT COUNT(*) INTO v_missing_users 
    FROM auth.users au
    LEFT JOIN public.usuarios pu ON pu.id = au.id
    WHERE pu.id IS NULL;
    
    RAISE NOTICE 'Total usuarios en auth.users: %', v_total_auth_users;
    RAISE NOTICE 'Total usuarios en public.usuarios: %', v_total_public_usuarios;
    RAISE NOTICE 'Usuarios faltantes (antes de sincronización): %', v_missing_users;
END $$;

