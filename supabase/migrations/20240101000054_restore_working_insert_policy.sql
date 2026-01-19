-- ============================================
-- MIGRACIÓN: Restaurar política INSERT que funcionaba antes
-- ============================================
-- Problema: La migración 20240101000042 cambió a usar función que no funciona
-- Solución: Restaurar la política original de 20240101000035 que usaba subconsultas directas

-- Paso 1: Eliminar políticas existentes
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can add members to any FCP, others to their FCPs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Facilitators can update all members, others update their FCP members" ON public.fcp_miembros;

-- Paso 2: Eliminar función problemática
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);

-- Paso 3: Restaurar política INSERT que funcionaba antes (de migración 20240101000035)
-- Esta política usa subconsultas directas que leen solo el registro propio del usuario
-- Esto funciona porque la política SELECT permite leer registros propios
-- IMPORTANTE: En WITH CHECK para INSERT, fcp_miembros.fcp_id se refiere a la fila que se inserta
CREATE POLICY "Facilitators can add members to any FCP, others to their FCPs"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes primero
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
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
    -- Esta subconsulta lee solo el registro propio (fm_self.usuario_id = auth.uid())
    -- Lo cual está permitido por la política SELECT y no causa recursión
    -- fcp_miembros.fcp_id se refiere a la fila que se está insertando
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- Paso 4: Restaurar política UPDATE similar
CREATE POLICY "Facilitators can update all members, others update their FCP members"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usuarios pueden actualizar sus propios registros
    usuario_id = auth.uid()
    OR
    -- Facilitadores pueden actualizar todos
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.rol = 'facilitador'
        AND fm_self.activo = true
        LIMIT 1
    )
    OR
    -- Directores y secretarios pueden actualizar miembros de sus FCPs
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- NOTA: Esta política funcionaba antes porque:
-- 1. La subconsulta lee SOLO el registro propio (fm_self.usuario_id = auth.uid())
-- 2. La política SELECT permite leer registros propios
-- 3. No hay recursión porque no leemos otros registros

