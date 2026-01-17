-- ============================================
-- MIGRACIÓN: Permitir invitaciones pendientes para usuarios no registrados
-- ============================================

-- Paso 1: Hacer usuario_id nullable y agregar campo email_pendiente
ALTER TABLE public.usuario_ong 
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.usuario_ong 
  ADD COLUMN IF NOT EXISTS email_pendiente TEXT;

-- Paso 2: Crear índice para búsquedas por email pendiente
CREATE INDEX IF NOT EXISTS idx_usuario_ong_email_pendiente 
  ON public.usuario_ong(email_pendiente) 
  WHERE email_pendiente IS NOT NULL;

-- Paso 3: Actualizar el trigger handle_new_user para asociar invitaciones pendientes
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
    FOR v_invitacion_pendiente IN
        SELECT id, ong_id, rol, email_pendiente
        FROM public.usuario_ong
        WHERE email_pendiente = LOWER(NEW.email)
        AND usuario_id IS NULL
    LOOP
        -- Actualizar la invitación pendiente con el usuario_id
        UPDATE public.usuario_ong
        SET 
            usuario_id = NEW.id,
            email_pendiente = NULL, -- Limpiar el email pendiente
            updated_at = NOW()
        WHERE id = v_invitacion_pendiente.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 4: Actualizar la política de INSERT para permitir crear invitaciones pendientes
-- (ya existe la política, pero necesita permitir usuario_id NULL)
-- Las políticas RLS ya deberían funcionar porque verifican el rol del facilitador

-- Paso 5: Actualizar la restricción UNIQUE para permitir múltiples registros pendientes por email
-- Primero eliminar la restricción existente
ALTER TABLE public.usuario_ong 
  DROP CONSTRAINT IF EXISTS usuario_ong_usuario_id_ong_id_key;

-- Crear nueva restricción que permite NULL en usuario_id
CREATE UNIQUE INDEX IF NOT EXISTS usuario_ong_usuario_id_ong_id_key 
  ON public.usuario_ong(usuario_id, ong_id) 
  WHERE usuario_id IS NOT NULL;

-- Permitir múltiples invitaciones pendientes por email (pero solo una por email+ong)
CREATE UNIQUE INDEX IF NOT EXISTS usuario_ong_email_pendiente_ong_id_key 
  ON public.usuario_ong(email_pendiente, ong_id) 
  WHERE email_pendiente IS NOT NULL;

COMMENT ON COLUMN public.usuario_ong.email_pendiente IS 'Email del usuario cuando la invitación está pendiente (usuario_id es NULL)';
COMMENT ON COLUMN public.usuario_ong.usuario_id IS 'ID del usuario (NULL si la invitación está pendiente)';

