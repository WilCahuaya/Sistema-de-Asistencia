-- ============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================
-- Corrige insertar_miembro_fcp para que un usuario pueda tener múltiples roles en la misma FCP.
-- Antes buscaba solo (usuario_id, fcp_id); ahora busca (usuario_id, fcp_id, rol).

CREATE OR REPLACE FUNCTION public.insertar_miembro_fcp(
    p_fcp_id UUID,
    p_rol TEXT,
    p_usuario_id UUID DEFAULT NULL,
    p_email_pendiente TEXT DEFAULT NULL,
    p_activo BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_miembro JSONB;
    v_existing_id UUID;
    v_existing_activo BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    IF p_usuario_id IS NOT NULL THEN
        SELECT id, activo INTO v_existing_id, v_existing_activo
        FROM public.fcp_miembros
        WHERE fcp_id = p_fcp_id
        AND usuario_id = p_usuario_id
        AND rol = p_rol::rol_type
        LIMIT 1;
    ELSIF p_email_pendiente IS NOT NULL THEN
        SELECT id, activo INTO v_existing_id, v_existing_activo
        FROM public.fcp_miembros
        WHERE fcp_id = p_fcp_id
        AND email_pendiente = p_email_pendiente
        AND rol = p_rol::rol_type
        LIMIT 1;
    END IF;
    
    IF v_existing_id IS NOT NULL THEN
        IF v_existing_activo THEN
            RAISE EXCEPTION 'Este usuario ya tiene el rol de % activo en esta FCP', p_rol;
        ELSE
            UPDATE public.fcp_miembros
            SET rol = p_rol::rol_type,
                activo = true,
                usuario_id = COALESCE(p_usuario_id, usuario_id),
                email_pendiente = CASE WHEN p_usuario_id IS NOT NULL THEN NULL ELSE COALESCE(p_email_pendiente, email_pendiente) END
            WHERE id = v_existing_id
            RETURNING to_jsonb(fcp_miembros.*) INTO v_miembro;
            RETURN v_miembro;
        END IF;
    END IF;
    
    INSERT INTO public.fcp_miembros (
        fcp_id,
        rol,
        usuario_id,
        email_pendiente,
        activo
    ) VALUES (
        p_fcp_id,
        p_rol::rol_type,
        p_usuario_id,
        p_email_pendiente,
        p_activo
    )
    RETURNING to_jsonb(fcp_miembros.*) INTO v_miembro;
    
    RETURN v_miembro;
END;
$$;
