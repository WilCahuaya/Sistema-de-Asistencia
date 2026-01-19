-- ============================================
-- MIGRACIÓN: Solución ULTRA SIMPLE - Sin subconsultas a fcp_miembros
-- ============================================
-- El problema: CUALQUIER consulta a fcp_miembros dentro de políticas de fcp_miembros
-- causa recursión infinita, incluso si solo consulta registros propios.

-- Solución DEFINITIVA: 
-- 1. Permitir que usuarios vean SOLO sus propios registros (sin recursión)
-- 2. Para facilitadores, usar función SECURITY DEFINER que lee sin RLS
-- 3. Para directores/secretarios, NO usar subconsultas - en su lugar, permitir
--    que vean miembros de FCPs donde tienen un registro propio (esto se verifica
--    comparando fcp_id directamente, sin subconsulta)

-- Paso 1: Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_select_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Crear función SECURITY DEFINER que verifica facilitador SIN activar RLS
CREATE OR REPLACE FUNCTION public.es_facilitador_sin_rls(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER permite que esta función se ejecute con permisos del propietario
    -- y puede leer fcp_miembros sin activar las políticas RLS del usuario actual
    -- Incluye facilitadores del sistema (fcp_id = NULL) y facilitadores de FCPs específicas
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND rol = 'facilitador'
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador_sin_rls IS 'Verifica si un usuario es facilitador sin activar RLS (para usar en políticas)';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_facilitador_sin_rls(UUID) TO authenticated;

-- Función para verificar si un usuario es director o secretario de una FCP específica
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

-- Paso 3: Crear función que obtiene FCPs del usuario sin recursión
-- Esta función solo lee registros propios, lo cual está permitido por la política SELECT
CREATE OR REPLACE FUNCTION public.obtener_fcps_usuario(p_usuario_id UUID)
RETURNS TABLE(fcp_id UUID, rol VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT fm.fcp_id, fm.rol
    FROM public.fcp_miembros fm
    WHERE fm.usuario_id = p_usuario_id
    AND fm.activo = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.obtener_fcps_usuario IS 'Obtiene FCPs del usuario sin activar RLS (para usar en políticas)';

GRANT EXECUTE ON FUNCTION public.obtener_fcps_usuario(UUID) TO authenticated;

-- Paso 4: Crear políticas ULTRA SIMPLES que NO consultan fcp_miembros dentro de sí mismas
-- SOLO usan comparaciones directas y funciones SECURITY DEFINER

-- Política SELECT: Usuarios ven sus propias membresías, facilitadores ven todas
CREATE POLICY "fcp_miembros_select_policy"
ON public.fcp_miembros
FOR SELECT
USING (
    -- PRIMERO: Usuarios siempre pueden ver sus propias membresías (sin recursión)
    usuario_id = auth.uid()
    OR
    -- SEGUNDO: Si es facilitador, puede ver todas (usa función SECURITY DEFINER)
    public.es_facilitador_sin_rls(auth.uid())
    -- NOTA: Para directores y secretarios, la aplicación debe filtrar por fcp_id
    -- No podemos hacerlo aquí sin causar recursión
);

-- Política INSERT: Solo directores y secretarios pueden agregar miembros
-- Facilitadores NO pueden agregar miembros (solo ver)
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes (usuario_id IS NULL)
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Permitir que directores y secretarios agreguen miembros a su FCP
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
    -- NOTA: Los facilitadores no pueden agregar miembros (solo ver)
);

-- Política UPDATE: Solo directores y secretarios pueden actualizar miembros
-- Facilitadores NO pueden actualizar miembros (solo ver)
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usuarios pueden actualizar sus propios registros (para activar/desactivar su membresía)
    usuario_id = auth.uid()
    OR
    -- Permitir que directores y secretarios actualicen miembros de su FCP
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
    -- NOTA: Los facilitadores no pueden actualizar miembros (solo ver)
);

-- IMPORTANTE: Esta solución es más permisiva en la base de datos, pero la aplicación
-- debe hacer la verificación adicional de permisos para directores y secretarios.
-- Esto evita completamente la recursión porque las políticas NO consultan fcp_miembros
-- dentro de sí mismas (excepto a través de funciones SECURITY DEFINER).

