-- ============================================
-- Permitir al secretario habilitar el registro de asistencia a tutores
-- por salón. Solo los tutores con puede_registrar_asistencia = true
-- en su asignación tutor_aula podrán registrar asistencias de ese aula.
-- ============================================

-- Paso 1: Agregar columna puede_registrar_asistencia a tutor_aula
ALTER TABLE public.tutor_aula
ADD COLUMN IF NOT EXISTS puede_registrar_asistencia BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tutor_aula.puede_registrar_asistencia IS 'Si true, el secretario/director habilitó a este tutor para registrar asistencias en este aula. Solo secretario y director pueden modificar.';

-- Paso 2: Función para verificar si un tutor puede registrar asistencia en un aula
CREATE OR REPLACE FUNCTION public.tutor_puede_registrar_asistencia_aula(
  p_usuario_id UUID,
  p_fcp_id UUID,
  p_aula_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_aula ta
    JOIN public.fcp_miembros fm ON fm.id = ta.fcp_miembro_id
    WHERE fm.usuario_id = p_usuario_id
      AND ta.fcp_id = p_fcp_id
      AND ta.aula_id = p_aula_id
      AND ta.activo = true
      AND ta.puede_registrar_asistencia = true
      AND fm.activo = true
      AND fm.rol = 'tutor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_puede_registrar_asistencia_aula(UUID, UUID, UUID) TO authenticated;

-- Paso 3: Actualizar políticas de asistencias para permitir tutores habilitados
DROP POLICY IF EXISTS "Facilitators can create attendances, others create for their FCPs" ON public.asistencias;
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
  -- Tutores con permiso de registro para el aula del estudiante
  public.tutor_puede_registrar_asistencia_aula(
    auth.uid(),
    asistencias.fcp_id,
    (SELECT aula_id FROM public.estudiantes WHERE id = asistencias.estudiante_id LIMIT 1)
  )
);

DROP POLICY IF EXISTS "Facilitators can update all attendances, others update their FCP attendances" ON public.asistencias;
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
  public.tutor_puede_registrar_asistencia_aula(
    auth.uid(),
    asistencias.fcp_id,
    (SELECT aula_id FROM public.estudiantes WHERE id = asistencias.estudiante_id LIMIT 1)
  )
);

-- Paso 4: Permitir a secretario y director actualizar puede_registrar_asistencia en tutor_aula
-- (La política UPDATE de tutor_aula ya permite a director/secretario, pero WITH CHECK debe permitir el campo)
-- Verificar si necesitamos política explícita - la actual "Facilitators can update..." permite UPDATE
-- por director/secretario. El nuevo campo puede_registrar_asistencia se incluye en el UPDATE.
-- No necesitamos cambiar la política si ya permite UPDATE a director/secretario para sus FCPs.
