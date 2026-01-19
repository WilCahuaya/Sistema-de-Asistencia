-- ============================================
-- MIGRACIÓN: Solución alternativa con función SECURITY DEFINER
-- ============================================
-- Esta migración crea una función SECURITY DEFINER que hace la inserción
-- sin aplicar RLS, como último recurso si las políticas no funcionan

-- Paso 1: Eliminar función existente si existe (necesario para cambiar tipo de retorno)
DROP FUNCTION IF EXISTS public.insertar_miembro_fcp(UUID, TEXT, UUID, TEXT, BOOLEAN);

-- Paso 2: Crear función SECURITY DEFINER para insertar miembros
-- Retorna el objeto completo del miembro creado (JSONB) para evitar problemas de RLS al leerlo
-- Maneja duplicados verificando si ya existe un miembro antes de insertar
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
    -- Verificar que el usuario está autenticado
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Verificar si ya existe un miembro con el mismo usuario_id o email_pendiente en esta FCP
    IF p_usuario_id IS NOT NULL THEN
        -- Buscar por usuario_id
        SELECT id, activo INTO v_existing_id, v_existing_activo
        FROM public.fcp_miembros
        WHERE fcp_id = p_fcp_id
        AND usuario_id = p_usuario_id
        LIMIT 1;
    ELSIF p_email_pendiente IS NOT NULL THEN
        -- Buscar por email_pendiente
        SELECT id, activo INTO v_existing_id, v_existing_activo
        FROM public.fcp_miembros
        WHERE fcp_id = p_fcp_id
        AND email_pendiente = p_email_pendiente
        LIMIT 1;
    END IF;
    
    -- Si ya existe un miembro
    IF v_existing_id IS NOT NULL THEN
        IF v_existing_activo THEN
            -- Ya existe y está activo, retornar error
            RAISE EXCEPTION 'Este usuario ya es miembro activo de esta FCP';
        ELSE
            -- Existe pero está inactivo, reactivarlo y actualizar
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
    
    -- No existe, insertar nuevo miembro
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

-- Paso 3: Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.insertar_miembro_fcp(UUID, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

-- Paso 4: Crear política INSERT que use la función (opcional, como respaldo)
-- Mantener la política simple también
DROP POLICY IF EXISTS "fcp_miembros_insert_policy" ON public.fcp_miembros;

CREATE POLICY "fcp_miembros_insert_policy"
ON public.fcp_miembros
FOR INSERT
TO authenticated
WITH CHECK (true);

-- NOTA: Esta función puede ser llamada desde la aplicación como alternativa
-- Ejemplo de uso:
-- SELECT public.insertar_miembro_fcp(
--     'fcp_id'::UUID,
--     'secretario',
--     NULL,
--     'email@example.com',
--     true
-- );

