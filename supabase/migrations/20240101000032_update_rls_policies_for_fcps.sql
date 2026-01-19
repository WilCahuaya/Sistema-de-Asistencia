-- ============================================
-- MIGRACIÓN: Actualizar políticas RLS para usar fcps y fcp_miembros
-- También actualizar para que facilitadores puedan ver todas las FCPs
-- ============================================
-- Esta migración debe ejecutarse DESPUÉS de 20240101000031_rename_ongs_to_fcps.sql

-- Paso 1: Habilitar RLS en las tablas renombradas (por si acaso)
ALTER TABLE public.fcps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcp_miembros ENABLE ROW LEVEL SECURITY;

-- Paso 2: Crear función helper para verificar si un usuario es facilitador (sin necesidad de estar en fcp_miembros)
-- Los facilitadores se identifican por tener el rol 'facilitador' en CUALQUIER fcp_miembros
CREATE OR REPLACE FUNCTION public.es_facilitador(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND rol = 'facilitador'
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador IS 'Verifica si un usuario es facilitador (tiene rol facilitador en alguna FCP)';

-- Paso 3: Eliminar todas las políticas antiguas que usan ongs/usuario_ong/ong_id
-- Políticas de fcps
DROP POLICY IF EXISTS "Users can view their ONGs" ON public.fcps;
DROP POLICY IF EXISTS "Authenticated users can create ONGs" ON public.fcps;
DROP POLICY IF EXISTS "Directors can update their ONGs" ON public.fcps;
DROP POLICY IF EXISTS "Facilitators can update their ONGs" ON public.fcps;

-- Políticas de fcp_miembros
DROP POLICY IF EXISTS "Users can view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can add members to their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can update members of their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update members of their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can view all members of their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Users can add members to ONGs" ON public.fcp_miembros;

-- Políticas de aulas
DROP POLICY IF EXISTS "Users can view classrooms of their ONGs" ON public.aulas;
DROP POLICY IF EXISTS "Facilitators and Secretaries can create classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can create classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Facilitators and Secretaries can update classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can update classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Facilitators and Secretaries can delete classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can delete classrooms" ON public.aulas;

-- Políticas de estudiantes
DROP POLICY IF EXISTS "Users can view students of their ONGs" ON public.estudiantes;
DROP POLICY IF EXISTS "Facilitators and Secretaries can create students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can create students" ON public.estudiantes;
DROP POLICY IF EXISTS "Facilitators and Secretaries can update students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can update students" ON public.estudiantes;
DROP POLICY IF EXISTS "Facilitators and Secretaries can delete students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can delete students" ON public.estudiantes;

-- Políticas de asistencias
DROP POLICY IF EXISTS "Users can view attendances of their ONGs" ON public.asistencias;
DROP POLICY IF EXISTS "Facilitators and Secretaries can create attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can create attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Facilitators and Secretaries can update attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can update attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Facilitators and Secretaries can delete attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can delete attendances" ON public.asistencias;

-- Políticas de historial_movimientos
DROP POLICY IF EXISTS "Facilitators and Secretaries can create movement history" ON public.historial_movimientos;
DROP POLICY IF EXISTS "Directors and Secretaries can create movement history" ON public.historial_movimientos;

-- Políticas de tutor_aula
DROP POLICY IF EXISTS "Users can view their own classroom assignments" ON public.tutor_aula;
DROP POLICY IF EXISTS "Facilitators and Secretaries can manage classroom assignments" ON public.tutor_aula;

-- Paso 4: Crear nuevas políticas para fcps
-- Facilitadores pueden ver TODAS las FCPs (sin necesidad de estar en fcp_miembros)
-- Otros usuarios solo ven FCPs donde son miembros
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

-- Cualquier usuario autenticado puede crear FCPs
CREATE POLICY "Authenticated users can create FCPs"
ON public.fcps
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Facilitadores pueden actualizar cualquier FCP
-- Directores y secretarios solo pueden actualizar sus FCPs
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

-- Paso 5: Crear nuevas políticas para fcp_miembros
-- Facilitadores pueden ver TODOS los miembros de TODAS las FCPs
-- Otros usuarios solo ven sus propias membresías y miembros de sus FCPs
CREATE POLICY "Facilitators can view all members, others view their memberships"
ON public.fcp_miembros
FOR SELECT
USING (
    -- Facilitadores ven todos los miembros
    public.es_facilitador(auth.uid())
    OR
    -- Usuarios ven sus propias membresías
    usuario_id = auth.uid()
    OR
    -- Directores y secretarios ven miembros de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = fcp_miembros.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Facilitadores pueden agregar miembros a cualquier FCP
-- Directores y secretarios solo pueden agregar miembros a sus FCPs
CREATE POLICY "Facilitators can add members to any FCP, others to their FCPs"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Facilitadores pueden agregar miembros a cualquier FCP
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden agregar miembros a sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = fcp_miembros.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
    OR
    -- Caso especial: crear la primera membresía cuando se crea una FCP
    (
        usuario_id = auth.uid()
        AND rol = 'facilitador'
        AND NOT EXISTS (
            SELECT 1 FROM public.fcp_miembros fm
            WHERE fm.fcp_id = fcp_miembros.fcp_id
            AND fm.activo = true
        )
        AND EXISTS (
            SELECT 1 FROM public.fcps f
            WHERE f.id = fcp_miembros.fcp_id
            AND f.created_by = auth.uid()
        )
    )
);

-- Facilitadores pueden actualizar miembros de cualquier FCP
-- Directores y secretarios solo pueden actualizar miembros de sus FCPs
CREATE POLICY "Facilitators can update all members, others update their FCP members"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Facilitadores pueden actualizar todos los miembros
    public.es_facilitador(auth.uid())
    OR
    -- Directores y secretarios solo pueden actualizar miembros de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = fcp_miembros.fcp_id
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Paso 6: Crear nuevas políticas para aulas (usando fcp_id)
-- Facilitadores pueden ver todas las aulas de todas las FCPs
-- Otros usuarios solo ven aulas de sus FCPs
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
        AND ta.fcp_id = aulas.fcp_id
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.aula_id = aulas.id
        AND ta.activo = true
    )
);

