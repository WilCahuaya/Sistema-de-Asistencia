-- ============================================
-- MIGRACIÓN: Permitir a directores y secretarios ver datos de usuarios miembros
-- ============================================
-- Esta migración permite a directores y secretarios ver los datos de usuarios
-- que son miembros de su FCP

-- Paso 1: Eliminar políticas SELECT existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.usuarios;
DROP POLICY IF EXISTS "Users can view own profile and members" ON public.usuarios;

-- Paso 2: Crear función SECURITY DEFINER para verificar si un usuario es miembro de la misma FCP
-- que el usuario autenticado (y el usuario autenticado es director/secretario)
CREATE OR REPLACE FUNCTION public.puede_ver_usuario_miembro(
    p_usuario_visto_id UUID,
    p_usuario_autenticado_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar si el usuario autenticado es director o secretario de alguna FCP
    -- donde el usuario visto también es miembro
    RETURN EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_viewer
        JOIN public.fcp_miembros fm_member ON fm_member.fcp_id = fm_viewer.fcp_id
        WHERE fm_viewer.usuario_id = p_usuario_autenticado_id
        AND fm_member.usuario_id = p_usuario_visto_id
        AND fm_viewer.rol IN ('director', 'secretario')
        AND fm_viewer.activo = true
        AND fm_member.activo = true
    );
END;
$$;

-- Paso 3: Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.puede_ver_usuario_miembro(UUID, UUID) TO authenticated;

-- Paso 4: Crear política SELECT que permita:
-- 1. Usuarios ver su propio perfil
-- 2. Facilitadores ver todos los usuarios
-- 3. Directores y secretarios ver usuarios que son miembros de su FCP
CREATE POLICY "Users can view own profile and members"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
    -- Usuarios siempre pueden ver su propio perfil
    auth.uid() = id
    OR
    -- Facilitadores pueden ver todos los usuarios (usa función SECURITY DEFINER si existe)
    (
        SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'es_facilitador_sin_rls')
    )
    AND public.es_facilitador_sin_rls(auth.uid())
    OR
    -- Directores y secretarios pueden ver usuarios que son miembros de su FCP
    -- Usar función SECURITY DEFINER para evitar recursión
    public.puede_ver_usuario_miembro(usuarios.id, auth.uid())
);

-- NOTA: Esta política permite que directores y secretarios vean los datos
-- de usuarios que son miembros de la misma FCP. La subconsulta verifica
-- que ambos usuarios (el que ve y el que es visto) son miembros de la misma FCP.

