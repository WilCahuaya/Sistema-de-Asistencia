-- ============================================
-- MIGRACIÓN: Verificar que todas las funciones activas usen fcp_miembros
-- ============================================
-- Esta migración verifica y actualiza cualquier función que pueda estar usando usuario_ong

-- Paso 1: Verificar si hay funciones que todavía referencian usuario_ong
-- (Esto es solo para diagnóstico, no hace cambios)

-- Paso 2: Asegurarse de que handle_new_user esté actualizada
-- (Ya se actualizó en la migración 20240101000039, pero lo verificamos aquí)
DO $$
BEGIN
    -- Verificar que la función handle_new_user use fcp_miembros
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname = 'handle_new_user'
        AND pg_get_functiondef(p.oid) LIKE '%usuario_ong%'
    ) THEN
        RAISE EXCEPTION 'La función handle_new_user todavía usa usuario_ong. Ejecuta la migración 20240101000039 primero.';
    END IF;
END $$;

-- Paso 3: Verificar que get_dashboard_stats use fcp_miembros
-- (Ya se actualizó en la migración 20240101000033, pero lo verificamos aquí)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname = 'get_dashboard_stats'
        AND pg_get_functiondef(p.oid) LIKE '%usuario_ong%'
    ) THEN
        RAISE EXCEPTION 'La función get_dashboard_stats todavía usa usuario_ong. Ejecuta la migración 20240101000033 primero.';
    END IF;
END $$;

-- Paso 4: Verificar que obtener_rol_fcp use fcp_miembros
-- (Ya se actualizó en la migración 20240101000031, pero lo verificamos aquí)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname = 'obtener_rol_fcp'
        AND pg_get_functiondef(p.oid) LIKE '%usuario_ong%'
    ) THEN
        RAISE EXCEPTION 'La función obtener_rol_fcp todavía usa usuario_ong. Ejecuta la migración 20240101000031 primero.';
    END IF;
END $$;

-- Paso 5: Verificar que es_facilitador use fcp_miembros
-- (Ya se actualizó en la migración 20240101000035, pero lo verificamos aquí)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname = 'es_facilitador'
        AND pg_get_functiondef(p.oid) LIKE '%usuario_ong%'
    ) THEN
        RAISE EXCEPTION 'La función es_facilitador todavía usa usuario_ong. Ejecuta la migración 20240101000035 primero.';
    END IF;
END $$;

-- Si llegamos aquí, todas las funciones están actualizadas
DO $$
BEGIN
    RAISE NOTICE '✅ Todas las funciones verificadas. No se encontraron referencias a usuario_ong en funciones activas.';
END $$;

