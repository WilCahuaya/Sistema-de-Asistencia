-- ============================================
-- MIGRACIÓN: Permitir a facilitadores ver datos de miembros de sus ONGs
-- ============================================

-- Problema: La política actual de usuarios solo permite ver el propio perfil
-- Solución: Agregar política para que facilitadores puedan ver usuarios que son miembros de sus ONGs

-- Crear política adicional para facilitadores
CREATE POLICY "Facilitators can view members of their ONGs"
ON public.usuarios
FOR SELECT
USING (
    -- El usuario actual es facilitador de alguna ONG
    EXISTS (
        SELECT 1 
        FROM public.usuario_ong uo_current
        WHERE uo_current.usuario_id = auth.uid()
        AND uo_current.rol = 'facilitador'
        AND uo_current.activo = true
    )
    AND
    -- Y el usuario que se está consultando es miembro de alguna de esas ONGs
    EXISTS (
        SELECT 1 
        FROM public.usuario_ong uo_member
        JOIN public.usuario_ong uo_facilitador ON uo_facilitador.ong_id = uo_member.ong_id
        WHERE uo_member.usuario_id = usuarios.id
        AND uo_facilitador.usuario_id = auth.uid()
        AND uo_facilitador.rol = 'facilitador'
        AND uo_facilitador.activo = true
        AND uo_member.activo = true
    )
);

COMMENT ON POLICY "Facilitators can view members of their ONGs" ON public.usuarios IS 
'Permite a facilitadores ver los datos de usuarios que son miembros de sus ONGs. Esto es necesario para mostrar información de miembros en la lista de miembros.';

