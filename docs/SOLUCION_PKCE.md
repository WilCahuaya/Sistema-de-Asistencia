# Solución: Error PKCE Code Verifier

## Problema

Error: `PKCE code verifier not found in storage`

Este error ocurre cuando el code verifier de PKCE no se encuentra en las cookies cuando el callback intenta intercambiar el código por la sesión.

## Causa

El PKCE code verifier se genera cuando el usuario hace clic en "Iniciar sesión con Google", pero debe guardarse en **cookies** (no en localStorage) para que el callback del servidor pueda acceder a él.

## Solución Aplicada

1. **Cliente actualizado** (`lib/supabase/client.ts`):
   - Ahora usa cookies en lugar de localStorage
   - El code verifier se guarda automáticamente en cookies cuando se inicia el flujo OAuth

2. **Middleware actualizado**:
   - Excluye `/auth/callback` del middleware para que se procese correctamente

3. **Callback mejorado**:
   - Maneja correctamente las cookies del code verifier

## Verificación

Para verificar que funciona:

1. **Abre las herramientas de desarrollador** (F12)
2. **Ve a Application > Cookies**
3. **Haz clic en "Iniciar sesión con Google"**
4. **Verifica que aparezca una cookie** con nombre similar a `sb-xxx-auth-code-verifier`
5. **Después de autorizar en Google**, el callback debería poder leer esa cookie

## Si el problema persiste

### Opción 1: Limpiar todo y empezar de nuevo

```bash
# 1. Detén el servidor
# 2. Limpia las cookies del navegador (o usa ventana de incógnito)
# 3. Reinicia el servidor
npm run dev
```

### Opción 2: Verificar que las cookies se están guardando

1. Abre las herramientas de desarrollador (F12)
2. Ve a Application > Cookies > `http://localhost:3000`
3. Haz clic en "Iniciar sesión con Google"
4. **Inmediatamente** (antes de que te redirija a Google), verifica si apareció una cookie con `code-verifier` en el nombre
5. Si NO aparece, el problema está en el cliente
6. Si aparece pero luego desaparece, puede ser un problema de SameSite o Secure

### Opción 3: Verificar configuración de Supabase

Asegúrate de que en Supabase Dashboard:
- Google OAuth está **habilitado**
- Client ID y Client Secret están configurados
- Redirect URL es: `https://tu-proyecto.supabase.co/auth/v1/callback`

### Opción 4: Verificar variables de entorno

```bash
# Verifica que las variables estén cargadas
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Si no aparecen, el archivo `.env.local` no se está cargando correctamente.

## Nota Importante

El flujo correcto es:
1. Usuario hace clic → Se genera code_verifier → Se guarda en cookies
2. Redirección a Google → Usuario autoriza
3. Google redirige a Supabase → Supabase procesa
4. Supabase redirige a tu app `/auth/callback` → Lee code_verifier de cookies → Intercambia código por sesión

Si en el paso 4 no encuentra el code_verifier, verifica que:
- Las cookies no se borraron entre pasos
- El mismo navegador/ventana se usó para todo el flujo
- No hay restricciones de cookies (SameSite, Secure, etc.)

