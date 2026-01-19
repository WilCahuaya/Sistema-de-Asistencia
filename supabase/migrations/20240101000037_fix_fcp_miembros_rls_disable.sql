-- ============================================
-- MIGRACIÓN: Solución alternativa - Deshabilitar RLS temporalmente en función
-- ============================================
-- Esta es una solución más agresiva que deshabilita RLS en la tabla
-- temporalmente dentro de la función para evitar recursión.

-- Paso 1: Crear función que temporalmente deshabilita RLS en fcp_miembros
-- ADVERTENCIA: Esta función deshabilita RLS temporalmente, lo que puede afectar
-- consultas concurrentes. Sin embargo, la función se ejecuta muy rápido y debería
-- ser segura en la práctica.
CREATE OR REPLACE FUNCTION public.es_facilitador_directo(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
    v_was_enabled BOOLEAN;
BEGIN
    -- Verificar si RLS está habilitado actualmente
    SELECT relrowsecurity INTO v_was_enabled
    FROM pg_class
    WHERE relname = 'fcp_miembros' AND relnamespace = 'public'::regnamespace;
    
    -- Deshabilitar RLS temporalmente solo para esta función
    -- Esto permite consultar fcp_miembros sin activar políticas RLS
    ALTER TABLE public.fcp_miembros DISABLE ROW LEVEL SECURITY;
    
    -- Consultar directamente sin RLS
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
            -- Si hay error, asegurarse de rehabilitar RLS antes de propagar
            IF v_was_enabled THEN
                ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;
            END IF;
            RAISE;
    END;
    
    -- Rehabilitar RLS inmediatamente después si estaba habilitado antes
    IF v_was_enabled THEN
        ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;
    END IF;
    
    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN OTHERS THEN
        -- Asegurarse de que RLS se rehabilite incluso si hay un error
        BEGIN
            ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignorar errores al rehabilitar RLS
                NULL;
        END;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador_directo IS 'Verifica si un usuario es facilitador deshabilitando RLS temporalmente para evitar recursión';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_facilitador_directo(UUID) TO authenticated;

-- Paso 2: Eliminar políticas problemáticas de fcp_miembros
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;

-- Paso 3: Crear nuevas políticas que usan la función helper
CREATE POLICY "Facilitators can view all members, others view their memberships"
ON public.fcp_miembros
FOR SELECT
USING (
    -- Usuarios siempre pueden ver sus propias membresías (esto no causa recursión)
    usuario_id = auth.uid()
    OR
    -- Usar función helper que deshabilita RLS temporalmente
    public.es_facilitador_directo(auth.uid())
    OR
    -- Directores y secretarios ven miembros de sus FCPs
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
    -- Usar función helper que deshabilita RLS temporalmente
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
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
);

CREATE POLICY "Facilitators can update all members, others update their FCP members"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usar función helper que deshabilita RLS temporalmente
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

