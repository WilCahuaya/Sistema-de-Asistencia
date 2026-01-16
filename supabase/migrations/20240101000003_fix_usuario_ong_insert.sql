-- Fix: Permitir que los usuarios autenticados se asocien a ONGs nuevas (sin miembros)
-- o que los directores agreguen miembros

-- Primero, eliminar la política existente
DROP POLICY IF EXISTS "Directors can add members to their ONGs" ON public.usuario_ong;

-- Crear nueva política que permite:
-- 1. Agregar miembros si eres director de la ONG
-- 2. Agregarte como director si la ONG no tiene miembros activos (creador de la ONG)
CREATE POLICY "Users can add members to ONGs"
ON public.usuario_ong
FOR INSERT
WITH CHECK (
    -- Caso 1: Eres director de la ONG
    EXISTS (
        SELECT 1 FROM public.usuario_ong uo
        WHERE uo.usuario_id = auth.uid()
        AND uo.ong_id = usuario_ong.ong_id
        AND uo.rol = 'director'
        AND uo.activo = true
    )
    OR
    -- Caso 2: Estás creando la relación y eres el creador de la ONG
    -- y no hay ningún miembro activo en esa ONG todavía
    (
        usuario_id = auth.uid()
        AND rol = 'director'
        AND NOT EXISTS (
            SELECT 1 FROM public.usuario_ong uo
            WHERE uo.ong_id = usuario_ong.ong_id
            AND uo.activo = true
        )
        AND EXISTS (
            SELECT 1 FROM public.ongs o
            WHERE o.id = usuario_ong.ong_id
            AND o.created_by = auth.uid()
        )
    )
);

