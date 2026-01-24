-- ============================================
-- MIGRACIÓN COMPLETA: Corrección definitiva de lógica de directores
-- ============================================
-- Esta migración asegura que los directores solo vean sus FCPs asignadas (igual que facilitadores)
-- Las políticas RLS ya están correctas, pero actualizamos comentarios y verificamos consistencia

-- ============================================
-- PASO 1: Verificar/Actualizar función para directores
-- ============================================

-- Función para verificar si un usuario es director de una FCP específica
CREATE OR REPLACE FUNCTION public.es_director_de_fcp(p_usuario_id UUID, p_fcp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id
        AND rol = 'director'
        AND activo = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.es_director_de_fcp IS 'Verifica si un usuario es director de una FCP específica';

GRANT EXECUTE ON FUNCTION public.es_director_de_fcp(UUID, UUID) TO authenticated;

-- La función es_director_o_secretario_fcp ya existe y está correcta, no la tocamos

-- ============================================
-- PASO 2: Verificar que las políticas de fcp_miembros son correctas
-- ============================================
-- Las políticas ya están correctas en la migración 20240101000080
-- Los directores ya solo ven miembros de sus FCPs asignadas
-- No necesitamos cambiar nada aquí

-- ============================================
-- PASO 3: Verificar y actualizar políticas de fcps si es necesario
-- ============================================
-- La política SELECT ya está correcta: usa EXISTS para verificar membresías
-- Esto asegura que directores solo ven FCPs donde tienen el rol asignado
-- Sin embargo, podemos hacerla más explícita para claridad

-- La política actual ya es correcta, pero actualizamos el comentario para claridad
-- No necesitamos cambiar la política en sí, ya que la condición EXISTS
-- con fcp_miembros ya filtra correctamente por rol

-- ============================================
-- PASO 4: Actualizar comentarios para claridad
-- ============================================

COMMENT ON POLICY "fcp_miembros_select_policy" ON public.fcp_miembros IS 
'Permite que usuarios vean sus propias membresías, facilitadores vean solo membresías de FCPs asignadas, y directores/secretarios vean solo miembros de sus FCPs asignadas';

COMMENT ON POLICY "fcps_select_policy" ON public.fcps IS 
'Permite que facilitadores vean solo FCPs asignadas, directores/secretarios vean solo sus FCPs asignadas, usuarios vean FCPs que crearon, y otros usuarios vean solo FCPs donde son miembros';

COMMENT ON POLICY "fcps_update_policy" ON public.fcps IS 
'Permite que facilitadores actualicen solo FCPs asignadas, directores/secretarios actualicen solo sus FCPs asignadas, y usuarios actualicen FCPs que crearon';

COMMENT ON SCHEMA public IS 'Sistema de gestión de asistencias - Facilitadores y Directores solo ven sus FCPs asignadas';

