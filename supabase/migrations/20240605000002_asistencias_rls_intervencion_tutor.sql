-- Tutores con permiso en una intervención deben registrar/leer asistencias con
-- asistencias.aula_id = id de la intervención (no estudiantes.aula_id regular).

DROP POLICY IF EXISTS "Facilitators can view all attendances, others view their FCP attendances" ON public.asistencias;

CREATE POLICY "Facilitators can view all attendances, others view their FCP attendances"
ON public.asistencias
FOR SELECT
USING (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        WHERE fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.activo = true
        AND asistencias.aula_id = ta.aula_id
        AND (
            EXISTS (
                SELECT 1 FROM public.estudiantes e
                WHERE e.id = asistencias.estudiante_id
                AND e.aula_id = ta.aula_id
            )
            OR EXISTS (
                SELECT 1 FROM public.intervencion_estudiantes ie
                WHERE ie.estudiante_id = asistencias.estudiante_id
                AND ie.aula_id = ta.aula_id
                AND ie.activo = true
            )
        )
    )
);

DROP POLICY IF EXISTS "asistencias_insert" ON public.asistencias;

CREATE POLICY "asistencias_insert"
ON public.asistencias
FOR INSERT
WITH CHECK (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    (
        public.tutor_puede_registrar_asistencia_aula(
            auth.uid(),
            asistencias.fcp_id,
            asistencias.aula_id
        )
        AND (
            EXISTS (
                SELECT 1 FROM public.estudiantes e
                WHERE e.id = asistencias.estudiante_id
                AND e.aula_id = asistencias.aula_id
            )
            OR EXISTS (
                SELECT 1 FROM public.intervencion_estudiantes ie
                WHERE ie.estudiante_id = asistencias.estudiante_id
                AND ie.aula_id = asistencias.aula_id
                AND ie.activo = true
            )
        )
    )
);

DROP POLICY IF EXISTS "asistencias_update" ON public.asistencias;

CREATE POLICY "asistencias_update"
ON public.asistencias
FOR UPDATE
USING (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    (
        public.tutor_puede_registrar_asistencia_aula(
            auth.uid(),
            asistencias.fcp_id,
            asistencias.aula_id
        )
        AND (
            EXISTS (
                SELECT 1 FROM public.estudiantes e
                WHERE e.id = asistencias.estudiante_id
                AND e.aula_id = asistencias.aula_id
            )
            OR EXISTS (
                SELECT 1 FROM public.intervencion_estudiantes ie
                WHERE ie.estudiante_id = asistencias.estudiante_id
                AND ie.aula_id = asistencias.aula_id
                AND ie.activo = true
            )
        )
    )
);

COMMENT ON POLICY "asistencias_insert" ON public.asistencias IS
  'Insert: tutor habilitado por asistencias.aula_id (regular o intervención) y estudiante en ese contexto.';
