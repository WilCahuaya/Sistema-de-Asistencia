-- ============================================
-- SCRIPT DE DATOS DE PRUEBA PARA USUARIOS REALES
-- Genera datos de prueba basados en los roles reales de los usuarios
-- ============================================
-- 
-- IMPORTANTE: Ejecuta primero 20240101000100_consultar_roles_usuarios.sql
-- para ver qué roles tiene cada usuario, luego ajusta este script según sea necesario
--
-- Este script crea:
-- - FCPs de prueba (si no existen)
-- - Aulas para cada FCP
-- - Estudiantes en las aulas
-- - Asistencias del mes actual y anterior
-- - Relaciones tutor-aula (si hay tutores)
-- ============================================

-- ============================================
-- 1. VERIFICAR Y CREAR DATOS PARA USUARIOS REALES
-- ============================================
DO $$
DECLARE
  user_record RECORD;
  fcp_record RECORD;
  aula_record RECORD;
  estudiantes_por_aula INTEGER := 20; -- Cantidad de estudiantes por aula
  estudiante_counter INTEGER;
  codigo_base VARCHAR(50);
  nombres_masculinos TEXT[] := ARRAY['Juan', 'Carlos', 'Miguel', 'Luis', 'Pedro', 'Diego', 'Roberto', 'Fernando', 'Andrés', 'José', 'Manuel', 'Ricardo', 'Francisco', 'Antonio', 'Alejandro'];
  nombres_femeninos TEXT[] := ARRAY['María', 'Ana', 'Laura', 'Sofía', 'Carmen', 'Patricia', 'Elena', 'Isabel', 'Lucía', 'Paula', 'Marta', 'Cristina', 'Beatriz', 'Rosa', 'Diana'];
  apellidos TEXT[] := ARRAY['García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales'];
  nombre_completo TEXT;
  nombre_primero TEXT;
  aula_id_var UUID;
  estudiante_id_var UUID;
  fecha_actual DATE;
  fecha_inicio DATE;
  fecha_fin DATE;
  dia_actual DATE;
  estado_asistencia TEXT;
  estudiantes_marcados INTEGER;
  total_estudiantes INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO CREACIÓN DE DATOS DE PRUEBA';
  RAISE NOTICE '========================================';
  
  -- Para cada usuario real, crear datos según sus roles
  FOR user_record IN 
    SELECT DISTINCT u.id, u.email, u.raw_user_meta_data->>'full_name' as nombre_completo_auth
    FROM auth.users u
    WHERE u.email IN (
      '48217068@continental.edu.pe',
      'i2320674@continental.edu.pe',
      'cahuayaquispew@gmail.com',
      'wcahuayaquispe@gmail.com'
    )
  LOOP
    RAISE NOTICE 'Procesando usuario: % (%)', user_record.email, user_record.id;
    
    -- Asegurar que existe en public.usuarios
    INSERT INTO public.usuarios (id, email, nombre_completo, created_at)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.nombre_completo_auth, SPLIT_PART(user_record.email, '@', 1)),
      NOW() - INTERVAL '1 year'
    )
    ON CONFLICT (id) DO UPDATE 
    SET nombre_completo = COALESCE(EXCLUDED.nombre_completo, public.usuarios.nombre_completo);
    
    -- Para cada FCP donde el usuario tiene un rol
    FOR fcp_record IN
      SELECT DISTINCT f.id, f.razon_social, f.numero_identificacion, fm.rol
      FROM public.fcp_miembros fm
      JOIN public.fcps f ON fm.fcp_id = f.id
      WHERE fm.usuario_id = user_record.id
        AND fm.activo = true
        AND f.activa = true
    LOOP
      RAISE NOTICE '  FCP: % (%), Rol: %', fcp_record.razon_social, fcp_record.numero_identificacion, fcp_record.rol;
      
      -- Verificar si ya hay aulas en esta FCP
      SELECT COUNT(*) INTO total_estudiantes
      FROM public.aulas a
      JOIN public.estudiantes e ON a.id = e.aula_id
      WHERE a.fcp_id = fcp_record.id
        AND a.activa = true
        AND e.activo = true;
      
      -- Si no hay aulas o estudiantes, crear datos de prueba
      IF total_estudiantes = 0 THEN
        RAISE NOTICE '    No hay estudiantes. Creando datos de prueba...';
        
        -- Crear 3 aulas de prueba para esta FCP
        FOR aula_counter IN 1..3 LOOP
          aula_id_var := uuid_generate_v4();
          
          INSERT INTO public.aulas (id, fcp_id, nombre, descripcion, activa, created_at, created_by)
          VALUES (
            aula_id_var,
            fcp_record.id,
            'Aula ' || aula_counter || ' - ' || fcp_record.razon_social,
            'Aula de prueba generada automáticamente',
            true,
            NOW() - INTERVAL '3 months',
            user_record.id
          )
          ON CONFLICT DO NOTHING;
          
          -- Crear estudiantes para esta aula
          codigo_base := 'EST-' || SUBSTRING(fcp_record.numero_identificacion, 1, 6) || '-' || aula_counter || '-';
          
          FOR estudiante_counter IN 1..estudiantes_por_aula LOOP
            -- Determinar género aleatorio
            IF random() < 0.5 THEN
              nombre_primero := nombres_masculinos[1 + floor(random() * array_length(nombres_masculinos, 1))::INTEGER];
            ELSE
              nombre_primero := nombres_femeninos[1 + floor(random() * array_length(nombres_femeninos, 1))::INTEGER];
            END IF;
            
            nombre_completo := nombre_primero || ' ' || apellidos[1 + floor(random() * array_length(apellidos, 1))::INTEGER] || ' ' || apellidos[1 + floor(random() * array_length(apellidos, 1))::INTEGER];
            
            estudiante_id_var := uuid_generate_v4();
            
            INSERT INTO public.estudiantes (id, fcp_id, aula_id, codigo, nombre_completo, activo, created_at, created_by)
            VALUES (
              estudiante_id_var,
              fcp_record.id,
              aula_id_var,
              codigo_base || LPAD(estudiante_counter::TEXT, 3, '0'),
              nombre_completo,
              true,
              NOW() - INTERVAL '6 months' + (random() * INTERVAL '5 months'),
              user_record.id
            )
            ON CONFLICT DO NOTHING;
          END LOOP;
          
          RAISE NOTICE '    Aula % creada con % estudiantes', aula_counter, estudiantes_por_aula;
        END LOOP;
      ELSE
        RAISE NOTICE '    Ya existen estudiantes en esta FCP (% estudiantes). Saltando creación...', total_estudiantes;
      END IF;
      
      -- Crear asistencias para el mes actual y anterior
      -- Obtener todas las aulas activas de esta FCP
      FOR aula_record IN
        SELECT a.id, a.nombre, COUNT(e.id) as total_estudiantes_aula
        FROM public.aulas a
        LEFT JOIN public.estudiantes e ON a.id = e.aula_id AND e.activo = true
        WHERE a.fcp_id = fcp_record.id
          AND a.activa = true
        GROUP BY a.id, a.nombre
        HAVING COUNT(e.id) > 0
      LOOP
        RAISE NOTICE '    Procesando asistencias para aula: % (% estudiantes)', aula_record.nombre, aula_record.total_estudiantes_aula;
        
        -- Mes anterior
        fecha_inicio := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE;
        fecha_fin := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE;
        
        dia_actual := fecha_inicio;
        WHILE dia_actual <= fecha_fin LOOP
          -- Saltar fines de semana
          IF EXTRACT(DOW FROM dia_actual) NOT IN (0, 6) THEN
            -- Determinar si el día será completo o incompleto (70% completos)
            IF random() < 0.7 THEN
              estudiantes_marcados := aula_record.total_estudiantes_aula;
            ELSE
              estudiantes_marcados := GREATEST(1, floor(aula_record.total_estudiantes_aula * (0.6 + random() * 0.3))::INTEGER);
            END IF;
            
            -- Crear asistencias
            FOR estudiante_id_var IN 
              SELECT e.id 
              FROM public.estudiantes e
              WHERE e.aula_id = aula_record.id
                AND e.activo = true
                AND e.created_at <= dia_actual
              ORDER BY random()
              LIMIT estudiantes_marcados
            LOOP
              -- Determinar estado (70% presente, 20% faltó, 10% permiso)
              IF random() < 0.7 THEN
                estado_asistencia := 'presente';
              ELSIF random() < 0.9 THEN
                estado_asistencia := 'falto';
              ELSE
                estado_asistencia := 'permiso';
              END IF;
              
              INSERT INTO public.asistencias (id, fcp_id, estudiante_id, fecha, estado, created_at, created_by)
              VALUES (
                uuid_generate_v4(),
                fcp_record.id,
                estudiante_id_var,
                dia_actual,
                estado_asistencia::estado_asistencia,
                NOW() - INTERVAL '1 month' + (random() * INTERVAL '1 day'),
                user_record.id
              )
              ON CONFLICT (estudiante_id, fecha) DO NOTHING;
            END LOOP;
          END IF;
          
          dia_actual := dia_actual + INTERVAL '1 day';
        END LOOP;
        
        -- Mes actual (hasta hoy)
        fecha_inicio := DATE_TRUNC('month', CURRENT_DATE)::DATE;
        fecha_fin := CURRENT_DATE;
        
        dia_actual := fecha_inicio;
        WHILE dia_actual <= fecha_fin LOOP
          -- Saltar fines de semana
          IF EXTRACT(DOW FROM dia_actual) NOT IN (0, 6) THEN
            -- 80% de días completos en el mes actual
            IF random() < 0.8 THEN
              estudiantes_marcados := aula_record.total_estudiantes_aula;
            ELSE
              estudiantes_marcados := GREATEST(1, floor(aula_record.total_estudiantes_aula * (0.7 + random() * 0.2))::INTEGER);
            END IF;
            
            FOR estudiante_id_var IN 
              SELECT e.id 
              FROM public.estudiantes e
              WHERE e.aula_id = aula_record.id
                AND e.activo = true
                AND e.created_at <= dia_actual
              ORDER BY random()
              LIMIT estudiantes_marcados
            LOOP
              IF random() < 0.75 THEN
                estado_asistencia := 'presente';
              ELSIF random() < 0.9 THEN
                estado_asistencia := 'falto';
              ELSE
                estado_asistencia := 'permiso';
              END IF;
              
              INSERT INTO public.asistencias (id, fcp_id, estudiante_id, fecha, estado, created_at, created_by)
              VALUES (
                uuid_generate_v4(),
                fcp_record.id,
                estudiante_id_var,
                dia_actual,
                estado_asistencia::estado_asistencia,
                NOW() - (CURRENT_DATE - dia_actual) + (random() * INTERVAL '1 hour'),
                user_record.id
              )
              ON CONFLICT (estudiante_id, fecha) DO NOTHING;
            END LOOP;
          END IF;
          
          dia_actual := dia_actual + INTERVAL '1 day';
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CREACIÓN DE DATOS COMPLETADA';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- RESUMEN DE DATOS CREADOS
-- ============================================
SELECT 
  u.email,
  f.razon_social as fcp,
  COUNT(DISTINCT a.id) as total_aulas,
  COUNT(DISTINCT e.id) as total_estudiantes,
  COUNT(DISTINCT ast.fecha) as dias_con_asistencia,
  COUNT(ast.id) as total_asistencias
FROM auth.users u
JOIN public.fcp_miembros fm ON u.id = fm.usuario_id AND fm.activo = true
JOIN public.fcps f ON fm.fcp_id = f.id AND f.activa = true
LEFT JOIN public.aulas a ON f.id = a.fcp_id AND a.activa = true
LEFT JOIN public.estudiantes e ON a.id = e.aula_id AND e.activo = true
LEFT JOIN public.asistencias ast ON e.id = ast.estudiante_id
WHERE u.email IN (
  '48217068@continental.edu.pe',
  'i2320674@continental.edu.pe',
  'cahuayaquispew@gmail.com',
  'wcahuayaquispe@gmail.com'
)
GROUP BY u.email, f.razon_social
ORDER BY u.email, f.razon_social;

