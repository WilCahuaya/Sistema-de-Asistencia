-- ============================================
-- MIGRACIÓN: Corregir política SELECT para fcp_miembros
-- ============================================
-- Esta migración asegura que directores y secretarios puedan ver miembros de su FCP

-- Paso 1: Eliminar política SELECT existente
DROP POLICY IF EXISTS "fcp_miembros_select_policy" ON public.fcp_miembros;

-- Paso 2: Crear función SECURITY DEFINER para verificar si el usuario es director/secretario de una FCP
-- Esta función evita recursión porque es SECURITY DEFINER y no aplica RLS
CREATE OR REPLACE FUNCTION public.es_director_o_secretario_de_fcp(
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
        AND rol IN ('director', 'secretario')
        AND activo = true
    );
END;
$$;

-- Paso 3: Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.es_director_o_secretario_de_fcp(UUID, UUID) TO authenticated;

-- Paso 4: Crear política SELECT que permita:
-- 1. Usuarios ver sus propias membresías
-- 2. Facilitadores ver todas las membresías
-- 3. Directores y secretarios ver miembros de su FCP (usando función SECURITY DEFINER)
CREATE POLICY "fcp_miembros_select_policy"
ON public.fcp_miembros
FOR SELECT
TO authenticated
USING (
    -- Usuarios siempre pueden ver sus propias membresías (sin recursión)
    usuario_id = auth.uid()
    OR
    -- Facilitadores pueden ver todas (usa función SECURITY DEFINER)
    (
        SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'es_facilitador_sin_rls')
    )
    AND public.es_facilitador_sin_rls(auth.uid())
    OR
    -- Directores y secretarios pueden ver miembros de su FCP (usa función SECURITY DEFINER para evitar recursión)
    public.es_director_o_secretario_de_fcp(auth.uid(), fcp_id)
);

-- NOTA: Esta política permite que:
-- - Los usuarios vean sus propias membresías
-- - Los facilitadores vean todas las membresías
-- - Los directores y secretarios vean miembros de su FCP
-- La subconsulta lee solo el registro propio del usuario, evitando recursión

