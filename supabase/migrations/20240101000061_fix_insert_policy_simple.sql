-- ============================================
-- MIGRACIÓN: Política INSERT ULTRA SIMPLE
-- ============================================
-- Esta migración crea una política INSERT lo más simple posible

-- Paso 1: Eliminar política INSERT existente
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;

-- Paso 2: Crear política INSERT ULTRA SIMPLE
-- Solo verificar que el usuario está autenticado, nada más
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Paso 3: Verificar que se creó correctamente
DO $$
DECLARE
    policy_exists BOOLEAN;
    policy_with_check TEXT;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fcp_miembros'
        AND cmd = 'INSERT'
        AND policyname = 'fcp_miembros_insert_policy'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        RAISE EXCEPTION 'ERROR: La política INSERT no se creó';
    END IF;
    
    SELECT with_check INTO policy_with_check
    FROM pg_policies
    WHERE tablename = 'fcp_miembros'
    AND cmd = 'INSERT'
    AND policyname = 'fcp_miembros_insert_policy';
    
    IF policy_with_check != 'true' THEN
        RAISE WARNING 'ADVERTENCIA: with_check no es "true", es: %', policy_with_check;
    ELSE
        RAISE NOTICE 'SUCCESS: Política INSERT creada con with_check = true';
    END IF;
END $$;

-- NOTA: Esta es la política más simple posible.
-- Si esto no funciona, el problema está en otro lugar (configuración de Supabase, etc.)

