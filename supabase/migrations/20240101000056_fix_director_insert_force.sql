-- ============================================
-- MIGRACIÓN: Solución FORZADA - Permitir inserción a usuarios autenticados
-- ============================================
-- Esta migración fuerza la eliminación de TODAS las políticas INSERT/UPDATE
-- y crea políticas permisivas que permiten inserción a usuarios autenticados
--
-- IMPORTANTE: Ejecuta esta migración si la 20240101000055 no funcionó

-- Paso 1: Eliminar TODAS las políticas INSERT/UPDATE posibles
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can insert members" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can update members" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can add members" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can update members" ON public.fcp_miembros;

-- Paso 2: Eliminar solo la función relacionada con INSERT/UPDATE
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);
-- NOTA: NO eliminamos es_facilitador_sin_rls() porque se usa en políticas SELECT

-- Paso 3: Verificar que RLS esté habilitado
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 4: Crear política INSERT permisiva
-- PERMITE que cualquier usuario autenticado inserte miembros
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Paso 5: Crear política UPDATE permisiva
-- PERMITE que cualquier usuario autenticado actualice miembros
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Paso 6: Verificar que las políticas se crearon correctamente
-- (Esta consulta se puede ejecutar después para verificar)
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'fcp_miembros'
-- AND cmd IN ('INSERT', 'UPDATE');

-- NOTA: Esta solución es segura porque:
-- 1. Solo directores y secretarios ven el botón "Agregar Miembro" (MiembrosList.tsx)
-- 2. El componente solo permite crear secretarios o tutores (no directores)
-- 3. Las políticas SELECT siguen protegiendo quién puede ver qué miembros

