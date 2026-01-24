-- ============================================
-- MIGRACIÓN: Manejar cambio de director automáticamente
-- ============================================
-- Esta migración crea una función que maneja el cambio de director:
-- - Cuando un facilitador cambia de director, el director anterior:
--   1. Mantiene sus otros roles (si tiene)
--   2. Si no tiene otros roles, se pone en estado pendiente (activo = false)
--   3. El rol de director se elimina del director anterior

-- Paso 1: Crear función para manejar el cambio de director
-- Esta función maneja el cambio cuando se asigna un nuevo director
-- IMPORTANTE: Solo puede haber UN director activo por FCP. 
-- Solo elimina registros de director anteriores, NO otros roles del mismo usuario.
CREATE OR REPLACE FUNCTION public.manejar_cambio_director(
  p_fcp_id UUID,
  p_nuevo_director_id UUID,
  p_nuevo_director_usuario_id UUID
)
RETURNS void AS $$
DECLARE
  v_director_anterior_id UUID;
  v_director_anterior_usuario_id UUID;
BEGIN
  -- Buscar TODOS los registros de director anteriores de esta FCP (activos e inactivos)
  -- Excluyendo:
  -- 1. El nuevo registro de director (p_nuevo_director_id)
  -- 2. Cualquier registro del mismo usuario que está siendo asignado como director
  --    (para evitar eliminar otros roles del mismo usuario)
  FOR v_director_anterior_id, v_director_anterior_usuario_id IN
    SELECT id, usuario_id
    FROM public.fcp_miembros
    WHERE fcp_id = p_fcp_id
      AND rol = 'director'
      AND id != p_nuevo_director_id
      AND usuario_id != p_nuevo_director_usuario_id  -- IMPORTANTE: No eliminar otros roles del mismo usuario
  LOOP
    -- Eliminar solo el registro de director anterior de esta FCP
    -- Esto asegura que solo haya UN director activo por FCP
    DELETE FROM public.fcp_miembros
    WHERE id = v_director_anterior_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 1.5: Crear función trigger que se ejecuta automáticamente después de actualizar o insertar
CREATE OR REPLACE FUNCTION public.trigger_manejar_cambio_director()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar si el nuevo rol es 'director' y está activo
  IF NEW.rol = 'director' AND NEW.activo = true THEN
    -- Manejar el cambio de director automáticamente
    -- Pasar también el usuario_id para evitar eliminar otros roles del mismo usuario
    PERFORM public.manejar_cambio_director(NEW.fcp_id, NEW.id, NEW.usuario_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.manejar_cambio_director(UUID, UUID, UUID) IS 
'Maneja el cambio de director: elimina solo los registros de director anteriores de OTROS usuarios en la FCP, asegurando que solo haya UN director activo. NO elimina otros roles del mismo usuario que está siendo asignado como director.';

-- Paso 2: Crear trigger AFTER UPDATE para manejar automáticamente el cambio de director
DROP TRIGGER IF EXISTS trigger_after_update_director ON public.fcp_miembros;
CREATE TRIGGER trigger_after_update_director
  AFTER UPDATE OF rol, activo ON public.fcp_miembros
  FOR EACH ROW
  WHEN (NEW.rol = 'director' AND NEW.activo = true AND (OLD.rol != 'director' OR OLD.activo != true))
  EXECUTE FUNCTION public.trigger_manejar_cambio_director();

-- Paso 3: Crear trigger AFTER INSERT para manejar automáticamente cuando se inserta un nuevo director
DROP TRIGGER IF EXISTS trigger_after_insert_director ON public.fcp_miembros;
CREATE TRIGGER trigger_after_insert_director
  AFTER INSERT ON public.fcp_miembros
  FOR EACH ROW
  WHEN (NEW.rol = 'director' AND NEW.activo = true)
  EXECUTE FUNCTION public.trigger_manejar_cambio_director();

-- Paso 4: Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.manejar_cambio_director(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_manejar_cambio_director() TO authenticated;

