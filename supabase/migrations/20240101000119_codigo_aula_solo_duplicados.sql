-- ============================================
-- codigo_aula solo cuando hay salones duplicados (mismo nombre en la FCP)
-- Si es único: Nivel II | tutor (sin código)
-- Si hay duplicados: Nivel I | tutor | A01, Nivel I | tutor | A02
-- ============================================

DROP TRIGGER IF EXISTS trigger_asignar_codigo_aula ON public.aulas;

-- Permitir NULL en codigo_aula
ALTER TABLE public.aulas ALTER COLUMN codigo_aula DROP NOT NULL;

-- Quitar índice único anterior (permite múltiples NULL)
DROP INDEX IF EXISTS public.idx_aulas_fcp_codigo_aula;

-- Índice único solo cuando hay código (evita A01 duplicado en misma FCP)
CREATE UNIQUE INDEX IF NOT EXISTS idx_aulas_fcp_codigo_aula
  ON public.aulas(fcp_id, codigo_aula)
  WHERE codigo_aula IS NOT NULL;

-- Paso 1: Poner NULL donde el aula es única (única con ese nombre en la FCP)
WITH duplicados AS (
  SELECT fcp_id, nombre
  FROM public.aulas
  GROUP BY fcp_id, nombre
  HAVING COUNT(*) > 1
)
UPDATE public.aulas a
SET codigo_aula = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM duplicados d
  WHERE d.fcp_id = a.fcp_id AND d.nombre = a.nombre
);

-- Paso 2: Asignar A01, A02... solo a los duplicados (mismo fcp_id + nombre)
WITH duplicados AS (
  SELECT fcp_id, nombre FROM public.aulas
  GROUP BY fcp_id, nombre HAVING COUNT(*) > 1
),
numeradas AS (
  SELECT a.id,
    ROW_NUMBER() OVER (PARTITION BY a.fcp_id, a.nombre ORDER BY a.created_at, a.id) AS rn
  FROM public.aulas a
  JOIN duplicados d ON d.fcp_id = a.fcp_id AND d.nombre = a.nombre
)
UPDATE public.aulas a
SET codigo_aula = 'A' || LPAD(n.rn::text, 2, '0')
FROM numeradas n
WHERE a.id = n.id;

-- Paso 3: Función que asigna codigo_aula SOLO cuando hay duplicados
CREATE OR REPLACE FUNCTION public.asignar_codigo_aula()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_idx INT := 1;
  v_row RECORD;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.aulas
  WHERE fcp_id = NEW.fcp_id AND nombre = NEW.nombre;

  IF v_count = 0 THEN
    NEW.codigo_aula := NULL;
    RETURN NEW;
  END IF;

  -- Hay duplicados: actualizar los existentes con A01, A02... y el nuevo con el siguiente
  FOR v_row IN
    SELECT id FROM public.aulas
    WHERE fcp_id = NEW.fcp_id AND nombre = NEW.nombre
    ORDER BY created_at, id
  LOOP
    UPDATE public.aulas
    SET codigo_aula = 'A' || LPAD(v_idx::text, 2, '0')
    WHERE id = v_row.id;
    v_idx := v_idx + 1;
  END LOOP;

  NEW.codigo_aula := 'A' || LPAD(v_idx::text, 2, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_asignar_codigo_aula
  BEFORE INSERT ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_codigo_aula();

COMMENT ON COLUMN public.aulas.codigo_aula IS 'Código A01, A02... Solo se asigna cuando hay varias aulas con el mismo nombre en la FCP.';
