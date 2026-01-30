-- ============================================
-- Corregir política UPDATE para permitir auto-desactivación de roles
-- ============================================
-- Problema: Los usuarios no pueden desactivar sus propios roles (secretario, tutor)
-- porque la política verifica el rol ANTES de la actualización.
-- 
-- Solución: Permitir que los usuarios actualicen sus propios registros
-- (para poder desactivarlos), además de las reglas existentes.

DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

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
    OR
    -- NUEVO: Usuarios pueden actualizar sus propios registros (para desactivarlos)
    usuario_id = auth.uid()
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
    OR
    -- NUEVO: Usuarios pueden actualizar sus propios registros (para desactivarlos)
    -- PERO solo para cambiar el campo 'activo' a false
    (
        usuario_id = auth.uid()
        AND activo = false
    )
);

COMMENT ON POLICY "fcp_miembros_update_policy" ON public.fcp_miembros IS 
'Política UPDATE que permite:
- Facilitadores: actualizar todos los miembros
- Directores: actualizar todos los miembros de su FCP
- Secretarios: solo actualizar miembros con rol tutor de su FCP
- Usuarios: pueden desactivar sus propios registros (activo = false)';
