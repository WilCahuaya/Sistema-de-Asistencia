-- ============================================
-- MIGRACIÓN: Solución FUNCIONAL - Función que realmente puede leer sin RLS
-- ============================================
-- Problema: Las subconsultas en políticas todavía aplican RLS
-- Solución: Usar una función SECURITY DEFINER que lee directamente sin RLS

-- Paso 1: Eliminar políticas que dependen de la función
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Crear función SECURITY DEFINER que lee sin RLS usando pg_catalog
-- Esta función ejecuta como postgres y puede leer directamente sin pasar por RLS
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
    v_sql TEXT;
BEGIN
    -- SECURITY DEFINER ejecuta esta función con permisos del propietario (postgres)
    -- Usamos EXECUTE con formato dinámico para evitar que PostgreSQL aplique RLS
    -- Esto funciona porque el contexto de ejecución cambia cuando usamos EXECUTE
    
    -- Construir y ejecutar la consulta dinámicamente
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
    
    EXECUTE v_sql INTO v_result;
    
    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar false
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_o_secretario_fcp IS 'Verifica si un usuario es director o secretario usando SECURITY DEFINER para leer sin RLS';

-- Otorgar permisos explícitamente
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) TO anon;

-- CRÍTICO: Establecer el propietario como postgres (superusuario)
-- Esto es esencial para que la función pueda leer sin RLS
ALTER FUNCTION public.es_director_o_secretario_fcp(UUID, UUID) OWNER TO postgres;

-- Paso 3: Asegurar que RLS esté habilitado
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 4: Verificar que la política SELECT permita leer registros propios
-- Esto es necesario para que las subconsultas funcionen si las usamos
-- (Aunque no las usaremos en esta solución, es bueno tenerlo)

-- Paso 5: Crear política INSERT que usa la función SECURITY DEFINER
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Usar la función SECURITY DEFINER que puede leer sin RLS
    -- La función ejecuta como postgres y puede leer directamente
    public.es_director_o_secretario_fcp(auth.uid(), fcp_id)
);

-- Paso 6: Crear política UPDATE
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

-- Paso 7: Verificar que la función funciona
-- Prueba manual: SELECT public.es_director_o_secretario_fcp('468153e4-ee8d-4acb-9829-2f84a223adff', '17d86a81-128c-450d-a163-327a6d90a07c');
-- Debería retornar true si el usuario es director de esa FCP

