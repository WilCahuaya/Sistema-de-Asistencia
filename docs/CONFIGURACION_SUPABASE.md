# Guía de Configuración de Supabase

Esta guía te ayudará a configurar Supabase para el proyecto.

## Paso 1: Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta (es gratis)
3. Haz clic en **"New Project"**
4. Completa el formulario:
   - **Name**: `asistencia-ong` (o el nombre que prefieras)
   - **Database Password**: Genera una contraseña segura y **guárdala** (la necesitarás después)
   - **Region**: Elige la región más cercana (recomendado: `South America`)
   - **Pricing Plan**: Free (suficiente para MVP)
5. Haz clic en **"Create new project"**
6. Espera 1-2 minutos mientras se crea el proyecto

## Paso 2: Obtener Credenciales

Una vez creado el proyecto:

1. Ve a **Settings** > **API** en el menú lateral
2. Encontrarás dos claves importantes:

### URL del Proyecto
- **Project URL**: Copia esta URL (ejemplo: `https://xxxxx.supabase.co`)
- Esta es tu `NEXT_PUBLIC_SUPABASE_URL`

### Claves API
- **anon public** key: Clave pública (segura para usar en el cliente)
  - Esta es tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key: Clave privada (solo para uso en servidor)
  - Esta es tu `SUPABASE_SERVICE_ROLE_KEY`
  - ⚠️ **IMPORTANTE**: Nunca compartas esta clave ni la expongas en el cliente

## Paso 3: Configurar Variables de Entorno

1. Copia el archivo `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edita `.env.local` y reemplaza los valores con tus credenciales:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   ```

3. **IMPORTANTE**: `.env.local` ya está en `.gitignore`, así que no se subirá a git

## Paso 4: Configurar Google OAuth (Opcional por ahora)

Puedes configurar Google OAuth después. Ver la sección 5.6 en `docs/ARQUITECTURA.md` para instrucciones detalladas.

## Paso 5: Verificar Configuración

Para verificar que todo está configurado correctamente:

1. Asegúrate de que `.env.local` tiene las tres variables configuradas
2. Reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Si no hay errores, la configuración es correcta

## Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase + Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

## Notas Importantes

- ⚠️ **NUNCA** subas `.env.local` a git
- ⚠️ **NUNCA** expongas `SUPABASE_SERVICE_ROLE_KEY` en el cliente
- El plan gratuito de Supabase es suficiente para el MVP
- Puedes cambiar el plan más adelante si es necesario


