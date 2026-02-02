-- ============================================
-- MIGRACIÓN: Facilitadores pueden ver datos de usuarios (nombre, email)
-- ============================================
-- Los facilitadores están en la tabla facilitadores, no en fcp_miembros.
-- La política actual usa es_facilitador_sin_rls que busca en fcp_miembros (rol=facilitador).
-- Actualizar la política para incluir es_facilitador() que verifica la tabla facilitadores.
-- Esto permite que los facilitadores vean los nombres de los tutores en la lista de aulas.

DROP POLICY IF EXISTS "Users can view own profile and members" ON public.usuarios;

CREATE POLICY "Users can view own profile and members"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
    -- Usuarios siempre pueden ver su propio perfil
    auth.uid() = id
    OR
    -- Facilitadores pueden ver todos los usuarios (tabla facilitadores O fcp_miembros para compatibilidad)
    (public.es_facilitador(auth.uid()) OR (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'es_facilitador_sin_rls') AND public.es_facilitador_sin_rls(auth.uid())))
    OR
    -- Directores y secretarios pueden ver usuarios que son miembros de su FCP
    public.puede_ver_usuario_miembro(usuarios.id, auth.uid())
);

COMMENT ON POLICY "Users can view own profile and members" ON public.usuarios IS 
'Permite: usuarios ver su perfil; facilitadores (tabla facilitadores o fcp_miembros) ver todos; directores/secretarios ver miembros de su FCP.';
