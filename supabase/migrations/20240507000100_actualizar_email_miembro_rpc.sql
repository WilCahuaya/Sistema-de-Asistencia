-- ============================================
-- RPC: Director/secretario/facilitador actualiza email en public.usuarios
-- para un miembro de la FCP (evita depender de políticas RLS UPDATE en usuarios).
-- ============================================

CREATE OR REPLACE FUNCTION public.actualizar_email_usuario_miembro_fcp(
  p_fcp_id uuid,
  p_usuario_id uuid,
  p_nuevo_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email text;
  v_es_director boolean;
  v_es_sec boolean;
  v_es_fac boolean;
  v_sec_puede_miembro boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_email := lower(trim(p_nuevo_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'El correo es obligatorio';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Formato de correo inválido';
  END IF;

  v_es_fac := public.es_facilitador(v_caller);
  v_es_director := public.es_director_de_fcp(v_caller, p_fcp_id);
  v_es_sec := public.es_secretario_de_fcp(v_caller, p_fcp_id);

  IF NOT v_es_fac AND NOT v_es_director AND NOT v_es_sec THEN
    RAISE EXCEPTION 'Sin permiso para actualizar correos en esta FCP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.fcp_miembros
    WHERE fcp_id = p_fcp_id AND usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a esta FCP';
  END IF;

  IF v_es_sec AND NOT v_es_director AND NOT v_es_fac THEN
    v_sec_puede_miembro :=
      (p_usuario_id = v_caller)
      OR EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        WHERE fm.fcp_id = p_fcp_id
          AND fm.usuario_id = p_usuario_id
          AND fm.rol = 'tutor'
          AND fm.activo = true
      );
    IF NOT v_sec_puede_miembro THEN
      RAISE EXCEPTION 'Como secretario solo puedes cambiar el correo de tutores o el tuyo propio';
    END IF;
  END IF;

  UPDATE public.usuarios u
  SET email = v_email
  WHERE u.id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado en usuarios';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_email_usuario_miembro_fcp(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.actualizar_email_usuario_miembro_fcp(uuid, uuid, text) IS
'Actualiza el email en public.usuarios para un miembro de la FCP. Respeta las mismas reglas que la edición de fcp_miembros (secretario: tutores o sí mismo).';
