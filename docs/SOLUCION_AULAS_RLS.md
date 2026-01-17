# Solución: No se pueden ver aulas como Facilitador, Secretario o Tutor

## Problema
Los usuarios con cualquier rol (facilitador, secretario o tutor) no pueden ver aulas, aunque existen en la base de datos.

## Solución Implementada

### 1. Migración de Políticas RLS
Se creó la migración `20240101000024_fix_aulas_rls_all_roles.sql` que:
- ✅ Elimina y recrea todas las políticas RLS para aulas
- ✅ Verifica que RLS esté habilitado
- ✅ Crea políticas correctas para SELECT, INSERT, UPDATE, DELETE
- ✅ Incluye función de debug para verificar acceso

### 2. Cliente de Supabase Simplificado
Se actualizó `lib/supabase/client.ts` para usar la implementación estándar de `@supabase/ssr` que maneja automáticamente las cookies del navegador.

## Pasos para Resolver

### Paso 1: Ejecutar la Migración
1. Abre el **SQL Editor** de Supabase
2. Copia y ejecuta el contenido completo de:
   ```
   supabase/migrations/20240101000024_fix_aulas_rls_all_roles.sql
   ```
3. Verifica que la migración se ejecutó sin errores

### Paso 2: Verificar que RLS esté Habilitado
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'aulas';
```
**Resultado esperado:** `rowsecurity = true`

### Paso 3: Verificar Políticas Creadas
```sql
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'aulas'
ORDER BY cmd, policyname;
```
**Resultado esperado:** Deberías ver al menos 4 políticas:
- `Users can view classrooms of their ONGs` (SELECT)
- `Facilitators and Secretaries can create classrooms` (INSERT)
- `Facilitators and Secretaries can update classrooms` (UPDATE)
- `Facilitators and Secretaries can delete classrooms` (DELETE)

### Paso 4: Verificar Acceso con Función de Debug
```sql
-- Reemplaza 'AULA_ID' con el ID de una aula existente
-- Puedes obtenerlo de la tabla aulas
SELECT * FROM public.debug_aulas_access('AULA_ID'::uuid);
```
Esta función mostrará si el usuario actual tiene acceso al aula y por qué.

### Paso 5: Verificar que auth.uid() Funcione
```sql
-- Ejecutar desde el contexto de una sesión autenticada
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    auth.email() as email;
```
**Importante:** Si `auth.uid()` devuelve NULL, el problema está en la autenticación/JWT, no en las políticas RLS.

### Paso 6: Recargar la Aplicación
1. Cierra completamente el navegador o usa modo incógnito
2. Inicia sesión nuevamente
3. Ve a la página de Aulas
4. Abre la consola del navegador (F12) y verifica:
   - Si hay errores en la consola
   - Los logs que muestran "Cargando aulas para ONG: ..."
   - Si encuentra aulas o muestra error

## Verificación de Políticas RLS

### Para Facilitadores y Secretarios
Las políticas deberían permitir ver TODAS las aulas de sus ONGs:
```sql
-- Verificar que un facilitador puede ver aulas
SELECT COUNT(*) 
FROM public.aulas a
WHERE EXISTS (
    SELECT 1 FROM public.usuario_ong uo
    WHERE uo.usuario_id = 'USER_ID'::uuid  -- Reemplaza con el ID del facilitador
    AND uo.ong_id = a.ong_id
    AND uo.rol IN ('facilitador', 'secretario')
    AND uo.activo = true
)
AND a.activa = true;
```

### Para Tutores
Las políticas deberían permitir ver SOLO las aulas asignadas:
```sql
-- Verificar que un tutor puede ver sus aulas asignadas
SELECT COUNT(*) 
FROM public.aulas a
WHERE EXISTS (
    SELECT 1 FROM public.usuario_ong uo
    JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id
    WHERE uo.usuario_id = 'USER_ID'::uuid  -- Reemplaza con el ID del tutor
    AND uo.ong_id = a.ong_id
    AND uo.rol = 'tutor'
    AND uo.activo = true
    AND ta.aula_id = a.id
    AND ta.activo = true
    AND ta.ong_id = a.ong_id
)
AND a.activa = true;
```

## Problemas Comunes

### 1. Error: "new row violates row-level security policy"
**Causa:** Las políticas RLS no permiten la operación
**Solución:** Verificar que las políticas INSERT/UPDATE/DELETE estén correctamente configuradas

### 2. auth.uid() devuelve NULL
**Causa:** El token JWT no está disponible o no se está pasando correctamente
**Solución:** 
- Verificar que las cookies de autenticación estén presentes en el navegador
- Verificar que el middleware esté refrescando la sesión correctamente
- Cerrar sesión y volver a iniciar sesión

### 3. Las políticas no se aplican
**Causa:** RLS no está habilitado en la tabla
**Solución:** Ejecutar `ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;`

### 4. Error de renderizado en Next.js
**Causa:** Un componente está lanzando un error
**Solución:** Revisar la consola del navegador para ver el error completo

## Si el Problema Persiste

1. **Verificar Logs del Servidor Next.js:**
   - Revisa la terminal donde está corriendo `npm run dev`
   - Busca errores relacionados con Supabase o RLS

2. **Verificar Cookies en el Navegador:**
   - Abre DevTools (F12) > Application > Cookies
   - Busca cookies que empiecen con `sb-` seguido del nombre de tu proyecto Supabase
   - Verifica que existan y no estén expiradas

3. **Ejecutar Consultas de Diagnóstico:**
   - Usa las queries en `docs/QUERY_DIAGNOSTICO_TUTOR.sql`
   - Usa las queries en `docs/VERIFICAR_RLS.sql`

4. **Contactar Soporte:**
   - Si nada funciona, comparte:
     - Los resultados de las queries de verificación
     - Los errores de la consola del navegador
     - Los logs del servidor Next.js

