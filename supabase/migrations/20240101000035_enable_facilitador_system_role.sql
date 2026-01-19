-- ============================================
-- MIGRACIÓN: Habilitar rol de facilitador del sistema
-- ============================================
-- Esta migración permite que los facilitadores se identifiquen sin necesidad
-- de estar vinculados a una FCP específica.
-- 
-- Para asignar el rol de facilitador a un usuario:
-- INSERT INTO public.fcp_miembros (usuario_id, fcp_id, rol, activo)
-- VALUES ('<user_id>', NULL, 'facilitador', true);
--
-- Los facilitadores con fcp_id = NULL son facilitadores del sistema
-- y pueden crear y gestionar todas las FCPs.

-- Paso 1: Eliminar políticas que dependen de es_facilitador() antes de modificarla
-- Políticas de fcps
DROP POLICY IF EXISTS "Facilitators can view all FCPs, others view their FCPs" ON public.fcps;
DROP POLICY IF EXISTS "Facilitators can update all FCPs, others update their FCPs" ON public.fcps;

-- Políticas de aulas
DROP POLICY IF EXISTS "Facilitators can view all classrooms, others view their FCP classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Facilitators can create classrooms, others create for their FCPs" ON public.aulas;
DROP POLICY IF EXISTS "Facilitators can update all classrooms, others update their FCP classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Facilitators can delete all classrooms, others delete their FCP classrooms" ON public.aulas;

-- Políticas de estudiantes
DROP POLICY IF EXISTS "Facilitators can view all students, others view their FCP students" ON public.estudiantes;
DROP POLICY IF EXISTS "Facilitators can create students, others create for their FCPs" ON public.estudiantes;
DROP POLICY IF EXISTS "Facilitators can update all students, others update their FCP students" ON public.estudiantes;
DROP POLICY IF EXISTS "Facilitators can delete all students, others delete their FCP students" ON public.estudiantes;

-- Políticas de asistencias
DROP POLICY IF EXISTS "Facilitators can view all attendances, others view their FCP attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Facilitators can create attendances, others create for their FCPs" ON public.asistencias;
DROP POLICY IF EXISTS "Facilitators can update all attendances, others update their FCP attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Facilitators can delete all attendances, others delete their FCP attendances" ON public.asistencias;

-- Políticas de tutor_aula
DROP POLICY IF EXISTS "Users can view classroom assignments" ON public.tutor_aula;
DROP POLICY IF EXISTS "Facilitators can manage classroom assignments, others manage for their FCPs" ON public.tutor_aula;

-- Políticas de historial_movimientos
DROP POLICY IF EXISTS "Facilitators can view all movement history, others view their FCP history" ON public.historial_movimientos;
DROP POLICY IF EXISTS "Facilitators can create movement history, others create for their FCPs" ON public.historial_movimientos;

-- Políticas de fcp_miembros (CRÍTICO: estas causan recursión si usan es_facilitador())
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;

-- Paso 2: Ahora sí podemos eliminar y recrear la función
DROP FUNCTION IF EXISTS public.es_facilitador(UUID);

CREATE OR REPLACE FUNCTION public.es_facilitador(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Un usuario es facilitador si tiene rol 'facilitador' en CUALQUIER registro de fcp_miembros
    -- Esto incluye facilitadores del sistema (fcp_id IS NULL) y facilitadores de FCPs específicas
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND rol = 'facilitador'
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador IS 'Verifica si un usuario es facilitador (tiene rol facilitador en alguna FCP o es facilitador del sistema)';

-- Paso 2.5: Recrear políticas de fcp_miembros SIN usar es_facilitador() para evitar recursión
-- Estas políticas verifican directamente si el usuario tiene rol facilitador consultando solo sus propios registros
CREATE POLICY "Facilitators can view all members, others view their memberships"
ON public.fcp_miembros
FOR SELECT
USING (
    -- Usuarios siempre pueden ver sus propias membresías (esto no causa recursión)
    usuario_id = auth.uid()
    OR
    -- Si el usuario tiene al menos un registro propio con rol facilitador, puede ver todos
    -- Esta subconsulta solo consulta registros del propio usuario, evitando recursión
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.rol = 'facilitador'
        AND fm_self.activo = true
        LIMIT 1
    )
    OR
    -- Directores y secretarios ven miembros de sus FCPs
    -- Esta subconsulta también solo consulta registros del propio usuario
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

CREATE POLICY "Facilitators can add members to any FCP, others to their FCPs"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Si el usuario tiene al menos un registro propio con rol facilitador, puede agregar a cualquier FCP
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.rol = 'facilitador'
        AND fm_self.activo = true
        LIMIT 1
    )
    OR
    -- Directores y secretarios solo pueden agregar miembros a sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
    OR
    -- Permitir que cualquier usuario autenticado pueda agregarse a sí mismo (para invitaciones pendientes)
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
);

