-- ============================================
-- MIGRACIÓN: Facilitador–FCP 1:N (solo BD)
-- ============================================
-- El rol Facilitador solo se asigna en BD. Los facilitadores no pertenecen a ninguna FCP;
-- cada FCP pertenece a un único Facilitador (1:N). Nunca asignar facilitador en fcp_miembros.

-- Paso 1: Tabla facilitadores (solo lectura desde app; escritura solo por admin BD)
-- ============================================
CREATE TABLE IF NOT EXISTS public.facilitadores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilitadores_usuario_id ON public.facilitadores(usuario_id);

COMMENT ON TABLE public.facilitadores IS 'Usuarios con rol Facilitador. Solo se crean/modifican en BD por administrador. La app solo lee.';

DROP TRIGGER IF EXISTS trigger_facilitadores_updated_at ON public.facilitadores;
CREATE TRIGGER trigger_facilitadores_updated_at
  BEFORE UPDATE ON public.facilitadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: solo lectura para autenticados (ver si uno es facilitador). Sin INSERT/UPDATE para authenticated.
ALTER TABLE public.facilitadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facilitadores_select_own" ON public.facilitadores;
CREATE POLICY "facilitadores_select_own"
  ON public.facilitadores FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Paso 2: fcps.facilitador_id (1:N)
-- ============================================
ALTER TABLE public.fcps
ADD COLUMN IF NOT EXISTS facilitador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fcps_facilitador_id ON public.fcps(facilitador_id);

COMMENT ON COLUMN public.fcps.facilitador_id IS 'Facilitador dueño de la FCP (1:N). Solo se asigna en BD o al crear FCP por un facilitador.';

-- Paso 3: Migrar datos desde fcp_miembros (rol=facilitador)
-- ============================================
-- 3a) Insertar en facilitadores todos los usuario_id con rol facilitador (sin duplicados)
INSERT INTO public.facilitadores (usuario_id)
SELECT DISTINCT fm.usuario_id
FROM public.fcp_miembros fm
WHERE fm.rol = 'facilitador' AND fm.activo = true AND fm.usuario_id IS NOT NULL
ON CONFLICT (usuario_id) DO NOTHING;

-- 3b) Asignar facilitador_id en fcps donde el usuario era facilitador de esa FCP
UPDATE public.fcps f
SET facilitador_id = fm.usuario_id
FROM public.fcp_miembros fm
WHERE fm.fcp_id = f.id
  AND fm.rol = 'facilitador'
  AND fm.activo = true
  AND fm.usuario_id IS NOT NULL
  AND (f.facilitador_id IS NULL OR f.facilitador_id = fm.usuario_id);

-- 3c) Eliminar filas de fcp_miembros con rol facilitador
DELETE FROM public.fcp_miembros WHERE rol = 'facilitador';

-- Paso 4: Funciones es_facilitador y es_facilitador_de_fcp
-- ============================================
CREATE OR REPLACE FUNCTION public.es_facilitador(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.facilitadores
    WHERE usuario_id = p_usuario_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador(UUID) IS 'Verifica si el usuario es Facilitador (tabla facilitadores). Solo lectura desde BD.';

GRANT EXECUTE ON FUNCTION public.es_facilitador(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.es_facilitador_de_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.fcps
    WHERE id = p_fcp_id AND facilitador_id = p_usuario_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_facilitador_de_fcp(UUID, UUID) IS 'Verifica si el usuario es el Facilitador dueño de la FCP (fcps.facilitador_id).';

GRANT EXECUTE ON FUNCTION public.es_facilitador_de_fcp(UUID, UUID) TO authenticated;

-- Paso 5: Políticas RLS fcps
-- ============================================
DROP POLICY IF EXISTS "fcps_select_policy" ON public.fcps;
CREATE POLICY "fcps_select_policy"
ON public.fcps FOR SELECT
USING (
  (facilitador_id = auth.uid())
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.fcp_miembros m
    WHERE m.fcp_id = fcps.id AND m.usuario_id = auth.uid() AND m.activo = true
  )
);

COMMENT ON POLICY "fcps_select_policy" ON public.fcps IS 'Facilitadores ven sus FCPs (facilitador_id). Otros ven las que crearon o donde son miembros.';

DROP POLICY IF EXISTS "fcps_insert_policy" ON public.fcps;
CREATE POLICY "fcps_insert_policy"
ON public.fcps FOR INSERT
TO authenticated
WITH CHECK (
  public.es_facilitador(auth.uid())
  AND facilitador_id = auth.uid()
);

COMMENT ON POLICY "fcps_insert_policy" ON public.fcps IS 'Solo facilitadores pueden crear FCPs; facilitador_id debe ser el usuario actual.';

DROP POLICY IF EXISTS "fcps_update_policy" ON public.fcps;
CREATE POLICY "fcps_update_policy"
ON public.fcps FOR UPDATE
USING (
  (facilitador_id = auth.uid())
  OR public.es_director_o_secretario_fcp(auth.uid(), id)
  OR (created_by = auth.uid())
);

COMMENT ON POLICY "fcps_update_policy" ON public.fcps IS 'Facilitador dueño, directores/secretarios o creador pueden actualizar.';

-- Paso 6: Impedir rol 'facilitador' en fcp_miembros
-- ============================================
CREATE OR REPLACE FUNCTION public.rechazar_rol_facilitador_miembro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol = 'facilitador' THEN
    RAISE EXCEPTION 'El rol Facilitador no se asigna en fcp_miembros. Los facilitadores se gestionan solo en BD y fcps.facilitador_id.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rechazar_rol_facilitador_miembro ON public.fcp_miembros;
CREATE TRIGGER trigger_rechazar_rol_facilitador_miembro
  BEFORE INSERT OR UPDATE OF rol ON public.fcp_miembros
  FOR EACH ROW EXECUTE FUNCTION public.rechazar_rol_facilitador_miembro();

-- Paso 7: Actualizar obtener_rol_fcp / get_rol para facilitador
-- Si el usuario es facilitador dueño de la FCP, se considera 'facilitador' en esa FCP.
-- La app puede seguir usando useUserRole(fcpId) y comprobar fcps.facilitador_id además de fcp_miembros.
-- No modificamos obtener_rol_fcp porque ya no hay facilitador en fcp_miembros; el rol facilitador
-- se obtendrá en la app comprobando facilitadores + fcps.facilitador_id.
