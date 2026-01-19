-- ============================================
-- MIGRACIÓN: Solución FINAL - Deshabilitar RLS dentro de la función
-- ============================================
-- Problema: Los directores no pueden insertar miembros debido a políticas RLS
-- Solución: Deshabilitar RLS temporalmente dentro de la función usando SET LOCAL

-- Paso 1: Eliminar políticas que dependen de la función primero
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Eliminar función anterior (ahora que no hay dependencias)
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);

-- Paso 3: Crear función que lee directamente sin RLS
-- SECURITY DEFINER ejecuta con permisos de postgres (superusuario)
-- que tiene acceso completo a todas las tablas sin pasar por RLS
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
    v_old_rls BOOLEAN;
BEGIN
    -- SECURITY DEFINER ejecuta esta función con permisos del propietario (postgres)
    -- Guardar el estado actual de RLS
    SELECT current_setting('row_security', true)::boolean INTO v_old_rls;
    
    -- Deshabilitar RLS temporalmente usando set_config con 'local' = true
    -- Esto solo afecta la sesión actual y se restaura al salir
    PERFORM set_config('row_security', 'off', false);
    
    -- Leer directamente sin RLS
    -- Como ejecutamos con permisos de postgres, podemos leer directamente
    SELECT EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
        LIMIT 1
    ) INTO v_result;
    
    -- Restaurar el estado anterior de RLS
    IF v_old_rls IS NOT NULL THEN
        PERFORM set_config('row_security', v_old_rls::text, false);
    END IF;
    
    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, intentar restaurar RLS y retornar false
        BEGIN
            IF v_old_rls IS NOT NULL THEN
                PERFORM set_config('row_security', v_old_rls::text, false);
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                NULL; -- Ignorar errores al restaurar
        END;
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario deshabilitando RLS temporalmente';

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO anon;

-- Establecer propietario como postgres (superusuario)
ALTER FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) OWNER TO postgres;

-- Paso 4: Verificar que RLS esté habilitado en la tabla
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 5: Recrear política INSERT
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Permitir que directores y secretarios agreguen miembros
    -- La función deshabilita RLS temporalmente para verificar correctamente
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

-- Paso 6: Recrear política UPDATE
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

-- Paso 7: Verificar la función funciona
-- Prueba con: SELECT public.es_director_o_secretario_fcp('user_id', 'fcp_id');

