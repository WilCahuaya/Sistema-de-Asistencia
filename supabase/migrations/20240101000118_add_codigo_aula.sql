-- ============================================
-- Campo codigo_aula en aulas
-- Formato: A01, A02, A03... (autogenerado por FCP).
-- Permite varias aulas con el mismo nombre y mismo tutor.
-- ============================================

-- Permitir duplicados de nombre (y tutor) eliminando el índice único por nombre
DROP INDEX IF EXISTS public.idx_aulas_fcp_nombre;
CREATE INDEX IF NOT EXISTS idx_aulas_fcp_nombre ON public.aulas(fcp_id, nombre);

-- Paso 1: Agregar columna codigo_aula
ALTER TABLE public.aulas
  ADD COLUMN IF NOT EXISTS codigo_aula VARCHAR(10) NULL;

-- Paso 2: Rellenar códigos para aulas existentes (A01, A02, ... por cada fcp_id)
WITH numeradas AS (
  SELECT id, fcp_id,
    'A' || LPAD(ROW_NUMBER() OVER (PARTITION BY fcp_id ORDER BY created_at, id)::text, 2, '0') AS cod
  FROM public.aulas
  WHERE codigo_aula IS NULL
)
UPDATE public.aulas a
SET codigo_aula = n.cod
FROM numeradas n
WHERE a.id = n.id;

-- Asegurar que no quede ningún NULL (por si hubo filas nuevas entre medias)
UPDATE public.aulas
SET codigo_aula = 'A' || LPAD(
  (SELECT COALESCE(MAX(SUBSTRING(codigo_aula FROM 2)::integer), 0) + 1
   FROM public.aulas a2
   WHERE a2.fcp_id = aulas.fcp_id
     AND a2.codigo_aula ~ '^A[0-9]{2}$')::text,
  2, '0')
WHERE codigo_aula IS NULL;

-- Paso 3: NOT NULL y unicidad por FCP
ALTER TABLE public.aulas
  ALTER COLUMN codigo_aula SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_aulas_fcp_codigo_aula
  ON public.aulas(fcp_id, codigo_aula);

COMMENT ON COLUMN public.aulas.codigo_aula IS 'Código único por FCP, formato A01, A02... Autogenerado al crear el aula.';

-- Paso 4: Función que asigna el siguiente codigo_aula al insertar
CREATE OR REPLACE FUNCTION public.asignar_codigo_aula()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
BEGIN
  IF NEW.codigo_aula IS NULL OR TRIM(NEW.codigo_aula) = '' THEN
    SELECT COALESCE(MAX(
      CASE WHEN codigo_aula ~ '^A[0-9]{2}$'
        THEN SUBSTRING(codigo_aula FROM 2)::integer
        ELSE 0
      END
    ), 0) + 1
    INTO v_next
    FROM public.aulas
    WHERE fcp_id = NEW.fcp_id;

    NEW.codigo_aula := 'A' || LPAD(v_next::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_asignar_codigo_aula ON public.aulas;
CREATE TRIGGER trigger_asignar_codigo_aula
  BEFORE INSERT ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_codigo_aula();
