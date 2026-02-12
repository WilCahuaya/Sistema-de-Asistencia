-- ============================================
-- Agregar nombre_display a fcp_miembros
-- Permite indicar el nombre del miembro al crear/editar,
-- útil cuando se agrega con email de un conocido
-- ============================================

ALTER TABLE public.fcp_miembros
  ADD COLUMN IF NOT EXISTS nombre_display TEXT;

COMMENT ON COLUMN public.fcp_miembros.nombre_display IS 'Nombre a mostrar del miembro. Útil cuando se agrega por email de un conocido. Si está vacío, se usa usuarios.nombre_completo.';

-- Eliminar la versión anterior (5 parámetros) antes de crear la nueva con nombre_display
DROP FUNCTION IF EXISTS public.insertar_miembro_fcp(UUID, TEXT, UUID, TEXT, BOOLEAN);

-- Crear insertar_miembro_fcp con nombre_display
CREATE OR REPLACE FUNCTION public.insertar_miembro_fcp(
    p_fcp_id UUID,
    p_rol TEXT,
    p_usuario_id UUID DEFAULT NULL,
    p_email_pendiente TEXT DEFAULT NULL,
    p_activo BOOLEAN DEFAULT true,
    p_nombre_display TEXT DEFAULT NULL
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
                email_pendiente = CASE WHEN p_usuario_id IS NOT NULL THEN NULL ELSE COALESCE(p_email_pendiente, email_pendiente) END,
                nombre_display = NULLIF(TRIM(p_nombre_display), '')
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
        activo,
        nombre_display
    ) VALUES (
        p_fcp_id,
        p_rol::rol_type,
        p_usuario_id,
        p_email_pendiente,
        p_activo,
        NULLIF(TRIM(p_nombre_display), '')
    )
    RETURNING to_jsonb(fcp_miembros.*) INTO v_miembro;
    
    RETURN v_miembro;
END;
$$;

COMMENT ON FUNCTION public.insertar_miembro_fcp(UUID, TEXT, UUID, TEXT, BOOLEAN, TEXT) IS 
'Inserta o reactiva un miembro en una FCP. nombre_display opcional para mostrar nombre cuando se agrega por email de un conocido.';
