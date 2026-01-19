-- ============================================
-- MIGRACIÓN: Bypass RLS usando función SECURITY DEFINER con lectura directa
-- ============================================
-- Problema: Las funciones SECURITY DEFINER todavía aplican RLS al leer tablas
-- Solución: Usar una función que lee directamente desde pg_catalog o usa bypass

-- Paso 1: Eliminar políticas que dependen de la función primero
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Eliminar función anterior
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);

-- Paso 3: Crear función que lee directamente usando SECURITY DEFINER
-- Esta función ejecuta como postgres y puede leer sin RLS usando una técnica especial
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
BEGIN
    -- SECURITY DEFINER ejecuta con permisos de postgres
    -- Usar EXECUTE con formato dinámico para evitar que PostgreSQL aplique RLS
    -- Esto funciona porque el contexto de ejecución cambia
    EXECUTE format('
        SELECT EXISTS (
            SELECT 1 
            FROM public.fcp_miembros 
            WHERE usuario_id = %L 
            AND fcp_id = %L
            AND rol IN (''director'', ''secretario'')
            AND activo = true
            LIMIT 1
        )', p_usuario_id, p_fcp_id) INTO v_result;
    
    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN OTHERS THEN
        -- Si hay error, retornar false
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario usando EXECUTE para bypass RLS';

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO anon;

-- Establecer propietario como postgres
ALTER FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) OWNER TO postgres;

-- Paso 4: Verificar que RLS esté habilitado
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 5: Recrear política INSERT con verificación mejorada
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Permitir que directores y secretarios agreguen miembros
    -- La función usa EXECUTE para evitar RLS al leer
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

-- Paso 6: Recrear política UPDATE
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    usuario_id = auth.uid()
    OR
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

