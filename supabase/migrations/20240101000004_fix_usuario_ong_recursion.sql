-- Fix: Resolver recursión infinita en la política de SELECT de usuario_ong
-- El problema es que la política consulta usuario_ong dentro de sí misma
-- Solución: Crear una función helper que use SECURITY DEFINER para evitar RLS recursivo

-- Eliminar todas las políticas de SELECT existentes en usuario_ong (tanto en inglés como en español)
-- para hacer la migración idempotente
DROP POLICY IF EXISTS "Users can view their memberships" ON public.usuario_ong;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propias membresías" ON public.usuario_ong;
DROP POLICY IF EXISTS "Los directores pueden ver todos los miembros de sus ONGs" ON public.usuario_ong;

-- Crear función helper que verifica si un usuario es director de una ONG
-- SECURITY DEFINER permite que la función se ejecute con los privilegios del creador,
-- evitando que RLS se active recursivamente
CREATE OR REPLACE FUNCTION public.is_user_director_of_ong(
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
        AND rol = 'director'
        AND activo = true
    );
$$;

-- Crear políticas simples que usan la función helper
CREATE POLICY "Users can view their own memberships"
ON public.usuario_ong
FOR SELECT
USING (usuario_id = auth.uid());

CREATE POLICY "Directors can view all members of their ONGs"
ON public.usuario_ong
FOR SELECT
USING (
    -- Usar la función helper que no activa RLS recursivamente
    public.is_user_director_of_ong(auth.uid(), ong_id)
);

