-- ============================================
-- MIGRACIÓN: Limpiar referencias restantes a usuario_ong
-- ============================================
-- Esta migración elimina cualquier referencia restante a la tabla usuario_ong
-- que fue renombrada a fcp_miembros. Esto resuelve el error de OAuth:
-- "duplicate key value violates unique constraint usuario_ong_usuario_id_ong_id_key"

-- Paso 1: Eliminar la tabla usuario_ong si todavía existe
DROP TABLE IF EXISTS public.usuario_ong CASCADE;

-- Paso 2: Eliminar cualquier restricción única restante con el nombre antiguo
DO $$
BEGIN
    -- Intentar eliminar la restricción única si existe en fcp_miembros
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'usuario_ong_usuario_id_ong_id_key'
        AND conrelid = 'public.fcp_miembros'::regclass
    ) THEN
        ALTER TABLE public.fcp_miembros 
        DROP CONSTRAINT IF EXISTS usuario_ong_usuario_id_ong_id_key;
    END IF;
END $$;

-- Paso 3: Verificar y eliminar cualquier trigger que pueda estar insertando en usuario_ong
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar triggers que puedan estar referenciando usuario_ong
    FOR r IN
        SELECT tgname, tgrelid::regclass::text as table_name
        FROM pg_trigger
        WHERE tgname LIKE '%usuario_ong%'
           OR tgname LIKE '%handle_new_user%'
    LOOP
        -- Intentar eliminar el trigger
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s CASCADE', r.tgname, r.table_name);
            RAISE NOTICE 'Eliminado trigger: % en tabla: %', r.tgname, r.table_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'No se pudo eliminar trigger %: %', r.tgname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Paso 4: Forzar la actualización de handle_new_user para usar fcp_miembros
-- Esto asegura que la función esté actualizada incluso si la migración 20240101000039 no se ejecutó correctamente
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
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        nombre_completo = COALESCE(
            EXCLUDED.nombre_completo,
            usuarios.nombre_completo,
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name'
        ),
        avatar_url = COALESCE(
            EXCLUDED.avatar_url,
            usuarios.avatar_url,
            NEW.raw_user_meta_data->>'avatar_url'
        ),
        updated_at = NOW();

    -- Buscar invitaciones pendientes para este email
    -- ACTUALIZADO: Usar fcp_miembros en lugar de usuario_ong
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
'Función trigger que crea automáticamente un registro en public.usuarios cuando un usuario se registra en auth.users. También asocia invitaciones pendientes en fcp_miembros.';

-- Paso 5: Recrear el trigger handle_new_user si no existe
-- Esto asegura que el trigger esté correctamente configurado después de la limpieza
DO $$
BEGIN
    -- Eliminar trigger si existe
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    
    -- Crear trigger nuevamente
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
    
    RAISE NOTICE 'Trigger on_auth_user_created recreado correctamente';
END $$;

COMMENT ON TABLE public.fcp_miembros IS 
'Tabla de relación Usuario-FCP con rol. Renombrada desde usuario_ong en la migración 20240101000031.';

