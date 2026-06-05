-- ============================================
-- Sucursales para organizar aulas (gestionadas desde el módulo de Aulas)
-- ============================================
-- Una FCP puede tener varias sucursales; cada aula pertenece a UNA sucursal.
-- Se crea una sucursal predeterminada por FCP ('Sin sucursal', es_predeterminada = true)
-- a la que se asocian automáticamente las aulas existentes para mantener
-- compatibilidad. Esa sucursal es interna: en la UI las aulas aparecen sin
-- encabezado de sucursal (como hasta ahora).
--
-- No se modifica el comportamiento de estudiantes, matrículas (estudiante_periodos),
-- asistencias ni los códigos de aula (codigo_aula y orden siguen siendo por FCP).
-- ============================================

-- 1) Tabla sucursales
CREATE TABLE IF NOT EXISTS public.sucursales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fcp_id UUID NOT NULL REFERENCES public.fcps(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    es_predeterminada BOOLEAN NOT NULL DEFAULT false,
    activa BOOLEAN NOT NULL DEFAULT true,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.sucursales IS 'Agrupación de aulas por sucursal dentro de una FCP. La sucursal con es_predeterminada=true es interna ("Sin sucursal") y no se muestra como encabezado.';
COMMENT ON COLUMN public.sucursales.es_predeterminada IS 'Sucursal interna por FCP para aulas sin sucursal asignada. Sus aulas se muestran sin encabezado.';

CREATE INDEX IF NOT EXISTS idx_sucursales_fcp_id ON public.sucursales(fcp_id);
CREATE INDEX IF NOT EXISTS idx_sucursales_activa ON public.sucursales(activa);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sucursales_fcp_nombre ON public.sucursales(fcp_id, nombre);
-- Una sola sucursal predeterminada por FCP
CREATE UNIQUE INDEX IF NOT EXISTS idx_sucursales_fcp_predeterminada
  ON public.sucursales(fcp_id) WHERE es_predeterminada;

-- updated_at automático
DROP TRIGGER IF EXISTS update_sucursales_updated_at ON public.sucursales;
CREATE TRIGGER update_sucursales_updated_at BEFORE UPDATE ON public.sucursales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Crear sucursal predeterminada para todas las FCPs existentes
INSERT INTO public.sucursales (fcp_id, nombre, es_predeterminada, activa, orden)
SELECT f.id, 'Sin sucursal', true, true, 0
FROM public.fcps f
WHERE NOT EXISTS (
  SELECT 1 FROM public.sucursales s
  WHERE s.fcp_id = f.id AND s.es_predeterminada
);

-- 3) Columna aulas.sucursal_id (nullable primero para poder rellenar)
ALTER TABLE public.aulas
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.aulas.sucursal_id IS 'Sucursal a la que pertenece el aula. Por defecto la sucursal predeterminada de la FCP.';

-- 4) Asociar todas las aulas existentes a la sucursal predeterminada de su FCP
UPDATE public.aulas a
SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.fcp_id = a.fcp_id
  AND s.es_predeterminada
  AND a.sucursal_id IS NULL;

-- 5) Función: obtener (o crear) la sucursal predeterminada de una FCP
CREATE OR REPLACE FUNCTION public.obtener_sucursal_predeterminada(p_fcp_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.sucursales
  WHERE fcp_id = p_fcp_id AND es_predeterminada
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.sucursales (fcp_id, nombre, es_predeterminada, activa, orden)
    VALUES (p_fcp_id, 'Sin sucursal', true, true, 0)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.obtener_sucursal_predeterminada(UUID) IS 'Devuelve la sucursal predeterminada de la FCP, creándola si no existe.';
GRANT EXECUTE ON FUNCTION public.obtener_sucursal_predeterminada(UUID) TO authenticated;

-- 6) Trigger BEFORE INSERT en aulas: si no se indica sucursal, usar la predeterminada;
--    además validar que la sucursal pertenezca a la misma FCP.
CREATE OR REPLACE FUNCTION public.trg_aulas_set_sucursal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fcp UUID;
BEGIN
  IF NEW.sucursal_id IS NULL THEN
    NEW.sucursal_id := public.obtener_sucursal_predeterminada(NEW.fcp_id);
  ELSE
    SELECT fcp_id INTO v_fcp FROM public.sucursales WHERE id = NEW.sucursal_id;
    IF v_fcp IS NULL THEN
      RAISE EXCEPTION 'La sucursal indicada no existe';
    END IF;
    IF v_fcp IS DISTINCT FROM NEW.fcp_id THEN
      RAISE EXCEPTION 'La sucursal no pertenece a la misma FCP del aula';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_aulas_set_sucursal ON public.aulas;
CREATE TRIGGER trigger_aulas_set_sucursal
  BEFORE INSERT ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aulas_set_sucursal();

-- 7) Asegurar que ninguna aula quede sin sucursal y forzar NOT NULL
UPDATE public.aulas a
SET sucursal_id = public.obtener_sucursal_predeterminada(a.fcp_id)
WHERE a.sucursal_id IS NULL;

ALTER TABLE public.aulas
  ALTER COLUMN sucursal_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aulas_sucursal_id ON public.aulas(sucursal_id);

-- 8) Protección de borrado: impedir eliminar una sucursal con aulas asociadas
--    (además del ON DELETE RESTRICT del FK, damos un mensaje claro).
CREATE OR REPLACE FUNCTION public.trg_sucursales_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.aulas WHERE sucursal_id = OLD.id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar la sucursal: tiene % aula(s) asociada(s). Reasigne las aulas a otra sucursal primero.', v_count;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sucursales_before_delete ON public.sucursales;
CREATE TRIGGER trigger_sucursales_before_delete
  BEFORE DELETE ON public.sucursales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sucursales_before_delete();

-- 9) RLS para sucursales
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

-- SELECT: facilitadores ven todas; cualquier miembro activo de la FCP ve las suyas
-- (incluye directores, secretarios y tutores, para poder agrupar las aulas).
DROP POLICY IF EXISTS "Ver sucursales de la FCP" ON public.sucursales;
CREATE POLICY "Ver sucursales de la FCP"
ON public.sucursales
FOR SELECT
USING (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = sucursales.fcp_id
        AND activo = true
    )
);

-- INSERT: facilitadores en cualquier FCP; director/secretario en su FCP
DROP POLICY IF EXISTS "Crear sucursales en la FCP" ON public.sucursales;
CREATE POLICY "Crear sucursales en la FCP"
ON public.sucursales
FOR INSERT
WITH CHECK (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = sucursales.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- UPDATE: facilitadores; director/secretario de su FCP
DROP POLICY IF EXISTS "Actualizar sucursales de la FCP" ON public.sucursales;
CREATE POLICY "Actualizar sucursales de la FCP"
ON public.sucursales
FOR UPDATE
USING (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = sucursales.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
);

-- DELETE: facilitadores; director/secretario de su FCP.
-- Las predeterminadas no se pueden eliminar; el trigger impide borrar con aulas.
DROP POLICY IF EXISTS "Eliminar sucursales de la FCP" ON public.sucursales;
CREATE POLICY "Eliminar sucursales de la FCP"
ON public.sucursales
FOR DELETE
USING (
    NOT es_predeterminada
    AND (
        public.es_facilitador(auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM public.fcp_miembros
            WHERE usuario_id = auth.uid()
            AND fcp_id = sucursales.fcp_id
            AND rol IN ('director', 'secretario')
            AND activo = true
        )
    )
);
