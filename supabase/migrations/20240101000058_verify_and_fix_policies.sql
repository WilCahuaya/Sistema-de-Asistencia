-- ============================================
-- MIGRACIÓN: Verificar y corregir políticas de fcp_miembros
-- ============================================
-- Esta migración verifica el estado actual de las políticas y las corrige

-- Paso 1: Verificar estado actual de RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'fcp_miembros'
    ) THEN
        RAISE EXCEPTION 'La tabla fcp_miembros no existe';
    END IF;
    
    RAISE NOTICE 'Tabla fcp_miembros existe';
END $$;

-- Paso 2: Listar todas las políticas actuales (solo para referencia)
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'fcp_miembros';

-- Paso 3: Deshabilitar RLS temporalmente
ALTER TABLE public.fcp_miembros DISABLE ROW LEVEL SECURITY;

-- Paso 4: Eliminar TODAS las políticas existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'fcp_miembros'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.fcp_miembros', r.policyname);
        RAISE NOTICE 'Eliminada política: %', r.policyname;
    END LOOP;
END $$;

-- Paso 5: Rehabilitar RLS
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 6: Verificar que la función es_facilitador_sin_rls existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'es_facilitador_sin_rls'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE 'ADVERTENCIA: La función es_facilitador_sin_rls no existe. Creando política SELECT simple.';
    ELSE
        RAISE NOTICE 'Función es_facilitador_sin_rls existe';
    END IF;
END $$;

-- Paso 7: Crear política SELECT
-- Primero intentar con la función, si no existe, crear política simple
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'es_facilitador_sin_rls'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Crear política usando función SECURITY DEFINER
        EXECUTE '
        CREATE POLICY "fcp_miembros_select_policy"
        ON public.fcp_miembros
        FOR SELECT
        TO authenticated
        USING (
            usuario_id = auth.uid()
            OR
            public.es_facilitador_sin_rls(auth.uid())
        )';
        RAISE NOTICE 'Política SELECT creada con función es_facilitador_sin_rls';
    ELSE
        -- Crear política simple sin función
        EXECUTE '
        CREATE POLICY "fcp_miembros_select_policy"
        ON public.fcp_miembros
        FOR SELECT
        TO authenticated
        USING (true)';
        RAISE NOTICE 'Política SELECT creada sin función (permisiva)';
    END IF;
END $$;

-- Paso 8: Crear política INSERT permisiva
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Paso 9: Crear política UPDATE permisiva
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Paso 10: Verificar que las políticas se crearon correctamente
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'fcp_miembros';
    
    RAISE NOTICE 'Total de políticas creadas: %', policy_count;
    
    IF policy_count < 3 THEN
        RAISE WARNING 'Se esperaban al menos 3 políticas, pero se encontraron %', policy_count;
    END IF;
END $$;

-- Paso 11: Verificar que RLS está habilitado
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'fcp_miembros'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    IF rls_enabled THEN
        RAISE NOTICE 'RLS está habilitado correctamente';
    ELSE
        RAISE WARNING 'RLS NO está habilitado. Habilitando...';
        ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- NOTA: Después de ejecutar esta migración, verifica las políticas con:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'fcp_miembros';

