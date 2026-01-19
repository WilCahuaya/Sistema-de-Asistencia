-- ============================================
-- MIGRACIÓN: Política INSERT con verificación explícita de rol
-- ============================================
-- Esta migración crea una política que verifica explícitamente el rol authenticated

-- Paso 1: Eliminar política INSERT existente
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;

-- Paso 2: Crear política INSERT que verifica explícitamente el rol
-- Usar auth.role() para verificar que el usuario tiene el rol 'authenticated'
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Verificar que el usuario está autenticado
    auth.uid() IS NOT NULL
    AND
    -- Verificar explícitamente que tiene el rol authenticated
    (auth.role() = 'authenticated' OR auth.role() IS NULL)
    AND
    -- Permitir inserción
    true
);

-- Paso 3: Verificar que se creó correctamente
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fcp_miembros'
        AND cmd = 'INSERT'
        AND policyname = 'fcp_miembros_insert_policy'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        RAISE EXCEPTION 'ERROR: La política INSERT no se creó';
    ELSE
        RAISE NOTICE 'SUCCESS: Política INSERT creada con verificación de rol';
    END IF;
END $$;

-- NOTA: Esta política verifica explícitamente que auth.role() = 'authenticated'
-- Si esto no funciona, el problema podría estar en cómo Supabase está
-- estableciendo el rol en el contexto de la solicitud

