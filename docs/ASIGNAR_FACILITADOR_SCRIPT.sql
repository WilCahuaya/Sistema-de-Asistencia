-- ============================================
-- SCRIPT: Asignar Rol de Facilitador
-- ============================================
-- Este script asigna el rol de facilitador a un usuario
-- 
-- INSTRUCCIONES:
-- 1. Reemplaza 'TU_EMAIL@ejemplo.com' con el email del usuario
-- 2. Ejecuta este script completo en el SQL Editor de Supabase
-- 3. El usuario debe cerrar sesión y volver a iniciar sesión

-- Paso 1: Buscar el usuario por email
SELECT 
    id as usuario_id,
    email,
    created_at
FROM auth.users 
WHERE email = 'TU_EMAIL@ejemplo.com';  -- ⚠️ CAMBIAR ESTE EMAIL

-- Paso 2: Asignar el rol de facilitador
-- (Ejecuta esto después de obtener el usuario_id del Paso 1)
-- Reemplaza 'USER_ID_AQUI' con el id obtenido en el Paso 1

INSERT INTO public.fcp_miembros (
    usuario_id, 
    fcp_id, 
    rol, 
    activo, 
    fecha_asignacion
)
VALUES (
    'USER_ID_AQUI',  -- ⚠️ CAMBIAR con el id del Paso 1
    NULL,            -- NULL = facilitador del sistema (puede gestionar todas las FCPs)
    'facilitador',
    true,
    NOW()
)
ON CONFLICT DO NOTHING;  -- Evita errores si ya existe

-- Paso 3: Verificar que se asignó correctamente
SELECT 
    fm.id,
    fm.usuario_id,
    u.email,
    fm.rol,
    fm.fcp_id,
    fm.activo,
    fm.fecha_asignacion
FROM public.fcp_miembros fm
JOIN auth.users u ON u.id = fm.usuario_id
WHERE u.email = 'TU_EMAIL@ejemplo.com'  -- ⚠️ CAMBIAR ESTE EMAIL
AND fm.activo = true
AND fm.rol = 'facilitador';

-- ============================================
-- VERSIÓN TODO EN UNO (más fácil de usar)
-- ============================================
-- Si prefieres ejecutar todo de una vez, usa este script:

DO $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT := 'TU_EMAIL@ejemplo.com';  -- ⚠️ CAMBIAR ESTE EMAIL
BEGIN
    -- Obtener el ID del usuario
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_user_email;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado con email: %', v_user_email;
    END IF;
    
    -- Asignar rol de facilitador
    INSERT INTO public.fcp_miembros (
        usuario_id, 
        fcp_id, 
        rol, 
        activo, 
        fecha_asignacion
    )
    VALUES (
        v_user_id,
        NULL,  -- Facilitador del sistema
        'facilitador',
        true,
        NOW()
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✅ Rol de facilitador asignado correctamente al usuario: %', v_user_email;
END $$;

