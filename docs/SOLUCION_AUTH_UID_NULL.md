# Solución: auth.uid() devuelve NULL - Aulas no se muestran

## Problema

`auth.uid()` devuelve `NULL`, causando que todas las políticas RLS fallen y no se muestren aulas en ninguna vista (dashboard, página de aulas, etc.).

## Causa Raíz

El token JWT no se está enviando correctamente desde el cliente del navegador a Supabase PostgREST. Esto puede deberse a:

1. **Las cookies no se están leyendo correctamente** - El cliente del navegador no está leyendo las cookies establecidas por el servidor
2. **Las cookies están marcadas como httpOnly** - Si las cookies son `httpOnly`, JavaScript no puede leerlas
3. **El callback de OAuth no está estableciendo cookies correctamente** - Las cookies no se están estableciendo durante el flujo de autenticación

## Solución Implementada

### 1. Cliente del Navegador Simplificado

Se simplificó `lib/supabase/client.ts` para usar la implementación automática de `@supabase/ssr`, que maneja las cookies correctamente:

```typescript
// ANTES: Implementación manual de cookies (puede fallar)
return createBrowserClient(url, key, {
  cookies: {
    getAll() { /* ... implementación manual ... */ },
    setAll() { /* ... implementación manual ... */ }
  }
})

// DESPUÉS: Implementación automática (recomendado por @supabase/ssr)
return createBrowserClient(url, key)
```

**Nota:** `@supabase/ssr` v0.8.0+ maneja automáticamente las cookies del navegador cuando no se especifican opciones.

### 2. Verificación del Callback

El callback de OAuth (`app/auth/callback/route.ts`) ya está configurado correctamente:

- ✅ Establece cookies con `httpOnly: false` (legibles por JavaScript)
- ✅ Configura `sameSite: 'lax'` para compatibilidad
- ✅ Configura `path: '/'` para que las cookies estén disponibles en todas las rutas

### 3. Verificación de Migraciones RLS

Asegúrate de que las migraciones se hayan ejecutado:

```sql
-- Verificar que las políticas RLS existan
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'aulas';

-- Verificar que la función RPC exista
SELECT proname FROM pg_proc WHERE proname = 'get_dashboard_stats';
```

Si faltan, ejecuta:
- `supabase/migrations/20240101000023_create_dashboard_stats_rpc.sql`
- `supabase/migrations/20240101000024_fix_aulas_rls_all_roles.sql`

## Pasos para Verificar la Solución

### Paso 1: Cerrar Sesión y Volver a Iniciar Sesión

**IMPORTANTE:** Debes cerrar sesión completamente y volver a iniciar sesión para que las cookies se establezcan correctamente con el nuevo cliente.

### Paso 2: Verificar Cookies en el Navegador

1. Abre DevTools (F12)
2. Ve a **Application** > **Cookies** > `http://localhost:3000`
3. Busca cookies que empiecen con `sb-` seguido de tu proyecto Supabase
4. Verifica que:
   - ✅ Tienen un valor (no vacías)
   - ✅ **NO** están marcadas como `HttpOnly`
   - ✅ Tienen `Path: /`

### Paso 3: Verificar auth.uid() en SQL

Ejecuta en el SQL Editor de Supabase (como usuario autenticado):

```sql
SELECT auth.uid() as user_id;
```

**Debe devolver tu `user_id` (UUID), NO `NULL`.**

### Paso 4: Verificar Dashboard

1. Recarga el dashboard (`/dashboard`)
2. Verifica que muestre aulas si el usuario tiene acceso
3. Revisa la consola del navegador para ver si hay errores

### Paso 5: Verificar Página de Aulas

1. Ve a `/dashboard/aulas`
2. Verifica que se muestren aulas según el rol:
   - **Facilitador/Secretario:** Todas las aulas de sus ONGs
   - **Tutor:** Solo aulas asignadas

## Si auth.uid() Sigue Devolviendo NULL

### Opción A: Verificar Configuración de Cookies en Supabase

1. Ve a Supabase Dashboard > **Settings** > **API**
2. Verifica la configuración de cookies
3. Asegúrate de que las cookies no estén configuradas como `httpOnly` a nivel de Supabase

### Opción B: Verificar Middleware

El middleware (`lib/supabase/middleware.ts`) debe estar refrescando la sesión correctamente. Verifica que:

```typescript
// El middleware llama a supabase.auth.getUser() correctamente
const { data: { user } } = await supabase.auth.getUser()
```

### Opción C: Debugging Detallado

Agrega logging temporal en `AulaList.tsx`:

```typescript
const loadAulas = async () => {
  const supabase = createClient()
  
  // Verificar autenticación
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('🔐 User ID:', user?.id)
  console.log('🔐 User Email:', user?.email)
  console.log('🔐 Auth Error:', userError)
  
  // Verificar cookies
  console.log('🍪 All Cookies:', document.cookie)
  
  // ... resto del código ...
}
```

## Resumen

La solución principal fue **simplificar el cliente del navegador** para usar la implementación automática de `@supabase/ssr`, que maneja las cookies correctamente.

**Acción requerida:** Cerrar sesión y volver a iniciar sesión para que las cookies se establezcan correctamente.

