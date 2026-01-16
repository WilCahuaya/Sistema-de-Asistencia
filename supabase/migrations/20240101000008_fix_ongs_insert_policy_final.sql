-- Fix FINAL: Limpiar todas las políticas de INSERT y crear una nueva que funcione
-- Como debug_auth() muestra que auth.uid() funciona, usaremos una función helper
-- similar a la de usuario_ong para evitar problemas de contexto en RLS

-- Eliminar TODAS las políticas de INSERT existentes (por si hay múltiples)
DROP POLICY IF EXISTS "Authenticated users can create ONGs" ON public.ongs;
DROP POLICY IF EXISTS "Users can create ONGs" ON public.ongs;
DROP POLICY IF EXISTS "Allow authenticated users to create ONGs" ON public.ongs;

-- Crear función helper para verificar autenticación usando SECURITY DEFINER
-- Esto asegura que la función tenga acceso al contexto JWT correcto
CREATE OR REPLACE FUNCTION public.is_user_authenticated()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT auth.uid() IS NOT NULL;
$$;

-- Crear política que usa la función helper
-- Esto debería funcionar ya que debug_auth() confirma que auth.uid() funciona
CREATE POLICY "Authenticated users can create ONGs"
ON public.ongs
FOR INSERT
WITH CHECK (
    -- Usar la función helper que usa SECURITY DEFINER
    -- Esto evita problemas de contexto en la evaluación de RLS
    public.is_user_authenticated()
);

-- Verificar que RLS esté habilitado
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;

