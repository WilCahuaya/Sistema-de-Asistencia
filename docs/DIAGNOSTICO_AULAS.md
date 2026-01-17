# Diagnóstico: Aulas no se muestran en Dashboard ni en Página de Aulas

## Problema Identificado

`auth.uid()` devuelve `NULL`, lo que hace que todas las políticas RLS fallen y no se muestren aulas en ninguna vista.

## Causas Posibles

1. **JWT token no se está pasando correctamente desde el cliente**
   - Las cookies no se están leyendo correctamente en el navegador
   - Las cookies están marcadas como `httpOnly` (no legibles por JavaScript)

2. **Migraciones RLS no se han ejecutado**
   - Las políticas RLS pueden estar incorrectas o no existir
   - La función `get_dashboard_stats` puede no existir

3. **Problema en el flujo de autenticación**
   - El callback de OAuth no está estableciendo cookies correctamente
   - El middleware no está refrescando la sesión correctamente

## Pasos de Diagnóstico

### 1. Verificar que el usuario está autenticado

Ejecutar en la consola del navegador (DevTools > Console):
```javascript
// Desde cualquier página después de iniciar sesión
fetch('/api/debug/auth')
  .then(r => r.json())
  .then(console.log)
```

O ejecutar directamente en el código:
```typescript
const supabase = createClient()
const { data: { user }, error } = await supabase.auth.getUser()
console.log('User:', user?.id, 'Error:', error)
```

### 2. Verificar cookies en el navegador

1. Abrir DevTools (F12)
2. Ir a **Application** > **Cookies** > `http://localhost:3000`
3. Buscar cookies que empiecen con `sb-` seguido de tu proyecto Supabase
4. Verificar que **NO** estén marcadas como `HttpOnly`
5. Verificar que tengan un valor (no vacías)

### 3. Verificar políticas RLS en Supabase

Ejecutar en el SQL Editor de Supabase:
```sql
-- Verificar que las políticas RLS existan para aulas
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
WHERE tablename = 'aulas'
ORDER BY policyname;
```

### 4. Verificar función RPC get_dashboard_stats

```sql
-- Verificar que la función exista
SELECT 
    proname,
    proargnames,
    proargtypes::regtype[],
    prosecdef
FROM pg_proc
WHERE proname = 'get_dashboard_stats';

-- Probar la función (como usuario autenticado)
SELECT * FROM get_dashboard_stats(NULL);
```

### 5. Verificar acceso del usuario a aulas

```sql
-- Reemplazar 'EMAIL_DEL_USUARIO' con el email del usuario actual
SELECT 
    u.email,
    uo.rol,
    uo.ong_id,
    o.nombre as ong_nombre,
    COUNT(DISTINCT a.id) as total_aulas,
    CASE 
        WHEN uo.rol = 'tutor' THEN 
            COUNT(DISTINCT ta.aula_id)
        ELSE 
            COUNT(DISTINCT a.id)
    END as aulas_visibles
FROM auth.users u
JOIN public.usuario_ong uo ON uo.usuario_id = u.id
JOIN public.ongs o ON o.id = uo.ong_id
LEFT JOIN public.aulas a ON a.ong_id = uo.ong_id AND a.activa = true
LEFT JOIN public.tutor_aula ta ON ta.usuario_ong_id = uo.id AND ta.activo = true
WHERE u.email = 'EMAIL_DEL_USUARIO'
AND uo.activo = true
GROUP BY u.email, uo.rol, uo.ong_id, o.nombre;
```

### 6. Verificar auth.uid() directamente

Ejecutar en el SQL Editor (ejecutado como el usuario autenticado):
```sql
SELECT auth.uid() as user_id;
```

Si devuelve `NULL`, el problema está en la autenticación/JWT.

## Soluciones

### Solución 1: Corregir lectura de cookies en cliente

El cliente del navegador ya está actualizado para leer cookies manualmente. Sin embargo, `@supabase/ssr` debería manejar esto automáticamente.

**Opción A: Usar implementación automática de @supabase/ssr**
```typescript
// En lib/supabase/client.ts
return createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  // Sin configuración de cookies - dejar que @supabase/ssr lo maneje
)
```

**Opción B: Verificar que las cookies no sean httpOnly**
- En `app/auth/callback/route.ts`, asegurar que `httpOnly: false` para las cookies de Supabase

### Solución 2: Verificar y ejecutar migraciones

1. Verificar en Supabase Dashboard > Database > Migrations que todas las migraciones estén aplicadas
2. Ejecutar manualmente las migraciones pendientes si es necesario:
   - `20240101000023_create_dashboard_stats_rpc.sql`
   - `20240101000024_fix_aulas_rls_all_roles.sql`

### Solución 3: Verificar callback de OAuth

Asegurar que el callback esté estableciendo cookies correctamente y que estas no sean `httpOnly`.

## Verificación Final

Después de aplicar las soluciones:

1. **Cerrar sesión y volver a iniciar sesión**
2. **Verificar cookies** en DevTools > Application > Cookies
3. **Verificar `auth.uid()`** ejecutando: `SELECT auth.uid() as user_id;`
4. **Probar dashboard** - debería mostrar aulas si el usuario tiene acceso
5. **Probar página de aulas** - debería mostrar aulas según el rol

