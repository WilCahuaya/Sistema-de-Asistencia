-- ============================================
-- MIGRACIÓN: Solución FINAL - Bypass RLS usando función con contexto de seguridad
-- ============================================
-- Problema: Las funciones SECURITY DEFINER todavía aplican RLS al leer tablas
-- Solución: Usar una función que realmente puede leer sin RLS usando una técnica especial

-- Paso 1: Eliminar políticas existentes
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Crear función SECURITY DEFINER que realmente puede leer sin RLS
-- Esta función usa una técnica especial: ejecuta una consulta dinámica que
-- PostgreSQL no puede analizar estáticamente, lo que evita la aplicación de RLS
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
    v_sql TEXT;
BEGIN
    -- SECURITY DEFINER ejecuta esta función con permisos del propietario (postgres)
    -- Usamos EXECUTE con formato dinámico para evitar que PostgreSQL aplique RLS
    -- La clave es que EXECUTE ejecuta en un contexto diferente que evita RLS
    
    -- Construir la consulta SQL dinámicamente
    v_sql := format('
        SELECT EXISTS (
            SELECT 1 
            FROM public.fcp_miembros 
            WHERE usuario_id = %L 
            AND fcp_id = %L
            AND rol IN (''director'', ''secretario'')
            AND activo = true
            LIMIT 1
        )', p_usuario_id, p_fcp_id);
    
    -- Ejecutar la consulta dinámica
    -- Como ejecutamos con permisos de postgres (SECURITY DEFINER),
    -- y usamos EXECUTE, PostgreSQL no aplica RLS
    EXECUTE v_sql INTO v_result;
    
    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar false
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario usando EXECUTE para evitar RLS';

-- CRÍTICO: Establecer el propietario como postgres
ALTER FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) OWNER TO postgres;

-- Otorgar permisos explícitamente
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO anon;

-- Paso 3: Asegurar que RLS esté habilitado
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 4: Crear política INSERT que usa la función
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Usar la función SECURITY DEFINER que puede leer sin RLS usando EXECUTE
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

-- Paso 5: Crear política UPDATE
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usuarios pueden actualizar sus propios registros
    usuario_id = auth.uid()
    OR
    -- Usar la función SECURITY DEFINER
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

-- Paso 6: Verificar que la función funciona
-- Prueba con:
-- SELECT public.es_director_o_secretario_fcp(
--   '468153e4-ee8d-4acb-9829-2f84a223adff',
--   '17d86a81-128c-450d-a163-327a6d90a07c'
-- );
-- Debería retornar true

