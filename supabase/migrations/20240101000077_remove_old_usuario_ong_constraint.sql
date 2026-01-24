-- ============================================
-- MIGRACIÓN: Eliminar restricción única antigua usuario_ong_usuario_id_ong_id_key
-- ============================================
-- Esta migración elimina explícitamente la restricción única antigua que impide
-- múltiples roles por usuario en la misma FCP.
-- El error "duplicate key value violates unique constraint usuario_ong_usuario_id_ong_id_key"
-- indica que esta restricción todavía existe y está bloqueando la inserción de múltiples roles.

-- Paso 1: Eliminar la restricción única antigua si existe (con cualquier nombre posible)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Buscar y eliminar la restricción antigua por nombre exacto
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.fcp_miembros'::regclass
    AND conname = 'usuario_ong_usuario_id_ong_id_key'
    AND contype = 'u';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.fcp_miembros DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE '✅ Restricción eliminada: %', v_constraint_name;
  ELSE
    RAISE NOTICE 'ℹ️ Restricción usuario_ong_usuario_id_ong_id_key no encontrada (puede que ya haya sido eliminada)';
  END IF;

  -- También buscar por patrón (por si tiene otro nombre similar)
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.fcp_miembros'::regclass
      AND conname LIKE '%usuario_ong%'
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.fcp_miembros DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE '✅ Restricción eliminada (por patrón): %', v_constraint_name;
  END LOOP;
END $$;

-- Paso 2: Eliminar cualquier índice único antiguo relacionado
DROP INDEX IF EXISTS public.usuario_ong_usuario_id_ong_id_key;
DROP INDEX IF EXISTS public.fcp_miembros_usuario_id_fcp_id_key;

-- Paso 3: Verificar que la nueva restricción única correcta existe
-- Esta restricción permite múltiples roles por usuario (usuario_id, fcp_id, rol)
DO $$
DECLARE
  v_index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'fcp_miembros'
      AND indexname = 'fcp_miembros_usuario_id_fcp_id_rol_key'
  ) INTO v_index_exists;

  IF NOT v_index_exists THEN
    -- Crear el índice único correcto si no existe
    CREATE UNIQUE INDEX fcp_miembros_usuario_id_fcp_id_rol_key
    ON public.fcp_miembros (usuario_id, fcp_id, rol)
    WHERE usuario_id IS NOT NULL;
    
    RAISE NOTICE '✅ Índice único creado: fcp_miembros_usuario_id_fcp_id_rol_key';
  ELSE
    RAISE NOTICE '✅ Índice único correcto ya existe: fcp_miembros_usuario_id_fcp_id_rol_key';
  END IF;
END $$;

-- Paso 4: Verificar que el índice único para email_pendiente también existe
DO $$
DECLARE
  v_index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'fcp_miembros'
      AND indexname = 'fcp_miembros_email_pendiente_fcp_id_rol_key'
  ) INTO v_index_exists;

  IF NOT v_index_exists THEN
    -- Crear el índice único para email_pendiente si no existe
    CREATE UNIQUE INDEX fcp_miembros_email_pendiente_fcp_id_rol_key
    ON public.fcp_miembros (email_pendiente, fcp_id, rol)
    WHERE email_pendiente IS NOT NULL AND usuario_id IS NULL;
    
    RAISE NOTICE '✅ Índice único creado: fcp_miembros_email_pendiente_fcp_id_rol_key';
  ELSE
    RAISE NOTICE '✅ Índice único correcto ya existe: fcp_miembros_email_pendiente_fcp_id_rol_key';
  END IF;
END $$;

-- Paso 5: Listar todas las restricciones únicas actuales en fcp_miembros para verificación
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  RAISE NOTICE '=== Restricciones únicas actuales en fcp_miembros ===';
  FOR v_constraint IN
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'public.fcp_miembros'::regclass
      AND contype = 'u'
    ORDER BY conname
  LOOP
    RAISE NOTICE '  - %: %', v_constraint.conname, v_constraint.definition;
  END LOOP;
END $$;

-- Paso 6: Listar todos los índices únicos actuales en fcp_miembros para verificación
DO $$
DECLARE
  v_index RECORD;
BEGIN
  RAISE NOTICE '=== Índices únicos actuales en fcp_miembros ===';
  FOR v_index IN
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'fcp_miembros'
      AND indexdef LIKE '%UNIQUE%'
    ORDER BY indexname
  LOOP
    RAISE NOTICE '  - %: %', v_index.indexname, v_index.indexdef;
  END LOOP;
END $$;

-- Agregar comentarios a los índices si existen
DO $$
BEGIN
  -- Comentar índice usuario_id_fcp_id_rol_key si existe
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'fcp_miembros'
      AND indexname = 'fcp_miembros_usuario_id_fcp_id_rol_key'
  ) THEN
    COMMENT ON INDEX fcp_miembros_usuario_id_fcp_id_rol_key IS 
    'Índice único que permite múltiples roles por usuario en la misma FCP, pero evita duplicados del mismo rol.';
  END IF;

  -- Comentar índice email_pendiente_fcp_id_rol_key si existe
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'fcp_miembros'
      AND indexname = 'fcp_miembros_email_pendiente_fcp_id_rol_key'
  ) THEN
    COMMENT ON INDEX fcp_miembros_email_pendiente_fcp_id_rol_key IS 
    'Índice único para invitaciones pendientes que permite múltiples roles por email en la misma FCP, pero evita duplicados del mismo rol.';
  END IF;
END $$;