CREATE POLICY "Facilitators can update all members, others update their FCP members"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Si el usuario tiene al menos un registro propio con rol facilitador, puede actualizar todos
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.rol = 'facilitador'
        AND fm_self.activo = true
        LIMIT 1
    )
    OR
    -- Directores y secretarios solo pueden actualizar miembros de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- Paso 3: Recrear las políticas con la función actualizada
-- Políticas de fcps
CREATE POLICY "Facilitators can view all FCPs, others view their FCPs"
ON public.fcps
FOR SELECT
USING (
    -- Facilitadores ven todas las FCPs activas
    public.es_facilitador(auth.uid())
    OR
    -- Otros usuarios solo ven FCPs donde son miembros
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = fcps.id
        AND activo = true
    )
);

CREATE POLICY "Facilitators can update all FCPs, others update their FCPs"
ON public.fcps
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todas las FCPs
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = fcps.id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Políticas de aulas
CREATE POLICY "Facilitators can view all classrooms, others view their FCP classrooms"
ON public.aulas
FOR SELECT
USING (
    -- Facilitadores ven todas las aulas
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios ven aulas de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    -- Tutores ven aulas asignadas
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        WHERE fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.aula_id = aulas.id
        AND ta.activo = true
    )
);

CREATE POLICY "Facilitators can create classrooms, others create for their FCPs"
ON public.aulas
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden crear aulas en cualquier FCP
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden crear aulas en sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators can update all classrooms, others update their FCP classrooms"
ON public.aulas
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todas las aulas
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar aulas de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators can delete all classrooms, others delete their FCP classrooms"
ON public.aulas
FOR DELETE
USING (
    -- Facilitadores pueden eliminar todas las aulas
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden eliminar aulas de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Políticas de estudiantes
CREATE POLICY "Facilitators can view all students, others view their FCP students"
ON public.estudiantes
FOR SELECT
USING (
    -- Facilitadores ven todos los estudiantes
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios ven estudiantes de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    -- Tutores ven estudiantes de sus aulas
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
);

CREATE POLICY "Facilitators can create students, others create for their FCPs"
ON public.estudiantes
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden crear estudiantes en cualquier FCP
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden crear estudiantes en sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators can update all students, others update their FCP students"
ON public.estudiantes
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todos los estudiantes
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar estudiantes de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators can delete all students, others delete their FCP students"
ON public.estudiantes
FOR DELETE
USING (
    -- Facilitadores pueden eliminar todos los estudiantes
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden eliminar estudiantes de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Políticas de asistencias
CREATE POLICY "Facilitators can view all attendances, others view their FCP attendances"
ON public.asistencias
FOR SELECT
USING (
    -- Facilitadores ven todas las asistencias
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios ven asistencias de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    -- Tutores ven asistencias de sus aulas
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        JOIN public.estudiantes e ON e.aula_id = ta.aula_id
        WHERE fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.activo = true
        AND e.id = asistencias.estudiante_id
    )
);

CREATE POLICY "Facilitators can create attendances, others create for their FCPs"
ON public.asistencias
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden crear asistencias en cualquier FCP
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden crear asistencias en sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators can update all attendances, others update their FCP attendances"
ON public.asistencias
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todas las asistencias
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar asistencias de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators can delete all attendances, others delete their FCP attendances"
ON public.asistencias
FOR DELETE
USING (
    -- Facilitadores pueden eliminar todas las asistencias
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden eliminar asistencias de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Políticas de tutor_aula
CREATE POLICY "Users can view classroom assignments"
ON public.tutor_aula
FOR SELECT
USING (
    -- Facilitadores ven todas las asignaciones
    public.es_facilitador(auth.uid())
    OR
    -- Usuarios ven asignaciones donde son el tutor
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE id = tutor_aula.fcp_miembro_id
        AND usuario_id = auth.uid()
        AND activo = true
    )
    OR
    -- Directores y secretarios ven asignaciones de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = tutor_aula.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

CREATE POLICY "Facilitators can manage classroom assignments, others manage for their FCPs"
ON public.tutor_aula
FOR ALL
USING (
    -- Facilitadores pueden gestionar todas las asignaciones
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden gestionar asignaciones de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = tutor_aula.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Políticas de historial_movimientos
-- Nota: historial_movimientos no tiene fcp_id directamente,
-- se obtiene a través de estudiante_id -> estudiantes -> fcp_id
CREATE POLICY "Facilitators can view all movement history, others view their FCP history"
ON public.historial_movimientos
FOR SELECT
USING (
    -- Facilitadores ven todo el historial
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios ven historial de sus FCPs
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = historial_movimientos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

CREATE POLICY "Facilitators can create movement history, others create for their FCPs"
ON public.historial_movimientos
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden crear historial en cualquier FCP
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden crear historial en sus FCPs
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = historial_movimientos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Paso 2: Modificar la tabla fcp_miembros para permitir fcp_id NULL para facilitadores del sistema
-- (Esto ya debería estar permitido, pero lo verificamos)
ALTER TABLE public.fcp_miembros 
ALTER COLUMN fcp_id DROP NOT NULL;

-- Paso 4: Agregar un comentario explicativo
COMMENT ON COLUMN public.fcp_miembros.fcp_id IS 'ID de la FCP. NULL para facilitadores del sistema que pueden gestionar todas las FCPs.';

-- Paso 5: Actualizar las políticas RLS para permitir que facilitadores del sistema creen FCPs
-- La política de INSERT en fcps ya permite a cualquier usuario autenticado crear FCPs,
-- pero asegurémonos de que los facilitadores puedan hacerlo sin problemas.

-- Paso 6: Crear una función helper para verificar si un usuario tiene algún rol
CREATE OR REPLACE FUNCTION public.tiene_rol_asignado(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verifica si el usuario tiene al menos un rol activo (incluyendo facilitador del sistema)
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.tiene_rol_asignado IS 'Verifica si un usuario tiene al menos un rol asignado (activo)';

-- Paso 7: Crear índice para mejorar el rendimiento de las consultas de facilitadores
CREATE INDEX IF NOT EXISTS idx_fcp_miembros_usuario_rol_activo 
ON public.fcp_miembros(usuario_id, rol, activo) 
WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_fcp_miembros_facilitador_sistema 
ON public.fcp_miembros(usuario_id, fcp_id) 
WHERE rol = 'facilitador' AND fcp_id IS NULL AND activo = true;

-- Paso 8: Instrucciones para asignar rol de facilitador a un usuario
-- Ejemplo de SQL para asignar rol de facilitador:
-- 
-- INSERT INTO public.fcp_miembros (usuario_id, fcp_id, rol, activo, fecha_asignacion)
-- VALUES (
--     '<user_id_aqui>',  -- Reemplazar con el ID del usuario de auth.users
--     NULL,              -- NULL indica facilitador del sistema
--     'facilitador',
--     true,
--     NOW()
-- );
--
-- Para encontrar el user_id de un usuario por email:
-- SELECT id FROM auth.users WHERE email = 'email@ejemplo.com';

