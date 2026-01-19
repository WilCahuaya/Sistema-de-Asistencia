-- ============================================
-- MIGRACIÓN: Actualizar función handle_new_user para usar fcp_miembros
-- ============================================
-- El problema: La función handle_new_user() todavía usa usuario_ong (tabla renombrada a fcp_miembros)
-- Esto causa errores cuando un nuevo usuario se autentica con OAuth.

-- Paso 1: Actualizar la función handle_new_user para usar fcp_miembros
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

