-- ============================================
-- MIGRACIÓN: Corregir inserción de miembros para directores
-- ============================================
-- Problema: Los directores no pueden insertar miembros debido a políticas RLS
-- Solución: Asegurar que la función es_director_o_secretario_fcp funcione correctamente
-- y que las políticas permitan la inserción

-- Paso 1: Verificar y recrear la función si es necesario
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER permite que esta función se ejecute con permisos del propietario
    -- y puede leer fcp_miembros sin activar las políticas RLS del usuario actual
    -- IMPORTANTE: Esta función debe poder leer fcp_miembros incluso si el usuario
    -- no tiene permisos directos, por eso usa SECURITY DEFINER
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

-- Otorgar permisos de ejecución explícitamente
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO anon;

-- Paso 2: Eliminar y recrear la política INSERT para asegurar que funcione correctamente
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;

CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes (usuario_id IS NULL)
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Permitir que directores y secretarios agreguen miembros a su FCP
    -- Usar la función SECURITY DEFINER que puede leer fcp_miembros sin activar RLS
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
    -- NOTA: Los facilitadores no pueden agregar miembros (solo ver)
);

-- Paso 3: Verificar que la función tenga los permisos correctos
-- Asegurar que el propietario de la función tenga permisos para leer fcp_miembros
ALTER FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) OWNER TO postgres;

-- Paso 4: Asegurar que la función pueda leer fcp_miembros sin restricciones RLS
-- Esto se hace estableciendo el propietario como postgres y usando SECURITY DEFINER
-- La función ahora debería poder leer fcp_miembros sin problemas

-- Verificación: La función debe poder ejecutarse correctamente
-- Si aún hay problemas, verifica:
-- 1. Que el usuario tenga rol 'director' o 'secretario' en fcp_miembros
-- 2. Que el registro tenga activo = true
-- 3. Que el fcp_id coincida exactamente

