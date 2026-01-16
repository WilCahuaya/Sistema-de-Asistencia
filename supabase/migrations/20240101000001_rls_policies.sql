-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Sistema de Gestión de Asistencias para ONG
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_ong ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_movimientos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS: usuarios
-- ============================================

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
ON public.usuarios
FOR SELECT
USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
ON public.usuarios
FOR UPDATE
USING (auth.uid() = id);

-- ============================================
-- POLÍTICAS: ongs
-- ============================================

-- Los usuarios pueden ver ONGs donde son miembros
CREATE POLICY "Users can view their ONGs"
ON public.ongs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = ongs.id
        AND activo = true
    )
);

-- Solo directores pueden insertar ONGs (se puede cambiar según necesidad)
-- Por ahora, cualquier usuario autenticado puede crear ONGs
CREATE POLICY "Authenticated users can create ONGs"
ON public.ongs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Solo directores pueden actualizar ONGs
CREATE POLICY "Directors can update their ONGs"
ON public.ongs
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = ongs.id
        AND rol = 'director'
        AND activo = true
    )
);

-- ============================================
-- POLÍTICAS: usuario_ong
-- ============================================

-- Los usuarios pueden ver sus propias membresías
CREATE POLICY "Users can view their memberships"
ON public.usuario_ong
FOR SELECT
USING (usuario_id = auth.uid() OR ong_id IN (
    SELECT ong_id FROM public.usuario_ong
    WHERE usuario_id = auth.uid()
    AND rol = 'director'
    AND activo = true
));

-- Directores pueden agregar miembros a sus ONGs
CREATE POLICY "Directors can add members to their ONGs"
ON public.usuario_ong
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = usuario_ong.ong_id
        AND rol = 'director'
        AND activo = true
    )
);

-- Directores pueden actualizar miembros de sus ONGs
CREATE POLICY "Directors can update members of their ONGs"
ON public.usuario_ong
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = usuario_ong.ong_id
        AND rol = 'director'
        AND activo = true
    )
);

-- ============================================
-- POLÍTICAS: aulas
-- ============================================

-- Los usuarios pueden ver aulas de sus ONGs
CREATE POLICY "Users can view classrooms of their ONGs"
ON public.aulas
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND activo = true
    )
);

-- Directores y Secretarios pueden crear aulas
CREATE POLICY "Directors and Secretaries can create classrooms"
ON public.aulas
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y Secretarios pueden actualizar aulas
CREATE POLICY "Directors and Secretaries can update classrooms"
ON public.aulas
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y Secretarios pueden eliminar aulas
CREATE POLICY "Directors and Secretaries can delete classrooms"
ON public.aulas
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- ============================================
-- POLÍTICAS: estudiantes
-- ============================================

-- Los usuarios pueden ver estudiantes de sus ONGs
CREATE POLICY "Users can view students of their ONGs"
ON public.estudiantes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND activo = true
    )
);

-- Directores y Secretarios pueden crear estudiantes
CREATE POLICY "Directors and Secretaries can create students"
ON public.estudiantes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y Secretarios pueden actualizar estudiantes
CREATE POLICY "Directors and Secretaries can update students"
ON public.estudiantes
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y Secretarios pueden eliminar estudiantes
CREATE POLICY "Directors and Secretaries can delete students"
ON public.estudiantes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- ============================================
-- POLÍTICAS: asistencias
-- ============================================

-- Todos los usuarios pueden ver asistencias de sus ONGs
CREATE POLICY "Users can view attendances of their ONGs"
ON public.asistencias
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND activo = true
    )
);

-- Directores y Secretarios pueden crear asistencias
CREATE POLICY "Directors and Secretaries can create attendances"
ON public.asistencias
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y Secretarios pueden actualizar asistencias
CREATE POLICY "Directors and Secretaries can update attendances"
ON public.asistencias
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- Directores y Secretarios pueden eliminar asistencias
CREATE POLICY "Directors and Secretaries can delete attendances"
ON public.asistencias
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- ============================================
-- POLÍTICAS: historial_movimientos
-- ============================================

-- Los usuarios pueden ver historial de sus ONGs
CREATE POLICY "Users can view movement history of their ONGs"
ON public.historial_movimientos
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.estudiantes
        JOIN public.usuario_ong ON usuario_ong.ong_id = estudiantes.ong_id
        WHERE estudiantes.id = historial_movimientos.estudiante_id
        AND usuario_ong.usuario_id = auth.uid()
        AND usuario_ong.activo = true
    )
);

-- Directores y Secretarios pueden crear registros de movimiento
CREATE POLICY "Directors and Secretaries can create movement history"
ON public.historial_movimientos
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.estudiantes
        JOIN public.usuario_ong ON usuario_ong.ong_id = estudiantes.ong_id
        WHERE estudiantes.id = historial_movimientos.estudiante_id
        AND usuario_ong.usuario_id = auth.uid()
        AND usuario_ong.rol IN ('director', 'secretario')
        AND usuario_ong.activo = true
    )
);

