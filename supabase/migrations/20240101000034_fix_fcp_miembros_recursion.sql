-- ============================================
-- MIGRACIÓN: Corregir recursión infinita en políticas de fcp_miembros
-- ============================================
-- El problema: es_facilitador() consulta fcp_miembros, y las políticas de fcp_miembros
-- usan es_facilitador(), creando recursión infinita.

-- Solución: En las políticas de fcp_miembros, NO usar es_facilitador().
-- En su lugar, verificar directamente si el usuario tiene rol facilitador,
-- pero hacerlo de manera que no cause recursión verificando solo sus propios registros.

-- Paso 1: Eliminar las políticas problemáticas
DROP POLICY IF EXISTS "Facilitators can view all members, others view their memberships" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;

-- Paso 2: Crear nueva política de SELECT que evita recursión
-- La clave es verificar primero si el usuario es facilitador consultando solo sus propios registros
-- (que siempre están permitidos por la condición usuario_id = auth.uid())
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

-- Paso 3: Política de INSERT
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

-- Paso 4: Política de UPDATE
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

-- Nota importante: Estas políticas evitan la recursión porque todas las subconsultas
-- solo verifican registros donde usuario_id = auth.uid(), que siempre están permitidos
-- por la primera condición de la política. Esto rompe el ciclo de recursión.
