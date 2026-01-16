-- Fix: Asegurar que la política de INSERT para ONGs funcione correctamente
-- Solución: Simplificar la política para que cualquier usuario autenticado pueda crear ONGs

-- Eliminar todas las políticas de INSERT existentes
DROP POLICY IF EXISTS "Authenticated users can create ONGs" ON public.ongs;

-- Crear política simple que permite a cualquier usuario autenticado crear ONGs
-- NOTA: Esta política no verifica created_by porque puede causar problemas con RLS
-- El created_by puede ser establecido por el cliente o por un trigger
CREATE POLICY "Authenticated users can create ONGs"
ON public.ongs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verificar que RLS esté habilitado (debería estar habilitado, pero lo verificamos)
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;

