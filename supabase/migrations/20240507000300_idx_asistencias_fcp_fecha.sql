-- Acelera reportes y listados que filtran por FCP y rango de fechas (p. ej. un mes o un año).
CREATE INDEX IF NOT EXISTS idx_asistencias_fcp_fecha ON public.asistencias (fcp_id, fecha);
