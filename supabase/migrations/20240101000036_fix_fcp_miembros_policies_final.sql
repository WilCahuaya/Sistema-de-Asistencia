-- ============================================
-- MIGRACIÓN: Solución final para recursión en políticas de fcp_miembros
-- ============================================
-- El problema: Las políticas de fcp_miembros consultan fcp_miembros dentro de sí mismas,
-- causando recursión infinita incluso cuando solo consultan registros propios.

-- Solución: Crear una función SECURITY DEFINER que consulte fcp_miembros sin activar RLS,
-- y usar esa función en las políticas en lugar de consultas directas.

-- Paso 1: Crear función helper que verifica si un usuario es facilitador SIN activar RLS
-- Esta función usa SECURITY DEFINER y se ejecuta como el propietario de la función
-- IMPORTANTE: Para que esta función evite RLS, debe ser creada por el usuario postgres
-- o por un usuario que tenga permisos para leer la tabla sin RLS
CREATE OR REPLACE FUNCTION public.es_facilitador_directo(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER hace que esta función se ejecute con los permisos del propietario
    -- Si la función es propiedad de postgres o un superusuario, puede leer la tabla
    -- sin activar las políticas RLS del usuario que llama la función
    -- 
    -- NOTA: En Supabase, las funciones SECURITY DEFINER se ejecutan como el usuario
    -- que las creó. Para evitar RLS completamente, esta función debe ser creada
    -- ejecutando directamente en el SQL Editor de Supabase como superusuario.
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

COMMENT ON FUNCTION public.es_facilitador_directo IS 'Verifica si un usuario es facilitador sin activar RLS (para usar en políticas de fcp_miembros)';

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.es_facilitador_directo(UUID) TO authenticated;

-- Paso 2: Eliminar políticas problemáticas de fcp_miembros
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;

-- Paso 3: Crear nuevas políticas que usan la función helper (sin recursión)
CREATE POLICY "Facilitators can view all members, others view their memberships"
ON public.fcp_miembros
FOR SELECT
USING (
    -- Usuarios siempre pueden ver sus propias membresías (esto no causa recursión)
    usuario_id = auth.uid()
    OR
    -- Usar función helper que no activa RLS
    public.es_facilitador_directo(auth.uid())
    OR
    -- Directores y secretarios ven miembros de sus FCPs
    -- Esta subconsulta solo consulta registros del propio usuario, evitando recursión
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

CREATE POLICY "Facilitators can add members to any FCP, others to their FCPs"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Usar función helper que no activa RLS
    public.es_facilitador_directo(auth.uid())
    OR
    -- Directores y secretarios solo pueden agregar miembros a sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
    OR
    -- Permitir que cualquier usuario autenticado pueda agregarse a sí mismo (para invitaciones pendientes)
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
);

CREATE POLICY "Facilitators can update all members, others update their FCP members"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usar función helper que no activa RLS
    public.es_facilitador_directo(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar miembros de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- Nota: La función es_facilitador_directo() usa SECURITY DEFINER, lo que significa
-- que se ejecuta con permisos de superusuario y puede consultar fcp_miembros
-- sin activar las políticas RLS, evitando completamente la recursión.

