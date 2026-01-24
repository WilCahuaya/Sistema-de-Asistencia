-- ============================================
-- MIGRACIÓN: Corregir política SELECT para que facilitadores solo vean sus FCPs asignadas
-- ============================================
-- Problema: Los facilitadores pueden ver todas las FCPs del sistema debido a la política RLS
-- Solución: Modificar la política para que los facilitadores solo vean membresías de FCPs donde tienen el rol asignado

-- Paso 1: Crear función que verifica si un usuario es facilitador de una FCP específica
CREATE OR REPLACE FUNCTION public.es_facilitador_de_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER permite que esta función se ejecute con permisos del propietario
    -- y puede leer fcp_miembros sin activar las políticas RLS del usuario actual
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id
        AND rol = 'facilitador'
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador_de_fcp IS 'Verifica si un usuario es facilitador de una FCP específica sin activar RLS';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_facilitador_de_fcp(UUID, UUID) TO authenticated;

-- Paso 1.5: Asegurar que la función es_director_o_secretario_fcp existe
-- Esta función puede haber sido creada en migraciones anteriores, pero la recreamos para asegurar que existe
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER permite que esta función se ejecute con permisos del propietario
    -- y puede leer fcp_miembros sin activar las políticas RLS del usuario actual
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

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario de una FCP específica sin activar RLS';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;

-- Paso 2: Eliminar la política SELECT existente
DROP POLICY IF EXISTS "fcp_miembros_select_policy" ON public.fcp_miembros;

-- Paso 3: Crear nueva política SELECT que permite:
-- 1. Usuarios ver sus propias membresías
-- 2. Facilitadores ver solo membresías de FCPs donde tienen el rol de facilitador asignado
-- 3. Directores y secretarios ver miembros de su FCP (usando función existente)
CREATE POLICY "fcp_miembros_select_policy"
ON public.fcp_miembros
FOR SELECT
USING (
    -- PRIMERO: Usuarios siempre pueden ver sus propias membresías (sin recursión)
    usuario_id = auth.uid()
    OR
    -- SEGUNDO: Si es facilitador de esta FCP específica, puede ver las membresías de esta FCP
    (fcp_id IS NOT NULL AND public.es_facilitador_de_fcp(auth.uid(), fcp_id))
    OR
    -- TERCERO: Directores y secretarios pueden ver miembros de su FCP
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

COMMENT ON POLICY "fcp_miembros_select_policy" ON public.fcp_miembros IS 
'Permite que usuarios vean sus propias membresías, facilitadores vean solo membresías de FCPs donde tienen el rol asignado, y directores/secretarios vean miembros de su FCP';

-- Paso 4: Asegurar que la política INSERT para fcps existe y permite crear FCPs
-- Cualquier usuario autenticado puede crear FCPs
DROP POLICY IF EXISTS "Authenticated users can create FCPs" ON public.fcps;

CREATE POLICY "Authenticated users can create FCPs"
ON public.fcps
FOR INSERT
TO authenticated
WITH CHECK (true);

COMMENT ON POLICY "Authenticated users can create FCPs" ON public.fcps IS 
'Permite que cualquier usuario autenticado cree nuevas FCPs';

-- Paso 5: Corregir política SELECT para la tabla fcps
-- Eliminar política existente que permite a facilitadores ver todas las FCPs
DROP POLICY IF EXISTS "Facilitators can view all FCPs, others view their FCPs" ON public.fcps;
DROP POLICY IF EXISTS "Facilitators can view only assigned FCPs, others view their FCPs" ON public.fcps;

CREATE POLICY "Facilitators can view only assigned FCPs, others view their FCPs"
ON public.fcps
FOR SELECT
USING (
    -- Facilitadores solo ven FCPs donde tienen el rol de facilitador asignado
    (public.es_facilitador_de_fcp(auth.uid(), id))
    OR
    -- Usuarios pueden ver FCPs que ellos crearon (necesario para ver la FCP recién creada)
    (created_by = auth.uid())
    OR
    -- Otros usuarios solo ven FCPs donde son miembros
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = fcps.id
        AND activo = true
    )
);

COMMENT ON POLICY "Facilitators can view only assigned FCPs, others view their FCPs" ON public.fcps IS 
'Permite que facilitadores vean solo FCPs donde tienen el rol asignado, usuarios vean FCPs que crearon, y otros usuarios vean solo FCPs donde son miembros';

