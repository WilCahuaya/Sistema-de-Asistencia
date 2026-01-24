-- ============================================
-- MIGRACIÓN: Permitir múltiples roles por usuario en la misma FCP
-- ============================================
-- Esta migración elimina la restricción UNIQUE en (usuario_id, fcp_id)
-- para permitir que un usuario tenga múltiples roles en la misma FCP
-- (por ejemplo, ser director y tutor al mismo tiempo)

-- Paso 1: Eliminar la restricción única existente
ALTER TABLE public.fcp_miembros
DROP CONSTRAINT IF EXISTS fcp_miembros_usuario_id_fcp_id_key;

-- Paso 2: Eliminar el índice único si existe
DROP INDEX IF EXISTS public.fcp_miembros_usuario_id_fcp_id_key;

-- Paso 3: Crear un nuevo índice único en (usuario_id, fcp_id, rol)
-- Esto asegura que un usuario no tenga el mismo rol duplicado en la misma FCP
-- pero permite tener múltiples roles diferentes
CREATE UNIQUE INDEX IF NOT EXISTS fcp_miembros_usuario_id_fcp_id_rol_key
ON public.fcp_miembros (usuario_id, fcp_id, rol)
WHERE usuario_id IS NOT NULL;

-- Paso 4: También crear índice único para email_pendiente cuando no hay usuario_id
CREATE UNIQUE INDEX IF NOT EXISTS fcp_miembros_email_pendiente_fcp_id_rol_key
ON public.fcp_miembros (email_pendiente, fcp_id, rol)
WHERE email_pendiente IS NOT NULL AND usuario_id IS NULL;

-- Comentarios para documentación
COMMENT ON INDEX fcp_miembros_usuario_id_fcp_id_rol_key IS 
'Índice único que permite múltiples roles por usuario en la misma FCP, pero evita duplicados del mismo rol.';

COMMENT ON INDEX fcp_miembros_email_pendiente_fcp_id_rol_key IS 
'Índice único para invitaciones pendientes que permite múltiples roles por email en la misma FCP, pero evita duplicados del mismo rol.';

