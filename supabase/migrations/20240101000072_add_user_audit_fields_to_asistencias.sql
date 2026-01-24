-- ============================================
-- MIGRACIÓN: Agregar campos de auditoría completos a asistencias
-- ============================================
-- Esta migración agrega campos para guardar directamente el nombre completo,
-- correo, rol y fecha de quien registró o editó la asistencia.
-- Esto evita tener que hacer consultas adicionales y preserva el historial
-- incluso si el usuario cambia de rol o es desactivado.

-- Agregar columnas para datos del creador
ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS created_by_nombre TEXT,
ADD COLUMN IF NOT EXISTS created_by_email TEXT,
ADD COLUMN IF NOT EXISTS created_by_rol TEXT;

-- Agregar columnas para datos del editor
ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS updated_by_nombre TEXT,
ADD COLUMN IF NOT EXISTS updated_by_email TEXT,
ADD COLUMN IF NOT EXISTS updated_by_rol TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN public.asistencias.created_by_nombre IS 'Nombre completo del usuario que registró la asistencia';
COMMENT ON COLUMN public.asistencias.created_by_email IS 'Correo electrónico del usuario que registró la asistencia';
COMMENT ON COLUMN public.asistencias.created_by_rol IS 'Rol del usuario que registró la asistencia en el momento del registro';
COMMENT ON COLUMN public.asistencias.updated_by_nombre IS 'Nombre completo del usuario que editó la asistencia';
COMMENT ON COLUMN public.asistencias.updated_by_email IS 'Correo electrónico del usuario que editó la asistencia';
COMMENT ON COLUMN public.asistencias.updated_by_rol IS 'Rol del usuario que editó la asistencia en el momento de la edición';

-- ============================================
-- Función para obtener datos completos del usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_audit_data(
  p_user_id UUID,
  p_fcp_id UUID
)
RETURNS TABLE(
  nombre_completo TEXT,
  email TEXT,
  rol TEXT
) AS $$
DECLARE
  v_nombre_completo TEXT;
  v_email TEXT;
  v_rol TEXT;
BEGIN
  -- Intentar obtener datos desde la tabla usuarios
  SELECT 
    u.nombre_completo,
    u.email,
    NULL::TEXT -- El rol se obtiene de fcp_miembros
  INTO v_nombre_completo, v_email, v_rol
  FROM public.usuarios u
  WHERE u.id = p_user_id;
  
  -- Si no se encuentra en usuarios, intentar desde auth.users
  IF v_email IS NULL THEN
    SELECT 
      u.email::TEXT,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        ''
      )::TEXT AS nombre_completo
    INTO v_email, v_nombre_completo
    FROM auth.users u
    WHERE u.id = p_user_id;
  END IF;
  
  -- Obtener el rol desde fcp_miembros (primero activo, luego cualquier)
  IF p_fcp_id IS NOT NULL THEN
    SELECT fm.rol::TEXT
    INTO v_rol
    FROM public.fcp_miembros fm
    WHERE fm.fcp_id = p_fcp_id
      AND fm.usuario_id = p_user_id
      AND fm.activo = true
    LIMIT 1;
    
    -- Si no hay miembro activo, buscar cualquier miembro
    IF v_rol IS NULL THEN
      SELECT fm.rol::TEXT
      INTO v_rol
      FROM public.fcp_miembros fm
      WHERE fm.fcp_id = p_fcp_id
        AND fm.usuario_id = p_user_id
      ORDER BY fm.created_at DESC
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN QUERY SELECT 
    COALESCE(v_nombre_completo, '')::TEXT,
    COALESCE(v_email, '')::TEXT,
    COALESCE(v_rol, '')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_audit_data(UUID, UUID) IS 
'Obtiene los datos completos de auditoría de un usuario (nombre, email, rol) para guardarlos en asistencias.';

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.get_user_audit_data(UUID, UUID) TO authenticated;

