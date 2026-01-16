# Guía de Depuración de Autenticación

## Problema: "Error al autenticarse"

Si ves este error después de intentar iniciar sesión con Google, sigue estos pasos:

### 1. Verificar Logs en el Servidor

Revisa la terminal donde corre `npm run dev`. Deberías ver logs como:
- `User authenticated successfully: tu@email.com` (si funciona)
- `Error exchanging code for session: ...` (si hay error)
- `No code parameter in callback URL` (si falta el código)

### 2. Verificar Variables de Entorno

Asegúrate de que `.env.local` tiene las variables correctas:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

**Verificar:**
- Las URLs no tienen espacios extra
- Las claves están completas
- El archivo `.env.local` está en la raíz del proyecto

### 3. Verificar Configuración en Supabase

1. Ve a Supabase Dashboard > Authentication > Providers
2. Verifica que Google OAuth está **habilitado** (toggle activado)
3. Verifica que **Client ID** y **Client Secret** están configurados
4. Verifica la **Redirect URL** es: `https://tu-proyecto.supabase.co/auth/v1/callback`

### 4. Verificar Configuración en Google Cloud Console

1. Ve a Google Cloud Console > APIs & Services > Credentials
2. Verifica tu OAuth 2.0 Client ID
3. Verifica que en **Authorized redirect URIs** esté:
   ```
   https://tu-proyecto.supabase.co/auth/v1/callback
   ```
   - Reemplaza `tu-proyecto` con tu project ref de Supabase
   - Debe coincidir **exactamente** (sin espacios, con `https://`)

### 5. Verificar URL de Callback en la Aplicación

La URL de callback en el código debe ser:
```typescript
redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/dashboard`
```

En desarrollo, esto será: `http://localhost:3000/auth/callback`

### 6. Errores Comunes y Soluciones

#### Error: "redirect_uri_mismatch"
- **Causa**: La URL de redirect no coincide entre Google y Supabase
- **Solución**: Asegúrate de que ambas URLs sean idénticas
- Verifica que en Google Cloud Console esté la URL de Supabase: `https://tu-proyecto.supabase.co/auth/v1/callback`

#### Error: "invalid_client"
- **Causa**: Client ID o Client Secret incorrectos en Supabase
- **Solución**: Regenera las credenciales en Google Cloud Console y actualiza en Supabase

#### Error: "No code parameter"
- **Causa**: Google no está redirigiendo con el código
- **Solución**: Verifica que la Redirect URL en Google sea la de Supabase, no la de tu app

#### Error: "Session not found"
- **Causa**: Las cookies no se están estableciendo correctamente
- **Solución**: 
  - Limpia las cookies del navegador
  - Asegúrate de que las variables de entorno son correctas
  - Reinicia el servidor de desarrollo

### 7. Flujo Correcto

1. Usuario hace clic en "Iniciar sesión con Google"
2. Es redirigido a Google OAuth consent screen
3. Usuario autoriza la aplicación
4. Google redirige a: `https://tu-proyecto.supabase.co/auth/v1/callback?code=...`
5. Supabase procesa el código y redirige a tu app: `http://localhost:3000/auth/callback?code=...`
6. Tu app intercambia el código por sesión
7. Usuario es redirigido al dashboard

### 8. Verificar en el Navegador

1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña **Network**
3. Intenta iniciar sesión
4. Busca la petición a `/auth/callback`
5. Verifica:
   - ¿Llega el parámetro `code` en la URL?
   - ¿Qué respuesta se recibe?
   - ¿Hay errores en la pestaña Console?

### 9. Solución Temporal

Si el problema persiste, prueba usando el método directo de Supabase:

1. Ve a Supabase Dashboard > Authentication > Users
2. Haz clic en "Add user" > "Invite user"
3. Ingresa tu email de Google
4. Recibirás un email de invitación

Esto te permitirá acceder sin OAuth mientras solucionamos el problema.

### 10. Logs del Callback

Revisa los logs en la terminal del servidor después de intentar iniciar sesión. Deberías ver:
- `User authenticated successfully: tu@email.com` - Todo bien
- `Error exchanging code for session: ...` - Problema con el intercambio
- `Error getting user after auth: ...` - Problema obteniendo el usuario

## Siguiente Paso

Si después de verificar todo lo anterior aún tienes problemas, comparte:
1. Los logs del servidor (terminal donde corre `npm run dev`)
2. Los errores en la consola del navegador (F12 > Console)
3. Los errores en Network (F12 > Network > `/auth/callback`)

