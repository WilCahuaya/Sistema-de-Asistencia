-- ============================================
-- MIGRACIÓN: Corrección limitada del mes anterior por FCP
-- ============================================
-- Requisitos:
-- 1. Facilitador habilita edición del mes anterior para su FCP y define período (3, 5 o 7 días).
-- 2. Solo el SECRETARIO puede editar asistencias del mes anterior durante la ventana de corrección.
-- 3. No se pueden modificar meses más antiguos ni el mes actual en modo corrección.
-- 4. Auditoría de correcciones y marca "Registro tardío" en asistencias modificadas fuera de plazo.

-- ============================================
-- Paso 1: Tabla correccion_mes_fcp
-- ============================================
CREATE TABLE IF NOT EXISTS public.correccion_mes_fcp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fcp_id UUID NOT NULL REFERENCES public.fcps(id) ON DELETE CASCADE,
  anio INT NOT NULL,
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  habilitado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  habilitado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dias_correccion SMALLINT NOT NULL CHECK (dias_correccion IN (3, 5, 7)),
  fecha_limite DATE NOT NULL,
  habilitado_por_nombre TEXT,
  UNIQUE(fcp_id, anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_correccion_mes_fcp_fcp_anio_mes ON public.correccion_mes_fcp(fcp_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_correccion_mes_fcp_fecha_limite ON public.correccion_mes_fcp(fecha_limite);

COMMENT ON TABLE public.correccion_mes_fcp IS 'Ventanas de corrección del mes anterior por FCP. Solo el facilitador puede habilitar.';

-- ============================================
-- Paso 2: Tabla auditoria_correcciones_asistencias
-- ============================================
CREATE TABLE IF NOT EXISTS public.auditoria_correcciones_asistencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rol TEXT NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fcp_id UUID NOT NULL REFERENCES public.fcps(id) ON DELETE CASCADE,
  anio INT NOT NULL,
  mes INT NOT NULL,
  asistencia_id UUID REFERENCES public.asistencias(id) ON DELETE SET NULL,
  accion TEXT NOT NULL CHECK (accion IN ('insert', 'update', 'delete')),
  detalles JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_correcciones_fcp_anio_mes ON public.auditoria_correcciones_asistencias(fcp_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_auditoria_correcciones_fecha ON public.auditoria_correcciones_asistencias(fecha_hora DESC);

COMMENT ON TABLE public.auditoria_correcciones_asistencias IS 'Registro de cada corrección de asistencia en ventana de corrección.';

-- ============================================
-- Paso 3: Columna registro_tardio en asistencias
-- ============================================
ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS registro_tardio BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.asistencias.registro_tardio IS 'True si la asistencia fue creada o modificada en ventana de corrección (mes ya cerrado).';

-- ============================================
-- Paso 4: Función para verificar ventana de corrección activa
-- ============================================
CREATE OR REPLACE FUNCTION public.correccion_activa_mes(p_fcp_id UUID, p_anio INT, p_mes INT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.correccion_mes_fcp c
    WHERE c.fcp_id = p_fcp_id
      AND c.anio = p_anio
      AND c.mes = p_mes
      AND CURRENT_DATE <= c.fecha_limite
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.correccion_activa_mes(UUID, INT, INT) TO authenticated;

-- ============================================
-- Paso 5: Función para comprobar si un mes es el inmediatamente anterior
-- ============================================
CREATE OR REPLACE FUNCTION public.es_mes_inmediatamente_anterior(p_fecha DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_mes_actual DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_mes_anterior DATE := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE;
  v_mes_fecha DATE := DATE_TRUNC('month', p_fecha)::DATE;
BEGIN
  RETURN v_mes_fecha = v_mes_anterior;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.es_mes_inmediatamente_anterior(DATE) TO authenticated;

-- ============================================
-- Paso 6: Reemplazar validar_inmutabilidad_asistencias
-- Permite INSERT/UPDATE/DELETE en mes anterior solo si hay corrección activa y usuario es secretario.
-- ============================================
CREATE OR REPLACE FUNCTION public.validar_inmutabilidad_asistencias()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha_asistencia DATE;
  v_mes_asistencia DATE;
  v_mes_actual DATE;
  v_mes_anterior DATE;
  v_anio INT;
  v_mes INT;
  v_fcp_id UUID;
  v_allow BOOLEAN := false;
BEGIN
  v_mes_actual := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_mes_anterior := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE;

  IF TG_OP = 'DELETE' THEN
    v_fecha_asistencia := OLD.fecha;
    v_fcp_id := OLD.fcp_id;
  ELSE
    v_fecha_asistencia := NEW.fecha;
    v_fcp_id := NEW.fcp_id;
  END IF;

  v_mes_asistencia := DATE_TRUNC('month', v_fecha_asistencia)::DATE;
  v_anio := EXTRACT(YEAR FROM v_fecha_asistencia)::INT;
  v_mes := EXTRACT(MONTH FROM v_fecha_asistencia)::INT;

  -- Mes futuro: siempre permitir
  IF v_mes_asistencia > v_mes_actual THEN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Mes actual: siempre permitir (comportamiento actual)
  IF v_mes_asistencia = v_mes_actual THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.fecha != OLD.fecha THEN
        RAISE EXCEPTION 'No se puede cambiar la fecha de una asistencia existente.';
      END IF;
      IF NEW.aula_id != OLD.aula_id THEN
        RAISE EXCEPTION 'No se puede cambiar el aula_id de una asistencia.';
      END IF;
      IF NEW.estudiante_id != OLD.estudiante_id THEN
        RAISE EXCEPTION 'No se puede cambiar el estudiante_id de una asistencia.';
      END IF;
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Mes anterior: bloquear por defecto
  -- Excepción: corrección activa para (fcp_id, anio, mes) y usuario es secretario de esa FCP
  IF v_mes_asistencia = v_mes_anterior THEN
    IF public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)
       AND public.es_secretario_de_fcp(auth.uid(), v_fcp_id) THEN
      v_allow := true;
    END IF;
  END IF;

  IF NOT v_allow THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'No se pueden eliminar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se pueden registrar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    ELSE
      RAISE EXCEPTION 'No se pueden modificar asistencias de meses anteriores. La asistencia del % pertenece a un mes cerrado.', v_fecha_asistencia;
    END IF;
  END IF;

  -- Corrección permitida: restricciones de UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.fecha != OLD.fecha THEN
      RAISE EXCEPTION 'No se puede cambiar la fecha de una asistencia existente.';
    END IF;
    IF NEW.aula_id != OLD.aula_id THEN
      RAISE EXCEPTION 'No se puede cambiar el aula_id de una asistencia.';
    END IF;
    IF NEW.estudiante_id != OLD.estudiante_id THEN
      RAISE EXCEPTION 'No se puede cambiar el estudiante_id de una asistencia.';
    END IF;
    NEW.registro_tardio := true;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.registro_tardio := true;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Paso 7: Trigger AFTER para auditoría de correcciones
-- ============================================
CREATE OR REPLACE FUNCTION public.auditar_correccion_asistencia()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha DATE;
  v_fcp_id UUID;
  v_anio INT;
  v_mes INT;
  v_uid UUID;
  v_rol TEXT;
  v_accion TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_fecha := OLD.fecha;
    v_fcp_id := OLD.fcp_id;
    v_accion := 'delete';
  ELSE
    v_fecha := NEW.fecha;
    v_fcp_id := NEW.fcp_id;
    v_accion := lower(TG_OP);  -- CHECK espera 'insert','update','delete' en minúsculas
  END IF;

  v_anio := EXTRACT(YEAR FROM v_fecha)::INT;
  v_mes := EXTRACT(MONTH FROM v_fecha)::INT;

  -- Solo auditar si es corrección (mes anterior y registro_tardio o borrado en ventana)
  IF NOT (public.es_mes_inmediatamente_anterior(v_fecha) AND public.correccion_activa_mes(v_fcp_id, v_anio, v_mes)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.es_secretario_de_fcp(v_uid, v_fcp_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT fm.rol::TEXT INTO v_rol
  FROM public.fcp_miembros fm
  WHERE fm.usuario_id = v_uid AND fm.fcp_id = v_fcp_id AND fm.activo = true
  LIMIT 1;

  INSERT INTO public.auditoria_correcciones_asistencias (
    usuario_id, rol, fecha_hora, fcp_id, anio, mes, asistencia_id, accion, detalles
  ) VALUES (
    v_uid,
    COALESCE(v_rol, 'secretario'),
    NOW(),
    v_fcp_id,
    v_anio,
    v_mes,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END,  -- DELETE: la fila ya no existe, FK fallaría
    v_accion,
    jsonb_build_object(
      'estudiante_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.estudiante_id ELSE NEW.estudiante_id END,
      'fecha', v_fecha,
      'estado', CASE WHEN TG_OP = 'DELETE' THEN OLD.estado::TEXT ELSE NEW.estado::TEXT END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auditar_correccion_asistencia ON public.asistencias;
CREATE TRIGGER trigger_auditar_correccion_asistencia
  AFTER INSERT OR UPDATE OR DELETE ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.auditar_correccion_asistencia();

-- ============================================
-- Paso 8: Establecer habilitado_por_nombre al insertar en correccion_mes_fcp
-- ============================================
CREATE OR REPLACE FUNCTION public.set_habilitado_por_nombre_correccion()
RETURNS TRIGGER AS $$
DECLARE
  v_nombre TEXT;
BEGIN
  IF NEW.habilitado_por IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(u.nombre_completo, (au.raw_user_meta_data->>'full_name'), (au.raw_user_meta_data->>'name'), au.email::TEXT)
  INTO v_nombre
  FROM auth.users au
  LEFT JOIN public.usuarios u ON u.id = au.id
  WHERE au.id = NEW.habilitado_por;
  NEW.habilitado_por_nombre := COALESCE(v_nombre, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_habilitado_por_nombre_correccion ON public.correccion_mes_fcp;
CREATE TRIGGER trigger_set_habilitado_por_nombre_correccion
  BEFORE INSERT OR UPDATE OF habilitado_por ON public.correccion_mes_fcp
  FOR EACH ROW
  EXECUTE FUNCTION public.set_habilitado_por_nombre_correccion();

-- ============================================
-- Paso 9: RLS para correccion_mes_fcp
-- ============================================
ALTER TABLE public.correccion_mes_fcp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "correccion_mes_fcp_select" ON public.correccion_mes_fcp;
CREATE POLICY "correccion_mes_fcp_select"
  ON public.correccion_mes_fcp FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fcp_miembros fm
      WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = correccion_mes_fcp.fcp_id
        AND fm.activo = true
    )
  );

DROP POLICY IF EXISTS "correccion_mes_fcp_insert_facilitador" ON public.correccion_mes_fcp;
CREATE POLICY "correccion_mes_fcp_insert_facilitador"
  ON public.correccion_mes_fcp FOR INSERT
  WITH CHECK (
    public.es_facilitador_de_fcp(auth.uid(), fcp_id)
    AND habilitado_por = auth.uid()
  );

-- Solo facilitadores pueden habilitar; no hay UPDATE/DELETE para simplificar.

-- ============================================
-- Paso 10: RLS para auditoria_correcciones_asistencias (solo lectura para roles FCP)
-- ============================================
ALTER TABLE public.auditoria_correcciones_asistencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_correcciones_select" ON public.auditoria_correcciones_asistencias;
CREATE POLICY "auditoria_correcciones_select"
  ON public.auditoria_correcciones_asistencias FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fcp_miembros fm
      WHERE fm.usuario_id = auth.uid()
        AND fm.fcp_id = auditoria_correcciones_asistencias.fcp_id
        AND fm.activo = true
    )
  );

-- Inserts solo vía trigger (SECURITY DEFINER), no por usuario directo.
-- Política de INSERT con USING false efectivamente impide inserts manuales;
-- el trigger corre con definer y puede insertar. No agregamos política INSERT para usuarios.

-- ============================================
-- Paso 11: RPC para habilitar corrección (solo facilitador, solo mes anterior)
-- ============================================
CREATE OR REPLACE FUNCTION public.habilitar_correccion_mes_anterior(
  p_fcp_id UUID,
  p_dias SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_mes_anterior DATE := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE;
  v_anio INT := EXTRACT(YEAR FROM v_mes_anterior)::INT;
  v_mes INT := EXTRACT(MONTH FROM v_mes_anterior)::INT;
  v_limite DATE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;

  IF p_dias IS NULL OR p_dias NOT IN (3, 5, 7) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dias_correccion debe ser 3, 5 o 7');
  END IF;

  IF NOT public.es_facilitador_de_fcp(v_uid, p_fcp_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el facilitador de esta FCP puede habilitar la corrección');
  END IF;

  v_limite := CURRENT_DATE + (p_dias || ' days')::INTERVAL;

  INSERT INTO public.correccion_mes_fcp (fcp_id, anio, mes, habilitado_por, habilitado_at, dias_correccion, fecha_limite)
  VALUES (p_fcp_id, v_anio, v_mes, v_uid, NOW(), p_dias, v_limite)
  ON CONFLICT (fcp_id, anio, mes) DO UPDATE
  SET habilitado_por = EXCLUDED.habilitado_por,
      habilitado_at = EXCLUDED.habilitado_at,
      dias_correccion = EXCLUDED.dias_correccion,
      fecha_limite = EXCLUDED.fecha_limite
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'anio', v_anio,
    'mes', v_mes,
    'fecha_limite', v_limite,
    'dias_correccion', p_dias
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.habilitar_correccion_mes_anterior(UUID, SMALLINT) TO authenticated;
