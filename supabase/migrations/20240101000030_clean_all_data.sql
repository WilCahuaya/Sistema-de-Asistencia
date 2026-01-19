-- ============================================
-- Limpiar todos los datos de la base de datos
-- Elimina todos los registros pero mantiene la estructura
-- ============================================

-- ⚠️ ADVERTENCIA: Esta migración elimina TODOS los datos
-- Asegúrate de hacer un backup antes de ejecutarla
-- Los usuarios de autenticación (auth.users) NO se eliminan

-- Deshabilitar RLS temporalmente para poder eliminar todos los datos
ALTER TABLE public.historial_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_aula DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_ong DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ongs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;

-- Paso 1: Eliminar datos de tablas dependientes (en orden inverso de dependencias)

-- Eliminar historial de movimientos (depende de estudiantes y aulas)
DELETE FROM public.historial_movimientos;

-- Eliminar asistencias (depende de estudiantes y ongs)
DELETE FROM public.asistencias;

-- Eliminar relaciones tutor_aula (depende de aulas y usuario_ong)
DELETE FROM public.tutor_aula;

-- Eliminar estudiantes (depende de aulas y ongs)
DELETE FROM public.estudiantes;

-- Eliminar aulas (depende de ongs)
DELETE FROM public.aulas;

-- Eliminar relaciones usuario_ong (depende de usuarios y ongs)
-- Esto incluye tanto usuarios asignados como invitaciones pendientes (email_pendiente)
DELETE FROM public.usuario_ong;

-- Eliminar ongs (tabla principal)
DELETE FROM public.ongs;

-- Paso 2: Eliminar usuarios personalizados (NO elimina auth.users)
-- NOTA: Esto elimina la tabla usuarios pero NO elimina auth.users (usuarios de autenticación)
-- Los usuarios de autenticación (auth.users) se mantienen para que puedas seguir iniciando sesión
DELETE FROM public.usuarios;

-- Paso 3: Verificar que las tablas estén vacías
DO $$
DECLARE
  total_ongs INTEGER;
  total_aulas INTEGER;
  total_estudiantes INTEGER;
  total_asistencias INTEGER;
  total_usuario_ong INTEGER;
  total_historial INTEGER;
  total_usuarios INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_ongs FROM public.ongs;
  SELECT COUNT(*) INTO total_aulas FROM public.aulas;
  SELECT COUNT(*) INTO total_estudiantes FROM public.estudiantes;
  SELECT COUNT(*) INTO total_asistencias FROM public.asistencias;
  SELECT COUNT(*) INTO total_usuario_ong FROM public.usuario_ong;
  SELECT COUNT(*) INTO total_historial FROM public.historial_movimientos;
  SELECT COUNT(*) INTO total_usuarios FROM public.usuarios;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Limpieza de datos completada';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Registros restantes:';
  RAISE NOTICE '  - FCPs: %', total_ongs;
  RAISE NOTICE '  - Aulas: %', total_aulas;
  RAISE NOTICE '  - Estudiantes: %', total_estudiantes;
  RAISE NOTICE '  - Asistencias: %', total_asistencias;
  RAISE NOTICE '  - Usuario-FCP: %', total_usuario_ong;
  RAISE NOTICE '  - Historial: %', total_historial;
  RAISE NOTICE '  - Usuarios: %', total_usuarios;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NOTA: Los usuarios de autenticación (auth.users) se mantienen';
  RAISE NOTICE '      para que puedas seguir iniciando sesión.';
  RAISE NOTICE '========================================';
  
  IF total_ongs = 0 AND total_aulas = 0 AND total_estudiantes = 0 AND total_asistencias = 0 AND total_usuario_ong = 0 AND total_usuarios = 0 THEN
    RAISE NOTICE '✓ Todas las tablas principales están vacías';
  ELSE
    RAISE WARNING '⚠ Algunas tablas aún contienen datos';
  END IF;
END $$;

-- Rehabilitar RLS después de la limpieza
ALTER TABLE public.historial_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_ong ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

