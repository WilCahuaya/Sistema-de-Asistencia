-- ============================================
-- Orden de salones por FCP + códigos A01, A02... para todos los salones
-- (reordenar salones con el mismo nombre afecta el código global de la FCP)
-- ============================================

-- 1) Columna orden (prioridad de listado dentro de la FCP)
ALTER TABLE public.aulas
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.aulas.orden IS 'Orden de visualización en la FCP. Salones con el mismo nombre se distinguen por código; subir/bajar cambia orden y se recalculan códigos.';

-- 2) Rellenar orden estable para filas existentes
WITH numeradas AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY fcp_id ORDER BY nombre, created_at, id) AS rn
  FROM public.aulas
)
UPDATE public.aulas a
SET orden = n.rn
FROM numeradas n
WHERE a.id = n.id;

-- 3) Quitar trigger antiguo (solo INSERT, lógica por nombre duplicado)
DROP TRIGGER IF EXISTS trigger_asignar_codigo_aula ON public.aulas;
DROP FUNCTION IF EXISTS public.asignar_codigo_aula();

-- 4) Recalcular códigos A01, A02... para todos los salones de una FCP (orden global)
--    Primero se pone codigo_aula a NULL para no violar el índice único (fcp_id, codigo_aula)
--    durante el UPDATE que reasigna códigos.
CREATE OR REPLACE FUNCTION public.recalcular_codigos_aulas_fcp(p_fcp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.aulas
  SET codigo_aula = NULL
  WHERE fcp_id = p_fcp_id;

  UPDATE public.aulas a
  SET codigo_aula = sub.cod
  FROM (
    SELECT id,
      'A' || LPAD(
        rn::text,
        CASE WHEN rn < 100 THEN 2 ELSE 3 END,
        '0'
      ) AS cod
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY orden, nombre, id) AS rn
      FROM public.aulas
      WHERE fcp_id = p_fcp_id
    ) t
  ) sub
  WHERE a.id = sub.id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_codigos_aulas_fcp(UUID) IS 'Asigna codigo_aula A01..AN según orden, nombre e id dentro de la FCP. Libera códigos antes de reasignar para evitar índice único.';

-- 5) Nueva aula: siguiente orden al final de la FCP
CREATE OR REPLACE FUNCTION public.trg_aulas_before_insert_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
BEGIN
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_next
  FROM public.aulas
  WHERE fcp_id = NEW.fcp_id;

  NEW.orden := v_next;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_aulas_before_insert_orden
  BEFORE INSERT ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aulas_before_insert_orden();

-- 6) Tras insertar/actualizar/borrar: recalcular códigos de la(s) FCP afectada(s)
CREATE OR REPLACE FUNCTION public.trg_aulas_after_recalc_codigos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_codigos_aulas_fcp(NEW.fcp_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.fcp_id IS DISTINCT FROM NEW.fcp_id THEN
      PERFORM public.recalcular_codigos_aulas_fcp(OLD.fcp_id);
    END IF;
    PERFORM public.recalcular_codigos_aulas_fcp(NEW.fcp_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_codigos_aulas_fcp(OLD.fcp_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_aulas_after_recalc_codigos ON public.aulas;
CREATE TRIGGER trigger_aulas_after_recalc_codigos
  AFTER INSERT OR DELETE OR UPDATE OF nombre, orden, fcp_id ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aulas_after_recalc_codigos();

-- 7) Primera pasada: asignar códigos a todas las FCP
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT fcp_id FROM public.aulas LOOP
    PERFORM public.recalcular_codigos_aulas_fcp(r.fcp_id);
  END LOOP;
END;
$$;

COMMENT ON COLUMN public.aulas.codigo_aula IS 'Código único por FCP (A01, A02...), según orden de listado.';

GRANT EXECUTE ON FUNCTION public.recalcular_codigos_aulas_fcp(UUID) TO authenticated;
