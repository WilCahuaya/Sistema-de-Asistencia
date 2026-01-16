# Guía de Configuración de Google OAuth

Esta guía te ayudará a configurar Google OAuth en Supabase para autenticación mediante correo electrónico de Google.

## Prerequisitos

- ✅ Proyecto Supabase creado
- ✅ Migraciones de base de datos ejecutadas
- ✅ Variables de entorno configuradas en `.env.local`

## Paso 1: Crear Proyecto en Google Cloud Console

1. **Ir a Google Cloud Console**
   - Ve a [https://console.cloud.google.com](https://console.cloud.google.com)
   - Inicia sesión con tu cuenta de Google

2. **Crear un nuevo proyecto** (o seleccionar uno existente)
   - Haz clic en el selector de proyectos (arriba)
   - Haz clic en **"NEW PROJECT"**
   - Nombre: `asistencia-ong` (o el que prefieras)
   - Haz clic en **"CREATE"**
   - Espera unos segundos y selecciona el proyecto

## Paso 2: Habilitar Google+ API

1. **Ir a APIs & Services > Library**
   - En el menú lateral, ve a **"APIs & Services"** > **"Library"**

2. **Buscar y habilitar Google+ API**
   - Busca "Google+ API" en la barra de búsqueda
   - Haz clic en el resultado
   - Haz clic en **"ENABLE"**

**Nota**: Google+ API está siendo deprecada, pero aún es necesaria para OAuth. Si no la encuentras, puedes usar "Google Identity Services" en su lugar.

## Paso 3: Configurar OAuth Consent Screen

1. **Ir a OAuth consent screen**
   - En el menú lateral, ve a **"APIs & Services"** > **"OAuth consent screen"**

2. **Seleccionar tipo de usuario**
   - Si es para uso interno de tu organización: **"Internal"**
   - Si es para usuarios externos: **"External"** (requiere verificación para producción)
   - Para MVP, selecciona **"External"**
   - Haz clic en **"CREATE"**

3. **Completar información de la aplicación**
   - **App name**: `Sistema de Gestión de Asistencias` (o el nombre que prefieras)
   - **User support email**: Tu correo electrónico
   - **Developer contact information**: Tu correo electrónico
   - Haz clic en **"SAVE AND CONTINUE"**

4. **Configurar Scopes (opcional)**
   - Por defecto incluye `email`, `profile`, `openid` (necesarios)
   - Haz clic en **"SAVE AND CONTINUE"** si no necesitas scopes adicionales

5. **Test users (solo si seleccionaste External)**
   - Para desarrollo, puedes agregar usuarios de prueba
   - Haz clic en **"SAVE AND CONTINUE"**

6. **Summary**
   - Revisa la información
   - Haz clic en **"BACK TO DASHBOARD"**

## Paso 4: Crear Credenciales OAuth 2.0

1. **Ir a Credentials**
   - En el menú lateral, ve a **"APIs & Services"** > **"Credentials"**

2. **Crear OAuth Client ID**
   - Haz clic en **"+ CREATE CREDENTIALS"**
   - Selecciona **"OAuth client ID"**

3. **Seleccionar tipo de aplicación**
   - **Application type**: `Web application`
   - Haz clic en **"CREATE"**

4. **Configurar aplicación web**
   - **Name**: `Supabase Auth` (o el nombre que prefieras)
   
   - **Authorized JavaScript origins**:
     ```
     https://tu-proyecto.supabase.co
     ```
     Reemplaza `tu-proyecto` con el ID de tu proyecto de Supabase (lo encuentras en la URL de tu proyecto)
   
   - **Authorized redirect URIs**:
     ```
     https://tu-proyecto.supabase.co/auth/v1/callback
     ```
     ⚠️ **IMPORTANTE**: Reemplaza `tu-proyecto` con tu project ref de Supabase

5. **Obtener credenciales**
   - Haz clic en **"CREATE"**
   - Se mostrará un diálogo con:
     - **Client ID**: Cópialo (lo necesitarás)
     - **Client Secret**: Cópialo (lo necesitarás)
   - ⚠️ **IMPORTANTE**: Guarda estas credenciales de forma segura
   - Haz clic en **"OK"**

## Paso 5: Configurar Google OAuth en Supabase

1. **Ir a Supabase Dashboard**
   - Ve a [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Ir a Authentication > Providers**
   - En el menú lateral, ve a **"Authentication"**
   - Haz clic en **"Providers"**

3. **Habilitar Google**
   - En la lista de proveedores, busca **"Google"**
   - Haz clic en el toggle para **habilitar Google**

4. **Configurar credenciales**
   - **Client ID (for OAuth)**: Pega el Client ID de Google Cloud Console
   - **Client Secret (for OAuth)**: Pega el Client Secret de Google Cloud Console
   
5. **Configurar Redirect URL**
   - Supabase debería mostrar automáticamente la URL correcta
   - Asegúrate de que coincida con la que configuraste en Google Cloud Console:
     ```
     https://tu-proyecto.supabase.co/auth/v1/callback
     ```

6. **Guardar configuración**
   - Haz clic en **"Save"** o **"Update"**

## Paso 6: Verificar Configuración

1. **Probar autenticación**
   - Puedes probar la autenticación directamente desde Supabase:
     - Ve a **Authentication** > **Users**
     - Haz clic en **"Add user"** > **"Invite user"** (temporal para prueba)
     - O mejor, prueba desde tu aplicación cuando la implementes

2. **Verificar Redirect URL**
   - Asegúrate de que la URL de callback en Supabase coincide exactamente con la configurada en Google Cloud Console
   - Debe terminar en `/auth/v1/callback`

## Solución de Problemas

### Error: "redirect_uri_mismatch"
- **Causa**: La URL de redirect no coincide entre Google Cloud Console y Supabase
- **Solución**: 
  1. Verifica que ambas URLs sean idénticas
  2. Asegúrate de incluir `https://` y la ruta completa
  3. No incluyas una barra final `/` al final

### Error: "invalid_client"
- **Causa**: Client ID o Client Secret incorrectos
- **Solución**: 
  1. Verifica que copiaste correctamente las credenciales
  2. Asegúrate de no tener espacios extra
  3. Regenera las credenciales si es necesario

### Error: "access_denied"
- **Causa**: El usuario canceló el consentimiento o la app no está verificada
- **Solución**: 
  - Para desarrollo: Agrega usuarios de prueba en OAuth consent screen
  - Para producción: Verifica tu aplicación en Google Cloud Console

### No aparece el botón de Google en Supabase
- **Causa**: Google OAuth no está habilitado
- **Solución**: 
  1. Ve a Authentication > Providers
  2. Asegúrate de que Google esté habilitado
  3. Verifica que las credenciales estén configuradas

## URLs de Referencia

- **Supabase Dashboard**: https://app.supabase.com
- **Google Cloud Console**: https://console.cloud.google.com
- **Documentación Supabase Auth**: https://supabase.com/docs/guides/auth/social-login/auth-google

## Notas Importantes

- ⚠️ **Client Secret**: Nunca lo expongas en código del cliente
- ⚠️ **Redirect URI**: Debe coincidir exactamente en ambos lugares
- ✅ **Development**: Puedes usar "External" app type con usuarios de prueba
- ✅ **Production**: Necesitarás verificar tu aplicación en Google

## Siguiente Paso

Una vez configurado Google OAuth, continúa con:
- **Paso 7**: Implementar autenticación con Google OAuth en la aplicación

