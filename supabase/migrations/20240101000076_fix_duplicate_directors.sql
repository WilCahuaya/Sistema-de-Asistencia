-- ============================================
-- MIGRACIÓN: Corregir directores duplicados y asegurar un solo director activo
-- ============================================
-- Esta migración:
-- 1. Limpia directores duplicados existentes (mantiene solo el más reciente)
-- 2. Mejora la función manejar_cambio_director para ser más robusta
-- 3. Asegura que los triggers funcionen correctamente

-- Paso 1: Limpiar directores duplicados existentes
-- Para cada FCP, mantener solo el director más reciente (por fecha_asignacion)
DO $$
DECLARE
  v_fcp_record RECORD;
  v_director_mas_reciente_id UUID;
BEGIN
  -- Iterar sobre cada FCP que tiene múltiples directores activos
  FOR v_fcp_record IN
    SELECT fcp_id, COUNT(*) as total_directores
    FROM public.fcp_miembros
    WHERE rol = 'director'
      AND activo = true
    GROUP BY fcp_id
    HAVING COUNT(*) > 1
  LOOP
    -- Encontrar el director más reciente para esta FCP
    SELECT id INTO v_director_mas_reciente_id
    FROM public.fcp_miembros
    WHERE fcp_id = v_fcp_record.fcp_id
      AND rol = 'director'
      AND activo = true
    ORDER BY fecha_asignacion DESC, created_at DESC
    LIMIT 1;
    
    -- Eliminar todos los otros directores de esta FCP
    DELETE FROM public.fcp_miembros
    WHERE fcp_id = v_fcp_record.fcp_id
      AND rol = 'director'
      AND activo = true
      AND id != v_director_mas_reciente_id;
    
    RAISE NOTICE 'FCP %: Eliminados directores duplicados, mantenido director ID: %', 
      v_fcp_record.fcp_id, v_director_mas_reciente_id;
  END LOOP;
END $$;

-- Paso 2: Mejorar la función manejar_cambio_director para ser más robusta
CREATE OR REPLACE FUNCTION public.manejar_cambio_director(
  p_fcp_id UUID,
  p_nuevo_director_id UUID,
  p_nuevo_director_usuario_id UUID
)
RETURNS void AS $$
DECLARE
  v_director_anterior_id UUID;
  v_director_anterior_usuario_id UUID;
  v_deleted_count INTEGER := 0;
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
      AND (usuario_id IS NULL OR usuario_id != p_nuevo_director_usuario_id)  -- IMPORTANTE: No eliminar otros roles del mismo usuario
  LOOP
    -- Eliminar solo el registro de director anterior de esta FCP
    -- Esto asegura que solo haya UN director activo por FCP
    DELETE FROM public.fcp_miembros
    WHERE id = v_director_anterior_id;
    
    v_deleted_count := v_deleted_count + 1;
  END LOOP;
  
  -- Log para debugging
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'manejar_cambio_director: Eliminados % director(es) anterior(es) para FCP %', 
      v_deleted_count, p_fcp_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 3: Asegurar que los triggers estén correctamente configurados
-- El trigger AFTER INSERT debería ejecutarse automáticamente cuando se inserta un nuevo director
-- Pero vamos a asegurarnos de que esté activo

-- Verificar y recrear el trigger AFTER INSERT si es necesario
DROP TRIGGER IF EXISTS trigger_after_insert_director ON public.fcp_miembros;
CREATE TRIGGER trigger_after_insert_director
  AFTER INSERT ON public.fcp_miembros
  FOR EACH ROW
  WHEN (NEW.rol = 'director' AND NEW.activo = true)
  EXECUTE FUNCTION public.trigger_manejar_cambio_director();

-- Verificar y recrear el trigger AFTER UPDATE si es necesario
DROP TRIGGER IF EXISTS trigger_after_update_director ON public.fcp_miembros;
CREATE TRIGGER trigger_after_update_director
  AFTER UPDATE OF rol, activo ON public.fcp_miembros
  FOR EACH ROW
  WHEN (NEW.rol = 'director' AND NEW.activo = true AND (OLD.rol != 'director' OR OLD.activo != true))
  EXECUTE FUNCTION public.trigger_manejar_cambio_director();

-- Paso 4: Crear una función de validación para verificar que solo haya un director activo por FCP
CREATE OR REPLACE FUNCTION public.validar_un_solo_director_por_fcp()
RETURNS TABLE(
  fcp_id UUID,
  total_directores BIGINT,
  directores_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fm.fcp_id,
    COUNT(*)::BIGINT as total_directores,
    ARRAY_AGG(fm.id) as directores_ids
  FROM public.fcp_miembros fm
  WHERE fm.rol = 'director'
    AND fm.activo = true
  GROUP BY fm.fcp_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.validar_un_solo_director_por_fcp() IS 
'Valida que solo haya un director activo por FCP. Retorna las FCPs que tienen múltiples directores activos.';

GRANT EXECUTE ON FUNCTION public.validar_un_solo_director_por_fcp() TO authenticated;

-- Paso 5: Ejecutar validación y mostrar resultados
DO $$
DECLARE
  v_fcp_record RECORD;
BEGIN
  RAISE NOTICE '=== Validación de directores duplicados ===';
  
  FOR v_fcp_record IN
    SELECT * FROM public.validar_un_solo_director_por_fcp()
  LOOP
    RAISE WARNING 'FCP % tiene % directores activos. IDs: %', 
      v_fcp_record.fcp_id, 
      v_fcp_record.total_directores,
      v_fcp_record.directores_ids;
  END LOOP;
  
  IF NOT FOUND THEN
    RAISE NOTICE '✅ Todas las FCPs tienen un solo director activo.';
  END IF;
END $$;

