-- ============================================
-- MIGRACIÓN: Corregir trigger de sincronización de usuarios
-- ============================================
-- Problema: Los usuarios que se autentican con OAuth no se están creando automáticamente en la tabla usuarios
-- Solución: Verificar y corregir el trigger, y sincronizar usuarios existentes

-- Paso 1: Asegurar que la función handle_new_user esté correctamente definida
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_invitacion_pendiente RECORD;
BEGIN
    -- Crear o actualizar el registro en public.usuarios
    INSERT INTO public.usuarios (id, email, nombre_completo, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name', 
            NEW.raw_user_meta_data->>'name',
            NEW.email
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            ''
        )
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        nombre_completo = COALESCE(
            EXCLUDED.nombre_completo,
            usuarios.nombre_completo,
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            usuarios.email
        ),
        avatar_url = COALESCE(
            EXCLUDED.avatar_url,
            usuarios.avatar_url,
            NEW.raw_user_meta_data->>'avatar_url',
            ''
        ),
        updated_at = NOW();

    -- Buscar invitaciones pendientes para este email
    FOR v_invitacion_pendiente IN
        SELECT id, fcp_id, rol, email_pendiente
        FROM public.fcp_miembros
        WHERE email_pendiente = LOWER(NEW.email)
        AND usuario_id IS NULL
    LOOP
        -- Actualizar la invitación pendiente con el usuario_id
        UPDATE public.fcp_miembros
        SET 
            usuario_id = NEW.id,
            email_pendiente = NULL, -- Limpiar el email pendiente
            updated_at = NOW()
        WHERE id = v_invitacion_pendiente.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 
'Función trigger que crea automáticamente un registro en public.usuarios cuando un usuario se registra o actualiza en auth.users. También asocia invitaciones pendientes en fcp_miembros.';

-- Paso 2: Eliminar y recrear el trigger para asegurar que esté correctamente configurado
DO $$
BEGIN
    -- Eliminar trigger si existe
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    
    -- Crear trigger en INSERT Y UPDATE para capturar tanto nuevos usuarios como actualizaciones
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
    
    RAISE NOTICE 'Trigger on_auth_user_created recreado correctamente (INSERT OR UPDATE)';
END $$;

-- Paso 3: Sincronizar usuarios existentes en auth.users que no están en public.usuarios
-- Esto corrige usuarios que se autenticaron antes de que el trigger funcionara correctamente
INSERT INTO public.usuarios (id, email, nombre_completo, avatar_url, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.email
    ) as nombre_completo,
    COALESCE(
        au.raw_user_meta_data->>'avatar_url',
        ''
    ) as avatar_url,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
LEFT JOIN public.usuarios u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    nombre_completo = COALESCE(
        EXCLUDED.nombre_completo,
        usuarios.nombre_completo,
        EXCLUDED.email
    ),
    avatar_url = COALESCE(
        EXCLUDED.avatar_url,
        usuarios.avatar_url,
        ''
    ),
    updated_at = NOW();

-- Paso 4: Verificar que el trigger esté activo
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
        AND tgrelid = 'auth.users'::regclass
    ) INTO v_trigger_exists;
    
    IF NOT v_trigger_exists THEN
        RAISE EXCEPTION 'El trigger on_auth_user_created no existe. Verifica la configuración.';
    ELSE
        RAISE NOTICE 'Trigger on_auth_user_created verificado y activo';
    END IF;
END $$;

