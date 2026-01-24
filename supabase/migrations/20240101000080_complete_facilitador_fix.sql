-- ============================================
-- MIGRACIÓN COMPLETA: Corrección definitiva de lógica de facilitadores
-- ============================================
-- Esta migración corrige TODAS las inconsistencias relacionadas con facilitadores:
-- 1. Facilitadores solo ven sus FCPs asignadas (no todas)
-- 2. Facilitadores del sistema (fcp_id = null) no se consideran
-- 3. Políticas RLS consistentes en todas las tablas
-- 4. Funciones helper actualizadas

-- ============================================
-- PASO 1: Crear/Actualizar funciones helper
-- ============================================

-- Función para verificar si un usuario es facilitador de una FCP específica
CREATE OR REPLACE FUNCTION public.es_facilitador_de_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER permite leer sin activar RLS
    -- IMPORTANTE: Solo verifica facilitadores con FCP asignada (fcp_id IS NOT NULL)
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id
        AND fcp_id IS NOT NULL  -- Excluir facilitadores del sistema
        AND rol = 'facilitador'
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador_de_fcp IS 'Verifica si un usuario es facilitador de una FCP específica (excluye facilitadores del sistema)';

GRANT EXECUTE ON FUNCTION public.es_facilitador_de_fcp(UUID, UUID) TO authenticated;

-- Función para verificar si un usuario es director o secretario de una FCP
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario de una FCP específica';

GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;

-- ============================================
-- PASO 2: Corregir políticas de fcp_miembros
-- ============================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "fcp_miembros_select_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;

-- Política SELECT: 
-- - Usuarios ven sus propias membresías
-- - Facilitadores ven solo membresías de FCPs donde tienen el rol asignado
-- - Directores/secretarios ven miembros de su FCP
CREATE POLICY "fcp_miembros_select_policy"
ON public.fcp_miembros
FOR SELECT
USING (
    -- Usuarios siempre pueden ver sus propias membresías
    usuario_id = auth.uid()
    OR
    -- Facilitadores ven solo membresías de FCPs donde tienen el rol asignado
    (fcp_id IS NOT NULL AND public.es_facilitador_de_fcp(auth.uid(), fcp_id))
    OR
    -- Directores y secretarios ven miembros de su FCP
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

COMMENT ON POLICY "fcp_miembros_select_policy" ON public.fcp_miembros IS 
'Permite que usuarios vean sus propias membresías, facilitadores vean solo membresías de FCPs asignadas, y directores/secretarios vean miembros de su FCP';

-- Las políticas INSERT y UPDATE ya están correctas, no las tocamos

-- ============================================
-- PASO 3: Corregir políticas de fcps
-- ============================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Facilitators can view all FCPs, others view their FCPs" ON public.fcps;
DROP POLICY IF EXISTS "Facilitators can view only assigned FCPs, others view their FCPs" ON public.fcps;

-- Política SELECT:
-- - Facilitadores ven solo FCPs donde tienen el rol asignado
-- - Usuarios ven FCPs que crearon (para ver FCP recién creada)
-- - Otros usuarios ven FCPs donde son miembros
CREATE POLICY "fcps_select_policy"
ON public.fcps
FOR SELECT
USING (
    -- Facilitadores ven solo FCPs donde tienen el rol asignado
    public.es_facilitador_de_fcp(auth.uid(), id)
    OR
    -- Usuarios ven FCPs que ellos crearon (necesario para ver FCP recién creada)
    (created_by = auth.uid())
    OR
    -- Otros usuarios ven FCPs donde son miembros
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = fcps.id
        AND activo = true
    )
);

COMMENT ON POLICY "fcps_select_policy" ON public.fcps IS 
'Permite que facilitadores vean solo FCPs asignadas, usuarios vean FCPs que crearon, y otros usuarios vean solo FCPs donde son miembros';

-- Asegurar que la política INSERT existe
DROP POLICY IF EXISTS "Authenticated users can create FCPs" ON public.fcps;

CREATE POLICY "fcps_insert_policy"
ON public.fcps
FOR INSERT
TO authenticated
WITH CHECK (true);

COMMENT ON POLICY "fcps_insert_policy" ON public.fcps IS 'Permite que cualquier usuario autenticado cree nuevas FCPs';

-- Política UPDATE: Facilitadores pueden actualizar solo sus FCPs asignadas
DROP POLICY IF EXISTS "Facilitators can update all FCPs, others update their FCPs" ON public.fcps;

CREATE POLICY "fcps_update_policy"
ON public.fcps
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar solo FCPs donde tienen el rol asignado
    public.es_facilitador_de_fcp(auth.uid(), id)
    OR
    -- Directores y secretarios pueden actualizar sus FCPs
    public.es_director_o_secretario_fcp(auth.uid(), id)
    OR
    -- Usuarios pueden actualizar FCPs que crearon
    (created_by = auth.uid())
);

COMMENT ON POLICY "fcps_update_policy" ON public.fcps IS 
'Permite que facilitadores actualicen solo FCPs asignadas, directores/secretarios actualicen sus FCPs, y usuarios actualicen FCPs que crearon';

-- ============================================
-- PASO 4: Limpiar facilitadores del sistema (fcp_id = null)
-- ============================================
-- Opcional: Desactivar facilitadores del sistema existentes
-- Descomentar si quieres desactivarlos automáticamente:
-- UPDATE public.fcp_miembros 
-- SET activo = false 
-- WHERE rol = 'facilitador' 
-- AND fcp_id IS NULL 
-- AND activo = true;

COMMENT ON SCHEMA public IS 'Sistema de gestión de asistencias - Facilitadores solo ven sus FCPs asignadas';

