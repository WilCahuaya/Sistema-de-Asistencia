-- ============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================
-- Corrige la política UPDATE para permitir que los usuarios desactiven sus propios roles.

DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
TO authenticated
USING (
    public.es_facilitador_sin_rls(auth.uid())
    OR
    public.es_director_de_fcp(auth.uid(), fcp_id)
    OR
    (
        public.es_secretario_de_fcp(auth.uid(), fcp_id)
        AND rol = 'tutor'
    )
    OR
    usuario_id = auth.uid()
)
WITH CHECK (
    public.es_facilitador_sin_rls(auth.uid())
    OR
    public.es_director_de_fcp(auth.uid(), fcp_id)
    OR
    (
        public.es_secretario_de_fcp(auth.uid(), fcp_id)
        AND rol = 'tutor'
    )
    OR
    (
        usuario_id = auth.uid()
        AND activo = false
    )
);
