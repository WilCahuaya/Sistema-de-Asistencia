-- ============================================
-- SCRIPT: Limpiar todos los datos de la base de datos
-- ============================================
-- Para empezar a usar la aplicación desde cero después de las pruebas.
--
-- ⚠️ ADVERTENCIA: Este script elimina TODOS los datos de negocio.
-- Los usuarios de autenticación (auth.users) NO se eliminan.
-- Podrás seguir iniciando sesión con las mismas cuentas.
--
-- Cómo ejecutar:
-- 1. Ve al Dashboard de Supabase → SQL Editor
-- 2. Pega este script
-- 3. Haz clic en "Run"
-- ============================================

-- Deshabilitar RLS temporalmente
ALTER TABLE IF EXISTS public.auditoria_correcciones_asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.correccion_mes_fcp DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.historial_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tutor_aula DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estudiantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.aulas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fcp_miembros DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.facilitadores DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fcps DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarios DISABLE ROW LEVEL SECURITY;

-- Deshabilitar triggers que bloquean la eliminación (mes cerrado, auditoría)
DROP TRIGGER IF EXISTS trigger_validar_inmutabilidad_asistencias ON public.asistencias;
DROP TRIGGER IF EXISTS trigger_auditar_correccion_asistencia ON public.asistencias;

-- Eliminar en orden (respetando dependencias)
DELETE FROM public.auditoria_correcciones_asistencias;
DELETE FROM public.correccion_mes_fcp;
DELETE FROM public.historial_movimientos;
DELETE FROM public.asistencias;
DELETE FROM public.tutor_aula;
DELETE FROM public.estudiantes;
DELETE FROM public.aulas;
DELETE FROM public.fcp_miembros;
DELETE FROM public.facilitadores;
DELETE FROM public.fcps;
DELETE FROM public.usuarios;

-- Recrear triggers de asistencias
CREATE TRIGGER trigger_validar_inmutabilidad_asistencias
  BEFORE INSERT OR UPDATE OR DELETE ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_inmutabilidad_asistencias();

CREATE TRIGGER trigger_auditar_correccion_asistencia
  AFTER INSERT OR UPDATE OR DELETE ON public.asistencias
  FOR EACH ROW
  EXECUTE FUNCTION public.auditar_correccion_asistencia();

-- Rehabilitar RLS
ALTER TABLE IF EXISTS public.auditoria_correcciones_asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.correccion_mes_fcp ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.historial_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tutor_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fcp_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.facilitadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fcps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarios ENABLE ROW LEVEL SECURITY;

-- Verificación
DO $$
DECLARE
  v_auditoria INTEGER;
  v_correccion INTEGER;
  v_historial INTEGER;
  v_asistencias INTEGER;
  v_tutor_aula INTEGER;
  v_estudiantes INTEGER;
  v_aulas INTEGER;
  v_fcp_miembros INTEGER;
  v_facilitadores INTEGER;
  v_fcps INTEGER;
  v_usuarios INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_auditoria FROM public.auditoria_correcciones_asistencias;
  SELECT COUNT(*) INTO v_correccion FROM public.correccion_mes_fcp;
  SELECT COUNT(*) INTO v_historial FROM public.historial_movimientos;
  SELECT COUNT(*) INTO v_asistencias FROM public.asistencias;
  SELECT COUNT(*) INTO v_tutor_aula FROM public.tutor_aula;
  SELECT COUNT(*) INTO v_estudiantes FROM public.estudiantes;
  SELECT COUNT(*) INTO v_aulas FROM public.aulas;
  SELECT COUNT(*) INTO v_fcp_miembros FROM public.fcp_miembros;
  SELECT COUNT(*) INTO v_facilitadores FROM public.facilitadores;
  SELECT COUNT(*) INTO v_fcps FROM public.fcps;
  SELECT COUNT(*) INTO v_usuarios FROM public.usuarios;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Limpieza completada';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Auditoría correcciones: %', v_auditoria;
  RAISE NOTICE '  Corrección mes FCP: %', v_correccion;
  RAISE NOTICE '  Historial movimientos: %', v_historial;
  RAISE NOTICE '  Asistencias: %', v_asistencias;
  RAISE NOTICE '  Tutor-Aula: %', v_tutor_aula;
  RAISE NOTICE '  Estudiantes: %', v_estudiantes;
  RAISE NOTICE '  Aulas: %', v_aulas;
  RAISE NOTICE '  FCP Miembros: %', v_fcp_miembros;
  RAISE NOTICE '  Facilitadores: %', v_facilitadores;
  RAISE NOTICE '  FCPs: %', v_fcps;
  RAISE NOTICE '  Usuarios: %', v_usuarios;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'auth.users se mantiene: podrás iniciar sesión.';
  RAISE NOTICE 'Usuarios se recrearán al iniciar sesión (trigger).';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos pasos:';
  RAISE NOTICE '1. Asigna un facilitador (ver docs/CAMBIAR_FACILITADOR.md)';
  RAISE NOTICE '2. Crea tu primera FCP desde la aplicación';
  RAISE NOTICE '3. (Opcional) Elimina usuarios de prueba en Auth';
  RAISE NOTICE '   Dashboard → Authentication → Users';
  RAISE NOTICE '========================================';
END $$;
