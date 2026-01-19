-- ============================================
-- MIGRACIÓN: Solución EXPLÍCITA para política INSERT
-- ============================================
-- Esta migración elimina TODAS las políticas y crea una nueva muy explícita

-- Paso 1: Deshabilitar RLS temporalmente
ALTER TABLE public.fcp_miembros DISABLE ROW LEVEL SECURITY;

-- Paso 2: Eliminar TODAS las políticas (sin importar el nombre o tipo)
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

-- Paso 3: Rehabilitar RLS
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 4: Crear política SELECT simple
CREATE POLICY "fcp_miembros_select_policy"
ON public.fcp_miembros
FOR SELECT
TO authenticated
USING (
    usuario_id = auth.uid()
    OR
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'es_facilitador_sin_rls'))
    AND public.es_facilitador_sin_rls(auth.uid())
);

-- Paso 5: Crear política INSERT EXPLÍCITA
-- Permitir inserción a usuarios autenticados, incluyendo invitaciones pendientes
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
TO authenticated
WITH CHECK (
    -- Verificar explícitamente que el usuario está autenticado
    auth.uid() IS NOT NULL
    AND
    -- Permitir inserción si:
    -- 1. El usuario está autenticado (ya verificado arriba)
    -- 2. O es una invitación pendiente (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    -- 3. O es una membresía normal (usuario_id IS NOT NULL)
    (
        (usuario_id IS NULL AND email_pendiente IS NOT NULL)
        OR
        (usuario_id IS NOT NULL)
        OR
        true  -- Permitir cualquier inserción si el usuario está autenticado
    )
);

-- Paso 6: Crear política UPDATE
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Paso 7: Verificar que las políticas se crearon
DO $$
DECLARE
    insert_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO insert_count
    FROM pg_policies
    WHERE tablename = 'fcp_miembros'
    AND cmd = 'INSERT';
    
    SELECT COUNT(*) INTO total_count
    FROM pg_policies
    WHERE tablename = 'fcp_miembros';
    
    RAISE NOTICE 'Políticas INSERT creadas: %', insert_count;
    RAISE NOTICE 'Total de políticas: %', total_count;
    
    IF insert_count = 0 THEN
        RAISE EXCEPTION 'ERROR: No se creó la política INSERT';
    END IF;
END $$;

-- NOTA: Esta política es muy explícita y debería funcionar.
-- Si aún falla, el problema podría estar en cómo Supabase está verificando auth.uid()

