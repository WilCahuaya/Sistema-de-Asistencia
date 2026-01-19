-- ============================================
-- MIGRACIÓN: Corregir nombre de restricción única
-- ============================================
-- Esta migración elimina el índice único con nombre antiguo y crea uno nuevo

-- Paso 1: Eliminar índice único con nombre antiguo si existe
DROP INDEX IF EXISTS public.usuario_ong_email_pendiente_ong_id_key;

-- Paso 2: Verificar si existe un índice único en email_pendiente y fcp_id
DO $$
DECLARE
    index_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'fcp_miembros'
        AND indexname LIKE '%email_pendiente%fcp_id%'
    ) INTO index_exists;
    
    IF NOT index_exists THEN
        -- Crear índice único en email_pendiente y fcp_id
        -- Solo si ambos valores no son NULL (permite múltiples NULLs)
        CREATE UNIQUE INDEX IF NOT EXISTS fcp_miembros_email_pendiente_fcp_id_key
        ON public.fcp_miembros (email_pendiente, fcp_id)
        WHERE email_pendiente IS NOT NULL;
        
        RAISE NOTICE 'Índice único creado: fcp_miembros_email_pendiente_fcp_id_key';
    ELSE
        RAISE NOTICE 'Índice único ya existe';
    END IF;
END $$;

-- Paso 3: Verificar también el índice único en usuario_id y fcp_id
DO $$
DECLARE
    index_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'fcp_miembros'
        AND indexname LIKE '%usuario_id%fcp_id%'
    ) INTO index_exists;
    
    IF NOT index_exists THEN
        -- Crear índice único en usuario_id y fcp_id
        -- Solo si usuario_id no es NULL
        CREATE UNIQUE INDEX IF NOT EXISTS fcp_miembros_usuario_id_fcp_id_key
        ON public.fcp_miembros (usuario_id, fcp_id)
        WHERE usuario_id IS NOT NULL;
        
        RAISE NOTICE 'Índice único creado: fcp_miembros_usuario_id_fcp_id_key';
    ELSE
        RAISE NOTICE 'Índice único ya existe';
    END IF;
END $$;

-- NOTA: Estos índices únicos aseguran que:
-- 1. Un email pendiente solo puede estar asociado a una FCP
-- 2. Un usuario solo puede estar asociado a una FCP una vez
-- Pero permiten múltiples registros con NULL (invitaciones pendientes de diferentes emails)

