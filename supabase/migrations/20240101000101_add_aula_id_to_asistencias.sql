-- ============================================
-- MIGRACIÓN: Agregar aula_id a asistencias
-- Implementa regla de inmutabilidad por mes
-- ============================================

-- Paso 1: Agregar columna aula_id a la tabla asistencias
ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS aula_id UUID REFERENCES public.aulas(id) ON DELETE RESTRICT;

-- Paso 2: Crear índice para mejorar consultas por aula
CREATE INDEX IF NOT EXISTS idx_asistencias_aula_id ON public.asistencias(aula_id);

-- Paso 3: Poblar aula_id con el aula_id actual del estudiante para registros históricos
-- Esto asegura que las asistencias existentes tengan el aula correcta
UPDATE public.asistencias a
SET aula_id = e.aula_id
FROM public.estudiantes e
WHERE a.estudiante_id = e.id
  AND a.aula_id IS NULL;

-- Paso 4: Hacer el campo NOT NULL después de poblar los datos
-- Primero verificamos que no haya NULLs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.asistencias WHERE aula_id IS NULL) THEN
    RAISE EXCEPTION 'No se pueden hacer NULLs. Existen asistencias sin aula_id asignada.';
  END IF;
END $$;

ALTER TABLE public.asistencias
ALTER COLUMN aula_id SET NOT NULL;

-- Paso 5: Agregar comentario explicativo
COMMENT ON COLUMN public.asistencias.aula_id IS 
'ID del aula del estudiante al momento de registrar la asistencia. Este campo es inmutable y preserva el historial cuando un estudiante cambia de aula. Las asistencias de meses anteriores no pueden modificarse.';

-- Paso 6: Crear función para validar que no se modifiquen o inserten asistencias de meses anteriores
CREATE OR REPLACE FUNCTION public.validar_inmutabilidad_asistencias()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha_asistencia DATE;
  v_mes_asistencia DATE;
  v_mes_actual DATE;
BEGIN
  -- Calcular el primer día del mes actual
  v_mes_actual := DATE_TRUNC('month', CURRENT_DATE);
  
  -- Manejar según el tipo de operación
  IF TG_OP = 'DELETE' THEN
    -- Para DELETE, usar OLD.fecha
    v_fecha_asistencia := OLD.fecha;
    v_mes_asistencia := DATE_TRUNC('month', v_fecha_asistencia);
    
    -- Solo bloquear DELETE de meses anteriores
    IF v_mes_asistencia < v_mes_actual THEN
      RAISE EXCEPTION 'No se pueden eliminar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    END IF;
    
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    -- Para INSERT, usar NEW.fecha
    v_fecha_asistencia := NEW.fecha;
    v_mes_asistencia := DATE_TRUNC('month', v_fecha_asistencia);
    
    -- Solo bloquear INSERT de meses anteriores
    -- Permitir mes actual y meses futuros
    IF v_mes_asistencia < v_mes_actual THEN
      RAISE EXCEPTION 'No se pueden registrar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para UPDATE, usar NEW.fecha (o OLD.fecha si NEW.fecha es NULL)
    v_fecha_asistencia := COALESCE(NEW.fecha, OLD.fecha);
    v_mes_asistencia := DATE_TRUNC('month', v_fecha_asistencia);
    
    -- Solo bloquear UPDATE de meses anteriores
    -- Permitir mes actual y meses futuros
    IF v_mes_asistencia < v_mes_actual THEN
      RAISE EXCEPTION 'No se pueden modificar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    END IF;
    
    -- No permitir cambiar la fecha
    IF NEW.fecha != OLD.fecha THEN
      RAISE EXCEPTION 'No se puede cambiar la fecha de una asistencia existente.';
    END IF;
    
    -- No permitir cambiar el aula_id (inmutable)
    IF NEW.aula_id != OLD.aula_id THEN
      RAISE EXCEPTION 'No se puede cambiar el aula_id de una asistencia. Este campo es inmutable para preservar el historial.';
    END IF;
    
    -- No permitir cambiar el estudiante_id
    IF NEW.estudiante_id != OLD.estudiante_id THEN
      RAISE EXCEPTION 'No se puede cambiar el estudiante_id de una asistencia.';
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Paso 7: Crear trigger para validar inmutabilidad (INSERT, UPDATE y DELETE)
DROP TRIGGER IF EXISTS trigger_validar_inmutabilidad_asistencias ON public.asistencias;
CREATE TRIGGER trigger_validar_inmutabilidad_asistencias
  BEFORE INSERT OR UPDATE OR DELETE ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_inmutabilidad_asistencias();

-- Paso 8: Crear función para asegurar que aula_id se establezca al crear asistencia
CREATE OR REPLACE FUNCTION public.establecer_aula_id_asistencia()
RETURNS TRIGGER AS $$
BEGIN
  -- Si no se proporciona aula_id, obtenerlo del estudiante
  IF NEW.aula_id IS NULL THEN
    SELECT aula_id INTO NEW.aula_id
    FROM public.estudiantes
    WHERE id = NEW.estudiante_id;
    
    IF NEW.aula_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo determinar el aula_id del estudiante.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 9: Crear trigger para establecer aula_id automáticamente
DROP TRIGGER IF EXISTS trigger_establecer_aula_id_asistencia ON public.asistencias;
CREATE TRIGGER trigger_establecer_aula_id_asistencia
  BEFORE INSERT ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.establecer_aula_id_asistencia();

