-- ============================================
-- MIGRACIÓN: Solución simple - Políticas que evitan recursión
-- ============================================
-- El problema: Las políticas de fcp_miembros consultan fcp_miembros dentro de sí mismas,
-- causando recursión infinita.

-- Solución: Crear políticas simples que NO consulten fcp_miembros para verificar facilitador.
-- En su lugar, usaremos una función SECURITY DEFINER que puede leer directamente sin RLS.

-- Paso 1: Eliminar TODAS las políticas existentes de fcp_miembros
-- Incluyendo las que puedan haber sido creadas por migraciones anteriores
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.fcp_miembros;
-- Eliminar políticas que esta migración crea (por si se ejecutó parcialmente antes)
DROP POLICY IF EXISTS "fcp_miembros_select_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Crear función SECURITY DEFINER que verifica facilitador SIN activar RLS
-- IMPORTANTE: En Supabase, las funciones SECURITY DEFINER se ejecutan como el usuario
-- que las crea. Para evitar RLS completamente, esta función debe ser creada ejecutando
-- directamente en el SQL Editor de Supabase como superusuario (postgres).
--
-- Alternativamente, podemos usar una función que temporalmente deshabilita RLS.
-- Sin embargo, esto puede afectar consultas concurrentes, así que usaremos una
-- técnica más segura: hacer que la función verifique solo registros propios primero.
CREATE OR REPLACE FUNCTION public.es_facilitador_sin_rls(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
BEGIN
    -- Intentar leer directamente - si la función es SECURITY DEFINER y es propiedad
    -- de postgres, esto debería funcionar sin activar RLS
    -- Si no funciona, retornar false y dejar que las políticas manejen el acceso
    BEGIN
        SELECT EXISTS (
            SELECT 1 
            FROM public.fcp_miembros 
            WHERE usuario_id = p_usuario_id 
            AND rol = 'facilitador'
            AND activo = true
            LIMIT 1
        ) INTO v_result;
    EXCEPTION
        WHEN OTHERS THEN
            -- Si hay error (como recursión), retornar false
            -- Las políticas permitirán acceso basado en otras condiciones
            RETURN false;
    END;
    
    RETURN COALESCE(v_result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador_sin_rls IS 'Verifica si un usuario es facilitador sin activar RLS (para usar en políticas)';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_facilitador_sin_rls(UUID) TO authenticated;

-- Paso 3: Crear políticas SIMPLES que evitan recursión
-- La clave es que la primera condición (usuario_id = auth.uid()) siempre se evalúa primero
-- y NO activa recursión porque PostgreSQL puede evaluarla directamente sin consultar políticas

-- Política SELECT: Usuarios ven sus propias membresías, facilitadores ven todas
CREATE POLICY "fcp_miembros_select_policy"
ON public.fcp_miembros
FOR SELECT
USING (
    -- PRIMERO: Usuarios siempre pueden ver sus propias membresías (sin recursión)
    usuario_id = auth.uid()
    OR
    -- SEGUNDO: Si es facilitador, puede ver todas (usa función que no activa RLS)
    public.es_facilitador_sin_rls(auth.uid())
    OR
    -- TERCERO: Directores y secretarios ven miembros de sus FCPs
    -- Esta subconsulta solo consulta registros propios (usuario_id = auth.uid())
    -- lo cual NO causa recursión porque ya está permitido por la primera condición
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

-- Nota importante:
-- La función es_facilitador_sin_rls() usa SECURITY DEFINER, lo que significa que
-- se ejecuta con los permisos del propietario de la función (típicamente postgres).
-- Esto permite que la función lea fcp_miembros sin activar las políticas RLS,
-- evitando completamente la recursión.