-- Directores y secretarios pueden crear aulas en sus FCPs
CREATE POLICY "Directors and Secretaries can create classrooms"
ON public.aulas
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y secretarios pueden actualizar aulas de sus FCPs
CREATE POLICY "Directors and Secretaries can update classrooms"
ON public.aulas
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y secretarios pueden eliminar aulas de sus FCPs
CREATE POLICY "Directors and Secretaries can delete classrooms"
ON public.aulas
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = aulas.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Paso 7: Crear nuevas políticas para estudiantes (usando fcp_id)
-- Similar a aulas
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
    -- Tutores ven estudiantes de sus aulas asignadas
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        WHERE fm.usuario_id = auth.uid()
        AND ta.fcp_id = estudiantes.fcp_id
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.aula_id = estudiantes.aula_id
        AND ta.activo = true
    )
);

CREATE POLICY "Directors and Secretaries can create students"
ON public.estudiantes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Directors and Secretaries can update students"
ON public.estudiantes
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Directors and Secretaries can delete students"
ON public.estudiantes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Paso 8: Crear nuevas políticas para asistencias (usando fcp_id)
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
    -- Tutores ven asistencias de estudiantes de sus aulas asignadas
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        JOIN public.estudiantes e ON e.aula_id = ta.aula_id
        WHERE fm.usuario_id = auth.uid()
        AND ta.fcp_id = asistencias.fcp_id
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.activo = true
        AND e.id = asistencias.estudiante_id
        AND e.activo = true
    )
);

CREATE POLICY "Directors and Secretaries can create attendances"
ON public.asistencias
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Directors and Secretaries can update attendances"
ON public.asistencias
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Directors and Secretaries can delete attendances"
ON public.asistencias
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = asistencias.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Paso 9: Crear nuevas políticas para historial_movimientos
CREATE POLICY "Directors and Secretaries can create movement history"
ON public.historial_movimientos
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.estudiantes e
        JOIN public.fcp_miembros fm ON fm.fcp_id = e.fcp_id
        WHERE e.id = historial_movimientos.estudiante_id
        AND fm.usuario_id = auth.uid()
        AND fm.rol IN ('director', 'secretario')
        AND fm.activo = true
    )
);

-- Paso 10: Crear nuevas políticas para tutor_aula
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
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = tutor_aula.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Directors and Secretaries can manage classroom assignments"
ON public.tutor_aula
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = tutor_aula.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = tutor_aula.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

