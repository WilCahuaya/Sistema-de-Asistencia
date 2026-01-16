# Solución: Error "Unsupported provider: provider is not enabled"

Este error indica que Google OAuth no está habilitado o configurado correctamente en Supabase.

## Solución Rápida

### Paso 1: Verificar que Google OAuth esté habilitado en Supabase

1. **Ve a tu Supabase Dashboard**
   - Abre [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Ir a Authentication > Providers**
   - En el menú lateral, ve a **"Authentication"**
   - Haz clic en **"Providers"**

3. **Habilitar Google**
   - Busca **"Google"** en la lista de proveedores
   - Asegúrate de que el **toggle esté activado** (debe estar en verde/azul)
   - Si está desactivado, haz clic en el toggle para activarlo

### Paso 2: Verificar las credenciales

Si el toggle está activado pero sigue el error:

1. **Verificar Client ID y Client Secret**
   - En la misma página de Providers > Google
   - Asegúrate de que **Client ID (for OAuth)** tenga un valor
   - Asegúrate de que **Client Secret (for OAuth)** tenga un valor
   - Si están vacíos, ve a "Paso 5" de la guía `CONFIGURACION_GOOGLE_OAUTH.md`

2. **Verificar Redirect URL**
   - La URL debe ser exactamente:
     ```
     https://tu-proyecto.supabase.co/auth/v1/callback
     ```
   - Reemplaza `tu-proyecto` con tu project ref de Supabase
   - Puedes encontrar tu project ref en: **Settings** > **API** > **Project URL**

### Paso 3: Guardar configuración

1. **Hacer clic en "Save" o "Update"**
   - Asegúrate de guardar cualquier cambio que hayas hecho
   - Espera a que se confirme el guardado

2. **Esperar unos segundos**
   - A veces toma unos segundos para que los cambios se propaguen

### Paso 4: Verificar en Google Cloud Console

Si el problema persiste, verifica en Google Cloud Console:

1. **Ir a Google Cloud Console**
   - Ve a [https://console.cloud.google.com](https://console.cloud.google.com)
   - Selecciona tu proyecto

2. **Verificar OAuth Client**
   - Ve a **APIs & Services** > **Credentials**
   - Asegúrate de que tu OAuth 2.0 Client ID esté activo

3. **Verificar Redirect URI**
   - En tu OAuth Client, verifica que el **Authorized redirect URIs** incluya:
     ```
     https://tu-proyecto.supabase.co/auth/v1/callback
     ```
   - Debe coincidir **exactamente** con la URL en Supabase

### Paso 5: Verificar variables de entorno

1. **Verificar `.env.local`**
   - Asegúrate de que tengas las variables correctas:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
     ```

2. **Reiniciar el servidor de desarrollo**
   - Detén el servidor (Ctrl+C)
   - Vuelve a ejecutar: `npm run dev`

## Checklist de Verificación

Antes de probar nuevamente, verifica:

- [ ] Google OAuth está habilitado en Supabase Dashboard (toggle activado)
- [ ] Client ID está configurado en Supabase
- [ ] Client Secret está configurado en Supabase
- [ ] Redirect URL coincide exactamente en Supabase y Google Cloud Console
- [ ] Variables de entorno en `.env.local` son correctas
- [ ] Servidor de desarrollo reiniciado

## Si el problema persiste

1. **Verificar logs en Supabase**
   - Ve a **Authentication** > **Logs** en Supabase Dashboard
   - Busca errores relacionados con Google OAuth

2. **Probar con otro navegador**
   - A veces los problemas de cookies pueden causar este error

3. **Limpiar caché y cookies**
   - Limpia las cookies de tu navegador para `localhost` y tu dominio de Supabase

4. **Verificar que las credenciales de Google sean válidas**
   - Regenera el Client Secret si es necesario
   - Asegúrate de que no haya expirado

## Pasos de Configuración Completos

Si necesitas configurar Google OAuth desde cero, sigue la guía completa:
- `docs/CONFIGURACION_GOOGLE_OAUTH.md`

## Nota Importante

El error "Unsupported provider" generalmente significa:
- El proveedor no está habilitado en Supabase Dashboard
- Las credenciales están mal configuradas
- El Redirect URI no coincide

En la mayoría de los casos, simplemente **habilitar el toggle** en Supabase Dashboard resuelve el problema.

