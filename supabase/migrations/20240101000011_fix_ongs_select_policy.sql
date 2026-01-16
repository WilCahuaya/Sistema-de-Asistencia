-- Fix: Permitir que los usuarios vean las ONGs que ellos crearon
-- El problema es que .select() después de .insert() necesita poder leer la ONG recién creada,
-- pero la política SELECT actual requiere que el usuario sea miembro (aún no lo es)

-- Eliminar la política SELECT existente
DROP POLICY IF EXISTS "Users can view their ONGs" ON public.ongs;

-- Crear nueva política SELECT que permite:
-- 1. Ver ONGs donde el usuario es miembro (como antes)
-- 2. Ver ONGs donde el usuario es el creador (para poder leer después de crear)
CREATE POLICY "Users can view their ONGs"
ON public.ongs
FOR SELECT
USING (
    -- Caso 1: El usuario es miembro de la ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong
        WHERE usuario_id = auth.uid()
        AND ong_id = ongs.id
        AND activo = true
    )
    OR
    -- Caso 2: El usuario es el creador de la ONG
    -- Esto permite leer la ONG inmediatamente después de crearla
    created_by = auth.uid()
);

