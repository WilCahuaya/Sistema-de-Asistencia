-- ============================================
-- MIGRACIÓN: Actualizar políticas RLS y funciones para usar 'facilitador'
-- ============================================
-- Esta migración debe ejecutarse DESPUÉS de 20240101000013_create_new_rol_type.sql

-- Paso 1: Crear nueva función is_user_facilitador_of_ong
CREATE OR REPLACE FUNCTION public.is_user_facilitador_of_ong(
    p_usuario_id uuid,
    p_ong_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuario_ong
        WHERE usuario_id = p_usuario_id
        AND ong_id = p_ong_id
        AND rol = 'facilitador'
        AND activo = true
    );
$$;

-- Paso 2: Eliminar políticas antiguas que usan 'director'
DROP POLICY IF EXISTS "Directors can update their ONGs" ON public.ongs;
DROP POLICY IF EXISTS "Directors can add members to their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors can update members of their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors and Secretaries can create classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can update classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can delete classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can create students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can update students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can delete students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can create attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can update attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can delete attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can create movement history" ON public.historial_movimientos;
DROP POLICY IF EXISTS "Los directores pueden ver todos los miembros de sus ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Users can view their memberships" ON public.usuario_ong;

-- Paso 3: Crear nuevas políticas con 'facilitador'
CREATE POLICY "Facilitators can update their ONGs"
ON public.ongs
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = ongs.id
        AND rol = 'facilitador'
        AND activo = true
    )
);

CREATE POLICY "Facilitators can add members to their ONGs"
ON public.usuario_ong
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = usuario_ong.ong_id
        AND rol = 'facilitador'
        AND activo = true
    )
);

CREATE POLICY "Facilitators can update members of their ONGs"
ON public.usuario_ong
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = usuario_ong.ong_id
        AND rol = 'facilitador'
        AND activo = true
    )
);

CREATE POLICY "Facilitators can view all members of their ONGs"
ON public.usuario_ong
FOR SELECT
USING (
    public.is_user_facilitador_of_ong(auth.uid(), ong_id)
);

CREATE POLICY "Users can view their own memberships"
ON public.usuario_ong
FOR SELECT
USING (usuario_id = auth.uid());

CREATE POLICY "Facilitators and Secretaries can create classrooms"
ON public.aulas
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can update classrooms"
ON public.aulas
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can delete classrooms"
ON public.aulas
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = aulas.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can create students"
ON public.estudiantes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can update students"
ON public.estudiantes
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can delete students"
ON public.estudiantes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = estudiantes.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can create attendances"
ON public.asistencias
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can update attendances"
ON public.asistencias
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can delete attendances"
ON public.asistencias
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = asistencias.ong_id
        AND rol IN ('facilitador', 'secretario')
        AND activo = true
    )
);

CREATE POLICY "Facilitators and Secretaries can create movement history"
ON public.historial_movimientos
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.estudiantes
        JOIN public.usuario_ong ON usuario_ong.ong_id = estudiantes.ong_id
        WHERE estudiantes.id = historial_movimientos.estudiante_id
        AND usuario_ong.usuario_id = auth.uid()
        AND usuario_ong.rol IN ('facilitador', 'secretario')
        AND usuario_ong.activo = true
    )
);

-- Paso 4: Actualizar la política de usuario_ong INSERT
DROP POLICY IF EXISTS "Users can add members to ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors can add members to their ONGs" ON public.usuario_ong;

CREATE POLICY "Users can add members to ONGs"
ON public.usuario_ong
FOR INSERT
WITH CHECK (
    -- Caso 1: Eres facilitador de la ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        WHERE uo.usuario_id = auth.uid()
        AND uo.ong_id = usuario_ong.ong_id
        AND uo.rol = 'facilitador'
        AND uo.activo = true
    )
    OR
    -- Caso 2: Estás creando la relación y eres el creador de la ONG
    -- y no hay ningún miembro activo en esa ONG todavía
    (
        usuario_id = auth.uid()
        AND rol = 'facilitador'
        AND NOT EXISTS (
            SELECT 1 FROM public.usuario_ong uo
            WHERE uo.ong_id = usuario_ong.ong_id
            AND uo.activo = true
        )
        AND EXISTS (
            SELECT 1 FROM public.ongs o
            WHERE o.id = usuario_ong.ong_id
            AND o.created_by = auth.uid()
        )
    )
);

-- Paso 5: Eliminar función antigua si existe (después de actualizar políticas)
DROP FUNCTION IF EXISTS public.is_user_director_of_ong(uuid, uuid);

COMMENT ON FUNCTION public.is_user_facilitador_of_ong IS 'Verifica si un usuario es facilitador de una ONG';

