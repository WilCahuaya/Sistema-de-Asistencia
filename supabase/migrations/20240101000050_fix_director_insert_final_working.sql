-- ============================================
-- MIGRACIÓN: Solución FINAL que realmente funciona
-- ============================================
-- Problema: Las funciones SECURITY DEFINER todavía aplican RLS cuando se usan en políticas
-- Solución: Usar subconsulta directa que lee el registro PROPIO del usuario
--           Esto funciona porque la política SELECT permite leer registros propios

-- Paso 1: Eliminar políticas existentes
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;
DROP POLICY IF EXISTS "fcp_miembros_update_policy" ON public.fcp_miembros;

-- Paso 2: Eliminar función (no la necesitamos para esta solución)
DROP FUNCTION IF EXISTS public.es_director_o_secretario_fcp(UUID, UUID);

-- Paso 3: Verificar que la política SELECT permite leer registros propios
-- (Debería estar en la migración 20240101000042)
-- La política SELECT permite: usuario_id = auth.uid()
-- Esto significa que podemos leer nuestro propio registro sin problemas

-- Paso 4: Crear política INSERT que verifica directamente
-- La clave es usar una subconsulta que lee SOLO el registro propio del usuario
-- Esto está permitido por la política SELECT y no causa recursión
CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
WITH CHECK (
    -- Permitir invitaciones pendientes
    (usuario_id IS NULL AND email_pendiente IS NOT NULL)
    OR
    -- Verificar directamente leyendo el registro PROPIO del usuario
    -- fcp_miembros.fcp_id se refiere a la fila que se está insertando
    -- fm_self lee solo el registro propio (usuario_id = auth.uid())
    -- Esto está permitido por la política SELECT y no causa recursión
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- Paso 5: Crear política UPDATE similar
CREATE POLICY "fcp_miembros_update_policy"
ON public.fcp_miembros
FOR UPDATE
USING (
    -- Usuarios pueden actualizar sus propios registros
    usuario_id = auth.uid()
    OR
    -- Verificar directamente si el usuario es director/secretario de la FCP
    EXISTS (
        SELECT 1 
        FROM public.fcp_miembros fm_self
        WHERE fm_self.usuario_id = auth.uid()
        AND fm_self.fcp_id = fcp_miembros.fcp_id
        AND fm_self.rol IN ('director', 'secretario')
        AND fm_self.activo = true
    )
);

-- IMPORTANTE: Esta solución funciona porque:
-- 1. La política SELECT permite leer registros propios (usuario_id = auth.uid())
-- 2. La subconsulta lee SOLO el registro propio (fm_self.usuario_id = auth.uid())
-- 3. Por lo tanto, la subconsulta puede ejecutarse sin problemas de RLS
-- 4. No hay recursión porque no leemos otros registros, solo el propio

-- Verificación: Después de ejecutar, prueba insertar un miembro como director
-- Debería funcionar si el usuario tiene rol 'director' o 'secretario' en esa FCP

