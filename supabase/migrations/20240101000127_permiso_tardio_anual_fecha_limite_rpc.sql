-- Fecha límite del permiso anual vigente (para mostrar en UI)
CREATE OR REPLACE FUNCTION public.permiso_tardio_anual_fecha_limite(p_fcp_id UUID)
RETURNS DATE AS $$
  SELECT p.fecha_limite
  FROM public.permiso_tardio_anual_fcp p
  WHERE p.fcp_id = p_fcp_id
    AND p.anio = EXTRACT(YEAR FROM CURRENT_DATE)::INT
    AND CURRENT_DATE <= p.fecha_limite
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.permiso_tardio_anual_fecha_limite(UUID) TO authenticated;
