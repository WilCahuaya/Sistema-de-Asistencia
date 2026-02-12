-- ============================================
-- Un estudiante NO puede estar en dos salones al mismo tiempo
-- Validación: períodos superpuestos en aulas diferentes = ERROR
-- ============================================

CREATE OR REPLACE FUNCTION public.validar_estudiante_un_salon_por_periodo()
RETURNS TRIGGER AS $$
DECLARE
  v_conflicto RECORD;
  v_aula_nombre TEXT;
BEGIN
  -- Buscar otro período del mismo estudiante en OTRO aula que se superponga
  SELECT ep.id, ep.aula_id, ep.fecha_inicio, ep.fecha_fin, a.nombre AS aula_nombre
  INTO v_conflicto
  FROM public.estudiante_periodos ep
  JOIN public.aulas a ON a.id = ep.aula_id
  WHERE ep.estudiante_id = NEW.estudiante_id
    AND ep.aula_id IS DISTINCT FROM NEW.aula_id
    AND ep.id IS DISTINCT FROM COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ep.fecha_inicio <= COALESCE(NEW.fecha_fin, '9999-12-31'::date)
    AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= NEW.fecha_inicio)
  LIMIT 1;

  IF FOUND THEN
    v_aula_nombre := v_conflicto.aula_nombre;
    RAISE EXCEPTION 'Un estudiante no puede estar en dos salones al mismo tiempo. Ya tiene un período en "%" que se superpone con las fechas indicadas (% al %).',
      v_aula_nombre,
      NEW.fecha_inicio,
      COALESCE(NEW.fecha_fin::text, 'vigente');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_estudiante_un_salon ON public.estudiante_periodos;
CREATE TRIGGER trigger_validar_estudiante_un_salon
  BEFORE INSERT OR UPDATE OF estudiante_id, aula_id, fecha_inicio, fecha_fin
  ON public.estudiante_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_estudiante_un_salon_por_periodo();

COMMENT ON FUNCTION public.validar_estudiante_un_salon_por_periodo IS 'Impide que un estudiante tenga períodos superpuestos en aulas diferentes. Un estudiante solo puede estar en un salón a la vez.';
