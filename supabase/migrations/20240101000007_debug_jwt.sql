-- Función helper para debug: verificar si el JWT token está siendo procesado correctamente
-- Esta función puede ser llamada desde el cliente para verificar el estado de autenticación

CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT json_build_object(
        'uid', auth.uid(),
        'role', auth.role(),
        'email', auth.email(),
        'jwt_available', auth.uid() IS NOT NULL
    );
$$;

-- También podemos crear una política temporal que permita insertar sin verificación
-- SOLO PARA DEBUG - ELIMINAR DESPUÉS
-- CREATE POLICY "Temporary debug policy" ON public.ongs FOR INSERT TO authenticated WITH CHECK (true);

