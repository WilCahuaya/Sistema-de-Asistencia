-- ============================================
-- Permitir eliminar períodos para "Quitar de este mes"
-- Director y secretario pueden eliminar períodos (ej: deshacer "agregar solo para este mes")
-- ============================================

CREATE POLICY "estudiante_periodos_delete"
ON public.estudiante_periodos
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = estudiante_periodos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

COMMENT ON POLICY "estudiante_periodos_delete" ON public.estudiante_periodos IS 'Permite a director/secretario eliminar períodos (ej: quitar estudiante de un mes agregado por error).';
