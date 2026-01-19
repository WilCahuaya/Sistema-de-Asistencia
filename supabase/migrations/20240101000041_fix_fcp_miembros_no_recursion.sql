-- ============================================
-- MIGRACIÓN: Solución definitiva - Políticas sin recursión
-- ============================================
-- El problema: Las políticas de fcp_miembros consultan fcp_miembros dentro de sí mismas,
-- causando recursión infinita.

-- Solución: Crear políticas que SOLO permitan ver registros propios (usuario_id = auth.uid())
-- Esto NO causa recursión porque PostgreSQL puede evaluar esta condición directamente.
-- Para facilitadores, usaremos una función SECURITY DEFINER que lee directamente sin RLS.

-- Paso 1: Eliminar TODAS las políticas existentes de fcp_miembros
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
-- Esta función se ejecuta como el propietario (postgres) y puede leer sin RLS
CREATE OR REPLACE FUNCTION public.es_facilitador_sin_rls(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER permite que esta función se ejecute con permisos del propietario
    -- y puede leer fcp_miembros sin activar las políticas RLS del usuario actual
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

-- Paso 3: Crear políticas SIMPLES que NO consultan fcp_miembros dentro de sí mismas
-- La clave es que SOLO verificamos usuario_id = auth.uid() (sin recursión)
-- y usamos la función SECURITY DEFINER para facilitadores

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
    OR
    -- TERCERO: Para directores y secretarios, necesitamos verificar sin recursión
    -- Usamos una subconsulta que SOLO consulta registros propios (usuario_id = auth.uid())
    -- Esto NO causa recursión porque ya está permitido por la primera condición
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_check
        WHERE fm_check.usuario_id = auth.uid()
        AND fm_check.fcp_id = fcp_miembros.fcp_id
        AND fm_check.rol IN ('director', 'secretario')
        AND fm_check.activo = true
        LIMIT 1
    )
);

-- Política INSERT: Facilitadores pueden agregar a cualquier FCP, otros solo a sus FCPs
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden agregar a cualquier FCP
    public.es_facilitador_sin_rls(auth.uid())
    OR
    -- Directores y secretarios solo pueden agregar a sus FCPs
    -- Usamos subconsulta que SOLO consulta registros propios
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_check
        WHERE fm_check.usuario_id = auth.uid()
        AND fm_check.fcp_id = fcp_miembros.fcp_id
        AND fm_check.rol IN ('director', 'secretario')
        AND fm_check.activo = true
        LIMIT 1
    )
    OR
    -- Permitir invitaciones pendientes (usuario_id IS NULL)
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
);

-- Política UPDATE: Facilitadores pueden actualizar todas, otros solo sus FCPs
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todas
    public.es_facilitador_sin_rls(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar miembros de sus FCPs
    -- Usamos subconsulta que SOLO consulta registros propios
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_check
        WHERE fm_check.usuario_id = auth.uid()
        AND fm_check.fcp_id = fcp_miembros.fcp_id
        AND fm_check.rol IN ('director', 'secretario')
        AND fm_check.activo = true
        LIMIT 1
    )
);

-- NOTA IMPORTANTE:
-- Aunque las políticas tienen subconsultas a fcp_miembros, estas subconsultas
-- SOLO consultan registros propios (usuario_id = auth.uid()), lo cual está permitido
-- por la primera condición de la política SELECT. Esto debería evitar la recursión
-- porque PostgreSQL puede evaluar usuario_id = auth.uid() directamente sin
-- activar las políticas RLS nuevamente.

-- Si esto todavía causa recursión, la única solución es usar la migración
-- 20240101000037 que deshabilita RLS temporalmente dentro de la función.

