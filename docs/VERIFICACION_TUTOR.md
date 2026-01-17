# Guía de Verificación de Acceso para Tutores

## Problema
Si un tutor ve 0 aulas y 0 estudiantes aunque tiene asignaciones en la base de datos, sigue estos pasos para verificar y corregir.

## Paso 1: Verificar Asignaciones en la Base de Datos

Ejecuta esta consulta en el SQL Editor de Supabase para ver las asignaciones del tutor:

```sql
-- Reemplaza 'ID_DEL_USUARIO' con el ID del usuario tutor
-- Puedes obtenerlo desde auth.users o desde la tabla usuarios
SELECT 
    u.email,
    uo.id as usuario_ong_id,
    uo.ong_id,
    uo.rol,
    uo.activo as usuario_ong_activo,
    o.nombre as ong_nombre,
    ta.id as tutor_aula_id,
    ta.aula_id,
    ta.ong_id as tutor_aula_ong_id,
    ta.activo as tutor_aula_activo,
    a.nombre as aula_nombre,
    a.activa as aula_activa
FROM public.usuarios u
JOIN public.usuario_ong uo ON uo.usuario_id = u.id
JOIN public.ongs o ON o.id = uo.ong_id
LEFT JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
LEFT JOIN public.aulas a ON a.id = ta.aula_id
WHERE u.email = '48217068@continental.edu.pe'  -- Email del tutor
AND uo.activo = true;
```

## Paso 2: Verificar que tutor_aula tenga ong_id

Si `tutor_aula_ong_id` es NULL, ejecuta esta consulta para corregirlo:

```sql
-- Actualizar ong_id en tutor_aula si falta
UPDATE public.tutor_aula ta
SET ong_id = uo.ong_id
FROM public.usuario_ong uo
WHERE ta.usuario_ong_id = uo.id
AND ta.ong_id IS NULL;
```

## Paso 3: Verificar Políticas RLS

Ejecuta la función de verificación para ver qué puede ver el tutor:

```sql
-- Reemplaza con el ID del usuario y el ID de la ONG
SELECT * FROM public.verify_tutor_access(
    'ID_DEL_USUARIO'::uuid,
    'ID_DE_LA_ONG'::uuid
);
```

Esta función mostrará:
- `total`: Total de aulas/estudiantes en la ONG
- `asignadas`: Cantidad asignada al tutor
- `puede_ver`: Cantidad que el tutor puede ver según RLS

## Paso 4: Verificar que las Políticas RLS estén Activas

```sql
-- Verificar que RLS esté habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('aulas', 'estudiantes', 'tutor_aula');

-- Verificar políticas existentes
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('aulas', 'estudiantes');
```

## Paso 5: Si las Políticas RLS no Están Funcionando

1. Ejecuta las migraciones en orden:
   - `20240101000017_create_tutor_aula_relationship.sql`
   - `20240101000018_update_rls_for_tutor_classrooms.sql`
   - `20240101000019_ensure_tutors_can_view_classrooms.sql`
   - `20240101000021_add_ong_id_to_tutor_aula.sql`
   - `20240101000022_fix_tutor_assignments_verification.sql`

2. Verifica que el trigger sincronice `ong_id` correctamente:
```sql
-- Verificar que el trigger existe
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tutor_aula'
AND trigger_name = 'trigger_sync_tutor_aula_ong_id';
```

## Paso 6: Crear Asignación Manualmente (si es necesario)

Si las asignaciones no existen, créalas manualmente:

```sql
-- Primero obtén el usuario_ong_id del tutor
SELECT uo.id as usuario_ong_id, uo.ong_id, a.id as aula_id
FROM public.usuario_ong uo
JOIN public.aulas a ON a.ong_id = uo.ong_id
WHERE uo.usuario_id = 'ID_DEL_USUARIO'::uuid
AND uo.rol = 'tutor'
AND uo.activo = true
AND a.activa = true;

-- Luego inserta la asignación
INSERT INTO public.tutor_aula (usuario_ong_id, aula_id, ong_id, activo)
VALUES (
    'USUARIO_ONG_ID'::uuid,
    'AULA_ID'::uuid,
    'ONG_ID'::uuid,
    true
);
```

## Paso 7: Verificar que auth.uid() Funcione

```sql
-- Ejecutar como el usuario tutor (en el contexto de una sesión autenticada)
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    auth.email() as email;
```

Si `auth.uid()` devuelve NULL, el problema es de autenticación/JWT, no de RLS.

## Solución Rápida

Si todo lo anterior no funciona, ejecuta esta consulta para ver todas las asignaciones y verificar manualmente:

```sql
-- Vista completa de asignaciones de tutores
SELECT 
    u.email,
    uo.ong_id,
    o.nombre as ong_nombre,
    uo.rol,
    a.id as aula_id,
    a.nombre as aula_nombre,
    ta.id as tutor_aula_id,
    ta.activo as asignacion_activa,
    ta.ong_id as asignacion_ong_id,
    (SELECT COUNT(*) FROM public.estudiantes e 
     WHERE e.aula_id = a.id AND e.activo = true) as estudiantes_en_aula
FROM public.usuarios u
JOIN public.usuario_ong uo ON uo.usuario_id = u.id
JOIN public.ongs o ON o.id = uo.ong_id
JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
JOIN public.aulas a ON a.id = ta.aula_id
WHERE uo.rol = 'tutor'
AND uo.activo = true
ORDER BY u.email, o.nombre, a.nombre;
```

