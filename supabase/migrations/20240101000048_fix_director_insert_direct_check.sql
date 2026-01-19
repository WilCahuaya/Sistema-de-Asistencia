-- ============================================
-- MIGRACIÓN: Verificación directa en política sin función
-- ============================================
-- Problema: Las funciones SECURITY DEFINER todavía aplican RLS al leer
-- Solución: Verificar directamente en la política usando el registro propio del usuario

-- Paso 1: Eliminar políticas que dependen de la función
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Eliminar función (ya no la necesitamos)
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);

-- Paso 3: Crear política INSERT que verifica directamente
-- La clave es que el usuario puede leer su PROPIO registro en fcp_miembros
-- sin problemas de RLS, así que verificamos si tiene rol director/secretario
-- en la misma FCP donde está intentando insertar
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Verificar directamente: el usuario actual debe tener rol director o secretario
    -- en la misma FCP donde está intentando insertar
    -- En WITH CHECK para INSERT, podemos referenciar los campos directamente
    -- usando el nombre de la tabla (fcp_miembros se refiere a la fila que se inserta)
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- Paso 4: Crear política UPDATE similar
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usuarios pueden actualizar sus propios registros
    usuario_id = auth.uid()
    OR
    -- Verificar directamente si el usuario es director/secretario de la FCP
    -- En UPDATE, podemos referenciar la tabla directamente
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- Nota: Esta solución evita la recursión porque:
-- 1. La política INSERT verifica el registro PROPIO del usuario (fm_self.usuario_id = auth.uid())
-- 2. La política SELECT permite que usuarios vean sus propios registros
-- 3. Por lo tanto, la subconsulta puede leer el registro propio sin problemas

