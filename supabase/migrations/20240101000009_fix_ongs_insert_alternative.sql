-- Fix ALTERNATIVO: Usar TO authenticated en lugar de WITH CHECK
-- A veces WITH CHECK no funciona correctamente aunque auth.uid() funcione en funciones RPC
-- Esta es una solución más simple y directa

-- Eliminar TODAS las políticas de INSERT existentes
DROP POLICY IF EXISTS "Authenticated users can create ONGs" ON public.ongs;
DROP POLICY IF EXISTS "Users can create ONGs" ON public.ongs;
DROP POLICY IF EXISTS "Allow authenticated users to create ONGs" ON public.ongs;

-- Eliminar función helper si existe (no la necesitamos si usamos TO authenticated)
DROP FUNCTION IF EXISTS public.is_user_authenticated();

-- Crear política simple usando TO authenticated
-- Esto debería funcionar ya que el token JWT está presente
CREATE POLICY "Authenticated users can create ONGs"
ON public.ongs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Si eso no funciona, intentar sin WITH CHECK
-- (descomentar la siguiente política y comentar la anterior si es necesario)
-- CREATE POLICY "Authenticated users can create ONGs"
-- ON public.ongs
-- FOR INSERT
-- TO authenticated;

-- Verificar que RLS esté habilitado
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;

