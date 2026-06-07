-- Tutores asignados a una intervención deben poder ver los estudiantes del roster M2M
-- aunque estudiantes.aula_id siga siendo el salón regular.

DROP POLICY IF EXISTS "Facilitators can view all students, others view their FCP students" ON public.estudiantes;

CREATE POLICY "Facilitators can view all students, others view their FCP students"
ON public.estudiantes
FOR SELECT
USING (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        JOIN public.aulas a ON a.id = ta.aula_id
        WHERE fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.activo = true
        AND a.id = estudiantes.aula_id
    )
    OR
    EXISTS (
        SELECT 1 FROM public.intervencion_estudiantes ie
        JOIN public.tutor_aula ta ON ta.aula_id = ie.aula_id AND ta.activo = true
        JOIN public.fcp_miembros fm ON fm.id = ta.fcp_miembro_id
        WHERE ie.estudiante_id = estudiantes.id
        AND ie.activo = true
        AND fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
    )
);

COMMENT ON POLICY "Facilitators can view all students, others view their FCP students" ON public.estudiantes IS
  'Facilitador: todos. Director/secretario: su FCP. Tutor: salón regular o roster de intervenciones asignadas.';
