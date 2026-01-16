-- Fix: Asegurar que la política de INSERT para ONGs funcione correctamente
-- El problema es que TO authenticated no está funcionando correctamente
-- Vamos a verificar explícitamente auth.uid() y crear un log para debug

-- Eliminar todas las políticas de INSERT existentes
DROP POLICY IF EXISTS "Authenticated users can create ONGs" ON public.ongs;

-- Crear política que permite insertar si auth.uid() no es NULL
-- NOTA: Esta política NO usa TO authenticated porque puede no funcionar
-- si el token JWT no está siendo procesado correctamente por PostgREST
CREATE POLICY "Authenticated users can create ONGs"
ON public.ongs
FOR INSERT
WITH CHECK (
    -- Verificar explícitamente que auth.uid() no sea NULL
    -- Si esto falla, significa que PostgREST no está procesando el JWT token
    auth.uid() IS NOT NULL
);

-- Verificar que RLS esté habilitado
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;

-- Crear una función helper para debug que podamos llamar
CREATE OR REPLACE FUNCTION public.debug_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid();
$$;

-- Comentario: Si esta política aún no funciona, el problema puede ser:
-- 1. El token JWT no está siendo procesado correctamente por PostgREST
-- 2. La configuración de Supabase Auth no está reconociendo el token
-- 3. Hay un problema con la configuración de RLS en el proyecto