-- ============================================
-- Función trigger para actualizar campos de auditoría al INSERT
-- ============================================
CREATE OR REPLACE FUNCTION public.set_asistencia_audit_fields_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_audit_data RECORD;
BEGIN
  -- Si hay created_by, obtener sus datos
  IF NEW.created_by IS NOT NULL THEN
    SELECT * INTO v_audit_data
    FROM public.get_user_audit_data(NEW.created_by, NEW.fcp_id);
    
    NEW.created_by_nombre := v_audit_data.nombre_completo;
    NEW.created_by_email := v_audit_data.email;
    NEW.created_by_rol := v_audit_data.rol;
  END IF;
  
  -- Si hay updated_by y es diferente de created_by, obtener sus datos
  IF NEW.updated_by IS NOT NULL AND NEW.updated_by != NEW.created_by THEN
    SELECT * INTO v_audit_data
    FROM public.get_user_audit_data(NEW.updated_by, NEW.fcp_id);
    
    NEW.updated_by_nombre := v_audit_data.nombre_completo;
    NEW.updated_by_email := v_audit_data.email;
    NEW.updated_by_rol := v_audit_data.rol;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Función trigger para actualizar campos de auditoría al UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION public.set_asistencia_audit_fields_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_audit_data RECORD;
BEGIN
  -- Si updated_by cambió o es la primera vez que se actualiza, obtener datos del editor
  IF NEW.updated_by IS NOT NULL AND (
    OLD.updated_by IS NULL OR 
    NEW.updated_by != OLD.updated_by OR
    NEW.updated_by_nombre IS NULL
  ) THEN
    SELECT * INTO v_audit_data
    FROM public.get_user_audit_data(NEW.updated_by, NEW.fcp_id);
    
    NEW.updated_by_nombre := v_audit_data.nombre_completo;
    NEW.updated_by_email := v_audit_data.email;
    NEW.updated_by_rol := v_audit_data.rol;
  END IF;
  
  -- Mantener los datos del creador (no deben cambiar)
  IF NEW.created_by IS NOT NULL AND NEW.created_by_nombre IS NULL THEN
    SELECT * INTO v_audit_data
    FROM public.get_user_audit_data(NEW.created_by, NEW.fcp_id);
    
    NEW.created_by_nombre := v_audit_data.nombre_completo;
    NEW.created_by_email := v_audit_data.email;
    NEW.created_by_rol := v_audit_data.rol;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Crear triggers
-- ============================================
DROP TRIGGER IF EXISTS trigger_set_asistencia_audit_on_insert ON public.asistencias;
CREATE TRIGGER trigger_set_asistencia_audit_on_insert
  BEFORE INSERT ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_asistencia_audit_fields_on_insert();

DROP TRIGGER IF EXISTS trigger_set_asistencia_audit_on_update ON public.asistencias;
CREATE TRIGGER trigger_set_asistencia_audit_on_update
  BEFORE UPDATE ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_asistencia_audit_fields_on_update();

-- ============================================
-- Actualizar registros existentes (opcional, puede tomar tiempo si hay muchos)
-- ============================================
-- Comentado por defecto para evitar ejecuciones largas
-- Descomentar si quieres actualizar registros existentes
/*
UPDATE public.asistencias a
SET 
  created_by_nombre = COALESCE(
    (SELECT nombre_completo FROM public.usuarios WHERE id = a.created_by),
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') FROM auth.users WHERE id = a.created_by)
  ),
  created_by_email = COALESCE(
    (SELECT email FROM public.usuarios WHERE id = a.created_by),
    (SELECT email FROM auth.users WHERE id = a.created_by)
  ),
  created_by_rol = (
    SELECT rol::TEXT FROM public.fcp_miembros 
    WHERE fcp_id = a.fcp_id 
      AND usuario_id = a.created_by 
      AND activo = true
    LIMIT 1
  )
WHERE a.created_by IS NOT NULL AND a.created_by_nombre IS NULL;

UPDATE public.asistencias a
SET 
  updated_by_nombre = COALESCE(
    (SELECT nombre_completo FROM public.usuarios WHERE id = a.updated_by),
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') FROM auth.users WHERE id = a.updated_by)
  ),
  updated_by_email = COALESCE(
    (SELECT email FROM public.usuarios WHERE id = a.updated_by),
    (SELECT email FROM auth.users WHERE id = a.updated_by)
  ),
  updated_by_rol = (
    SELECT rol::TEXT FROM public.fcp_miembros 
    WHERE fcp_id = a.fcp_id 
      AND usuario_id = a.updated_by 
      AND activo = true
    LIMIT 1
  )
WHERE a.updated_by IS NOT NULL 
  AND a.updated_by != a.created_by 
  AND a.updated_by_nombre IS NULL;
*/

