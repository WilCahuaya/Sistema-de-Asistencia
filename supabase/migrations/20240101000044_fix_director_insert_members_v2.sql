-- ============================================
-- MIGRACIÓN: Corregir inserción de miembros para directores (V2)
-- ============================================
-- Problema: Los directores no pueden insertar miembros debido a políticas RLS
-- Solución: Deshabilitar RLS temporalmente dentro de la función SECURITY DEFINER

-- Paso 1: Eliminar políticas que dependen de la función primero
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Eliminar la función anterior (ahora que no hay dependencias)
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);

-- Paso 2: Crear función que lee directamente sin RLS usando SECURITY DEFINER
-- Esta función usa SECURITY DEFINER y lee directamente desde la tabla sin pasar por RLS
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
BEGIN
    -- SECURITY DEFINER ejecuta esta función con permisos del propietario (postgres)
    -- Esto permite leer fcp_miembros directamente sin pasar por políticas RLS
    -- porque el propietario tiene acceso completo a todas las tablas
    
    -- Usar pg_catalog para verificar directamente sin RLS
    -- La función SECURITY DEFINER ejecuta con permisos de superusuario
    SELECT EXISTS (
        SELECT 1 
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'fcp_miembros'
    ) INTO v_result;
    
    -- Si la tabla existe, leer directamente
    -- Como SECURITY DEFINER ejecuta con permisos de postgres, puede leer sin RLS
    SELECT EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
        LIMIT 1
    ) INTO v_result;
    
    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar false
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario de una FCP específica deshabilitando RLS temporalmente';

-- Otorgar permisos de ejecución explícitamente
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO anon;

-- Establecer el propietario como postgres para asegurar permisos completos
ALTER FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) OWNER TO postgres;

-- Paso 3: Recrear la política INSERT (ya fue eliminada en el Paso 1)
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes (usuario_id IS NULL)
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Permitir que directores y secretarios agreguen miembros a su FCP
    -- La función ahora deshabilita RLS temporalmente para verificar correctamente
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
    -- NOTA: Los facilitadores no pueden agregar miembros (solo ver)
);

-- Paso 4: Recrear la política UPDATE (ya fue eliminada en el Paso 1)
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usuarios pueden actualizar sus propios registros
    usuario_id = auth.uid()
    OR
    -- Permitir que directores y secretarios actualicen miembros de su FCP
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

-- Paso 5: Verificar que la función funciona correctamente
-- Puedes probar con:
-- SELECT public.es_director_o_secretario_fcp('TU_USER_ID', 'TU_FCP_ID');

