-- ============================================
-- MIGRACIÓN: Restringir que secretarios solo puedan actualizar miembros con rol 'tutor'
-- ============================================
-- Esta migración modifica la política UPDATE de fcp_miembros para que:
-- - Facilitadores pueden actualizar todos los miembros
-- - Directores pueden actualizar todos los miembros de su FCP
-- - Secretarios solo pueden actualizar miembros con rol 'tutor' de su FCP

-- Paso 1: Crear función helper para verificar si el usuario es secretario de una FCP
CREATE OR REPLACE FUNCTION public.es_secretario_de_fcp(
    p_usuario_id UUID,
    p_fcp_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = p_usuario_id
        AND fcp_id = p_fcp_id
        AND rol = 'secretario'
        AND activo = true
    );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_secretario_de_fcp(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.es_secretario_de_fcp(UUID, UUID) IS 
'Verifica si un usuario es secretario de una FCP específica (para usar en políticas RLS)';

-- Paso 2: Crear función helper para verificar si el usuario es director de una FCP
CREATE OR REPLACE FUNCTION public.es_director_de_fcp(
    p_usuario_id UUID,
    p_fcp_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = p_usuario_id
        AND fcp_id = p_fcp_id
        AND rol = 'director'
        AND activo = true
    );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_director_de_fcp(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.es_director_de_fcp(UUID, UUID) IS 
'Verifica si un usuario es director de una FCP específica (para usar en políticas RLS)';

-- Paso 3: Eliminar la política UPDATE existente
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 4: Crear nueva política UPDATE con restricción para secretarios
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
TO authenticated
USING (
    -- Facilitadores pueden actualizar todos los miembros
    public.es_facilitador_sin_rls(auth.uid())
    OR
    -- Directores pueden actualizar todos los miembros de su FCP
    public.es_director_de_fcp(auth.uid(), fcp_id)
    OR
    -- Secretarios solo pueden actualizar miembros con rol 'tutor' de su FCP
    (
        public.es_secretario_de_fcp(auth.uid(), fcp_id)
        AND rol = 'tutor'
    )
)
WITH CHECK (
    -- Facilitadores pueden actualizar todos los miembros
    public.es_facilitador_sin_rls(auth.uid())
    OR
    -- Directores pueden actualizar todos los miembros de su FCP
    public.es_director_de_fcp(auth.uid(), fcp_id)
    OR
    -- Secretarios solo pueden actualizar miembros con rol 'tutor' de su FCP
    (
        public.es_secretario_de_fcp(auth.uid(), fcp_id)
        AND rol = 'tutor'
    )
);

COMMENT ON POLICY "fcp_miembros_update_policy" ON public.fcp_miembros IS 
'Política UPDATE que permite:
- Facilitadores: actualizar todos los miembros
- Directores: actualizar todos los miembros de su FCP
- Secretarios: solo actualizar miembros con rol tutor de su FCP';

