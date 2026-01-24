-- ============================================
-- MIGRACIÓN: Corregir políticas RLS de tutor_aula para INSERT
-- ============================================
-- El problema: La política actual usa FOR ALL que verifica registros existentes,
-- pero al INSERTAR un nuevo registro, no existe aún, causando error 42501.
-- Solución: Crear políticas separadas para INSERT que verifiquen el fcp_id que se está insertando.

-- Paso 1: Eliminar la política actual que usa FOR ALL
DROP POLICY IF EXISTS "Facilitators can manage classroom assignments, others manage for their FCPs" ON public.tutor_aula;

-- Paso 2: Crear política separada para INSERT
CREATE POLICY "Facilitators can insert all classroom assignments, directors and secretaries insert for their FCPs"
ON public.tutor_aula
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden insertar todas las asignaciones
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden insertar asignaciones de sus FCPs
    -- Verificar el fcp_id que se está insertando (NEW.fcp_id)
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = NEW.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Paso 3: Crear política separada para UPDATE
CREATE POLICY "Facilitators can update all classroom assignments, directors and secretaries update for their FCPs"
ON public.tutor_aula
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todas las asignaciones
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar asignaciones de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = tutor_aula.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
)
WITH CHECK (
    -- Misma verificación para el nuevo valor
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = NEW.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Paso 4: Crear política separada para DELETE
CREATE POLICY "Facilitators can delete all classroom assignments, directors and secretaries delete for their FCPs"
ON public.tutor_aula
FOR DELETE
USING (
    -- Facilitadores pueden eliminar todas las asignaciones
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden eliminar asignaciones de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = tutor_aula.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Comentarios para documentación
COMMENT ON POLICY "Facilitators can insert all classroom assignments, directors and secretaries insert for their FCPs" ON public.tutor_aula IS 
'Permite a facilitadores insertar todas las asignaciones, y a directores/secretarios insertar solo para sus FCPs. Usa NEW.fcp_id para verificar el registro que se está insertando.';

COMMENT ON POLICY "Facilitators can update all classroom assignments, directors and secretaries update for their FCPs" ON public.tutor_aula IS 
'Permite a facilitadores actualizar todas las asignaciones, y a directores/secretarios actualizar solo para sus FCPs.';

COMMENT ON POLICY "Facilitators can delete all classroom assignments, directors and secretaries delete for their FCPs" ON public.tutor_aula IS 
'Permite a facilitadores eliminar todas las asignaciones, y a directores/secretarios eliminar solo para sus FCPs.';

