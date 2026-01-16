# DOCUMENTO DE ARQUITECTURA DEL SISTEMA

## Sistema Web de Gestión de Asistencias para ONG

---

## 1. Arquitectura General

### 1.1 Patrón Arquitectónico

**Arquitectura Full-Stack con Next.js + Supabase**

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                      │
│  ┌──────────────┐         ┌──────────────┐                │
│  │   Frontend   │         │  API Routes  │                │
│  │  (React SSR) │ ◄─────► │  (Backend)   │                │
│  │              │         │              │                │
│  └──────────────┘         └──────────────┘                │
│         │                          │                        │
└─────────┼──────────────────────────┼────────────────────────┘
          │                          │
          │ Supabase Client          │ Supabase Admin
          │ (Client-side)            │ (Server-side)
          ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Platform                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │     Auth     │  │  PostgreSQL  │  │   Storage    │    │
│  │   (JWT)      │  │  + PostgREST │  │  (Archivos)  │    │
│  │              │  │  + RLS        │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Principios de Diseño

- **Full-Stack Framework**: Next.js unifica frontend y backend en un solo proyecto
- **Server-Side Rendering (SSR)**: Renderizado en servidor para mejor SEO y performance
- **API Routes**: Endpoints backend integrados en Next.js
- **Multi-tenancy con RLS**: Row Level Security de Supabase para aislamiento de datos por ONG
- **Autenticación integrada**: Supabase Auth con JWT automático
- **Control de acceso basado en roles**: Permisos mediante RLS policies y roles personalizados
- **PostgREST**: API REST automática generada desde PostgreSQL

---

## 2. Stack Tecnológico

### 2.1 Framework Full-Stack

| Componente | Tecnología | Versión | Propósito |
|------------|-----------|---------|-----------|
| Framework | Next.js | 14.x | Framework React full-stack |
| Runtime | Node.js | 18.x+ | Runtime de JavaScript |
| Lenguaje | TypeScript | 5.x | Tipado estático |
| Build Tool | Turbopack | (Next.js) | Build tool integrado |
| Routing | Next.js App Router | (Next.js) | File-based routing |

**Justificación**:
- Next.js: Framework full-stack moderno, SSR/SSG, API routes integradas
- TypeScript: Tipado estático para mayor seguridad y productividad
- App Router: Sistema de routing moderno con Server Components

### 2.2 Backend (API Routes + Supabase)

| Componente | Tecnología | Versión | Propósito |
|------------|-----------|---------|-----------|
| API Routes | Next.js API Routes | (Next.js) | Endpoints backend |
| Base de Datos | Supabase (PostgreSQL) | - | Base de datos managed |
| ORM/Query Builder | Supabase JS Client | 2.x | Cliente para PostgreSQL |
| Autenticación | Supabase Auth | (Supabase) | Autenticación JWT integrada |
| Row Level Security | PostgreSQL RLS | (Supabase) | Multi-tenancy y seguridad |
| PostgREST | (Supabase) | - | API REST automática |
| Excel | xlsx | - | Lectura/escritura Excel |
| PDF | jsPDF / pdfkit | - | Generación de PDFs |
| Storage | Supabase Storage | (Supabase) | Almacenamiento de archivos |

**Justificación**:
- Supabase: Backend-as-a-Service completo, PostgreSQL managed con RLS
- PostgREST: API REST automática desde esquema de BD, reduce código backend
- RLS: Seguridad a nivel de base de datos, perfecto para multi-tenancy

### 2.3 Frontend (React Components)

| Componente | Tecnología | Versión | Propósito |
|------------|-----------|---------|-----------|
| UI Library | React | 18.x | Biblioteca UI (incluida en Next.js) |
| Server Components | Next.js | (Next.js) | Componentes renderizados en servidor |
| Client Components | React | (Next.js) | Componentes interactivos |
| Estado Global | Zustand / Context API | - | Gestión de estado (MVP: Context API) |
| Formularios | React Hook Form | 7.x | Manejo de formularios |
| Validación | Zod | 3.x | Validación de esquemas |
| UI Components | shadcn/ui / Tailwind | - | Componentes UI y estilos |
| HTTP Client | Supabase JS Client | 2.x | Cliente para Supabase (reemplaza Axios) |
| Excel Export | xlsx | - | Exportación de Excel |
| PDF Export | jsPDF | - | Exportación de PDF |

**Justificación**:
- Server Components: Mejor performance, menos JavaScript en cliente
- Supabase Client: Reemplaza necesidad de Axios, maneja auth automáticamente
- shadcn/ui: Componentes UI modernos y accesibles
- Tailwind CSS: Utility-first CSS para desarrollo rápido

### 2.4 Supabase - Plataforma Backend

**Componentes de Supabase**:
- **PostgreSQL**: Base de datos relacional robusta
- **PostgREST**: API REST automática desde esquema SQL
- **Auth**: Autenticación OAuth con Google (email de Google)
- **Storage**: Almacenamiento de archivos (logos, documentos)
- **Realtime**: (Opcional MVP) Suscripciones en tiempo real
- **Row Level Security (RLS)**: Políticas de seguridad a nivel de fila

**Ventajas**:
- Backend managed, sin necesidad de servidor propio
- Multi-tenancy nativo con RLS
- Escalable automáticamente
- Plan gratuito generoso para MVP

### 2.5 Herramientas de Desarrollo

| Herramienta | Propósito |
|------------|-----------|
| Git | Control de versiones |
| Node.js / npm / pnpm | Gestión de dependencias |
| Supabase CLI | Migraciones y desarrollo local |
| TypeScript | Tipado estático |
| ESLint / Prettier | Linting y formateo de código |
| Vercel (Opcional) | Despliegue simplificado de Next.js |

---

## 3. Arquitectura Multi-Tenancy

### 3.1 Estrategia: Row Level Security (RLS) de Supabase

**Implementación**: 
- Cada tabla relacionada con datos de ONG incluye `ong_id` como ForeignKey
- Políticas RLS (Row Level Security) en PostgreSQL filtran automáticamente las consultas
- Las políticas verifican que el usuario autenticado tenga acceso a la ONG

**Ventajas**:
- Seguridad a nivel de base de datos (no se puede bypassear desde aplicación)
- Automático: No necesitas filtrar manualmente en cada query
- Performance: Optimizado por PostgreSQL
- Escalable y mantenible

**Ejemplo de política RLS**:
```sql
-- Política para que usuarios solo vean datos de sus ONGs
CREATE POLICY "Users can only see data from their ONGs"
ON estudiantes
FOR SELECT
USING (
  ong_id IN (
    SELECT ong_id FROM usuario_ong 
    WHERE usuario_id = auth.uid()
  )
);
```

### 3.2 Aislamiento de Datos

- **RLS Policies**: Filtrado automático a nivel de base de datos
- **Función helper**: Función SQL para obtener ONGs del usuario actual
- **Validación en API Routes**: Verificación adicional en endpoints sensibles
- **Permisos por rol**: Políticas RLS diferenciadas por rol (Director, Secretario, Tutor)

### 3.3 Estructura de Multi-Tenancy

```sql
-- Tabla de usuarios de Supabase Auth (automática)
auth.users

-- Tabla personalizada de usuarios
usuarios (id, email, nombre, ...)

-- Tabla de relación Usuario-ONG con rol
usuario_ong (
  id,
  usuario_id → usuarios.id,
  ong_id → ongs.id,
  rol (director, secretario, tutor)
)

-- Todas las tablas de datos incluyen ong_id
estudiantes (id, ong_id, codigo, nombre, ...)
aulas (id, ong_id, nombre, ...)
asistencias (id, ong_id, estudiante_id, fecha, ...)
```

---

## 4. Estructura de Directorios

```
Asistencia/
├── app/                       # Next.js App Router
│   ├── (auth)/               # Grupo de rutas de autenticación
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/          # Grupo de rutas protegidas
│   │   ├── dashboard/
│   │   ├── aulas/
│   │   ├── estudiantes/
│   │   ├── asistencias/
│   │   └── reportes/
│   ├── api/                  # API Routes (Backend)
│   │   ├── auth/
│   │   ├── ongs/
│   │   ├── aulas/
│   │   ├── estudiantes/
│   │   ├── asistencias/
│   │   └── reportes/
│   ├── layout.tsx            # Layout raíz
│   └── page.tsx              # Página principal
│
├── components/               # Componentes React reutilizables
│   ├── ui/                  # Componentes UI base (shadcn/ui)
│   ├── forms/               # Componentes de formularios
│   ├── layout/              # Componentes de layout
│   └── features/            # Componentes por feature
│       ├── ong/
│       ├── aulas/
│       ├── estudiantes/
│       ├── asistencias/
│       └── reportes/
│
├── lib/                     # Utilidades y configuraciones
│   ├── supabase/           # Cliente Supabase
│   │   ├── client.ts       # Cliente para cliente (browser)
│   │   └── server.ts       # Cliente para servidor
│   ├── utils/              # Utilidades generales
│   └── validations/        # Esquemas Zod
│
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts
│   ├── useONG.ts
│   └── useSupabase.ts
│
├── contexts/               # Context API para estado global
│   ├── AuthContext.tsx
│   └── ONGContext.tsx
│
├── types/                  # TypeScript types
│   ├── database.ts         # Tipos generados de Supabase
│   └── index.ts
│
├── supabase/               # Configuración Supabase
│   ├── migrations/         # Migraciones SQL
│   ├── seed.sql            # Datos de prueba
│   └── config.toml         # Configuración local
│
├── public/                 # Archivos estáticos
│   └── images/
│
├── docs/                   # Documentación
│   ├── MVP.md
│   └── ARQUITECTURA.md
│
├── .env.local              # Variables de entorno (no versionado)
├── .env.example            # Ejemplo de variables de entorno
├── next.config.js          # Configuración Next.js
├── tailwind.config.js      # Configuración Tailwind
├── tsconfig.json           # Configuración TypeScript
├── package.json
└── README.md
```

---

## 5. Flujo de Autenticación

### 5.1 Proceso de Login con Google OAuth

**Autenticación mediante correo electrónico de Google (OAuth 2.0)**

```
1. Usuario hace clic en "Iniciar sesión con Google"
2. Frontend llama: supabase.auth.signInWithOAuth({ provider: 'google' })
3. Supabase redirige a Google OAuth consent screen
4. Usuario autoriza la aplicación en Google
5. Google redirige de vuelta a la aplicación con código de autorización
6. Supabase intercambia código por tokens y crea/actualiza usuario
7. Supabase genera JWT automáticamente (access + refresh token)
8. Supabase retorna sesión con tokens + información del usuario (email, nombre, avatar)
9. Frontend almacena sesión (Supabase maneja automáticamente)
10. Cliente Supabase incluye token automáticamente en todas las peticiones
11. RLS policies verifican acceso basado en auth.uid()
```

**Ventajas de OAuth con Google**:
- ✅ Sin necesidad de gestionar contraseñas
- ✅ Información del usuario (nombre, email, avatar) proporcionada por Google
- ✅ Mayor seguridad (autenticación gestionada por Google)
- ✅ Experiencia de usuario mejorada (un solo clic)
- ✅ Menos fricción en el registro/login

**Configuración requerida en Supabase**:
1. Habilitar Google como proveedor OAuth en Supabase Dashboard
2. Configurar credenciales OAuth de Google (Client ID y Client Secret)
3. Configurar URL de redirección en Google Cloud Console
4. Configurar URL de callback en Supabase

### 5.2 Gestión de Tokens (Automática con Supabase)

- **Access Token**: Generado automáticamente, válido por tiempo configurado
- **Refresh Token**: Renovación automática por Supabase Client
- **Almacenamiento**: Supabase maneja almacenamiento seguro
- **Renovación automática**: Cliente Supabase renueva tokens automáticamente
- **Sin configuración manual**: No necesitas manejar tokens manualmente

### 5.3 Selección de ONG Activa

- Usuario puede pertenecer a múltiples ONGs
- Frontend permite seleccionar ONG activa
- Context API almacena ONG activa
- RLS policies filtran automáticamente por ONGs del usuario
- API Routes pueden filtrar adicionalmente por ONG activa si es necesario

### 5.4 Autenticación en Server Components

```typescript
// En Server Components (app/dashboard/page.tsx)
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')
  
  // El usuario tiene: user.email, user.user_metadata.name, user.user_metadata.avatar_url
  // (proporcionados por Google OAuth)
  
  // Las queries automáticamente respetan RLS
  const { data: estudiantes } = await supabase
    .from('estudiantes')
    .select('*')
    // RLS filtra automáticamente por ONGs del usuario
}
```

### 5.5 Información del Usuario desde Google OAuth

Cuando un usuario se autentica con Google OAuth, Supabase Auth almacena automáticamente:

- **Email**: `user.email` (correo de Google)
- **Nombre**: `user.user_metadata.full_name` o `user.user_metadata.name`
- **Avatar**: `user.user_metadata.avatar_url`
- **Proveedor**: `user.app_metadata.provider` = 'google'

Esta información está disponible en `auth.users` y puede ser sincronizada con la tabla personalizada `usuarios` si es necesario.

### 5.6 Configuración de Google OAuth en Supabase

**Pasos para configurar Google OAuth**:

1. **Crear proyecto en Google Cloud Console**
   - Ir a [Google Cloud Console](https://console.cloud.google.com/)
   - Crear un nuevo proyecto o seleccionar uno existente
   - Habilitar Google+ API

2. **Configurar OAuth consent screen**
   - Configurar información de la aplicación
   - Agregar scopes necesarios (email, profile)

3. **Crear credenciales OAuth 2.0**
   - Crear "OAuth client ID"
   - Tipo: "Web application"
   - Agregar URLs de redirección autorizadas:
     - `https://<proyecto>.supabase.co/auth/v1/callback`
     - (Para desarrollo local) `http://localhost:3000/auth/callback`

4. **Configurar en Supabase Dashboard**
   - Ir a Authentication > Providers en Supabase
   - Habilitar Google
   - Agregar Client ID y Client Secret de Google
   - Configurar redirect URL

5. **URLs de callback**
   - Producción: `https://<proyecto>.supabase.co/auth/v1/callback`
   - Desarrollo: Supabase maneja automáticamente según el entorno

---

## 6. Patrones de Diseño

### 6.1 Backend (API Routes + Supabase)

- **API Routes**: Endpoints REST en `/app/api/`
- **Server Actions**: (Opcional) Acciones del servidor desde componentes
- **Supabase Client**: Cliente para queries a base de datos
- **RLS Policies**: Control de acceso a nivel de base de datos
- **Database Functions**: Funciones SQL para lógica compleja
- **Validación**: Zod para validación de datos en API Routes

### 6.2 Frontend (Next.js App Router)

- **Server Components**: Componentes renderizados en servidor (por defecto)
- **Client Components**: Componentes interactivos con 'use client'
- **Custom Hooks**: Lógica reutilizable (useAuth, useSupabase, etc.)
- **Context API**: Estado global (auth, ONG activa)
- **Server Actions**: Mutaciones desde componentes sin API Routes explícitas
- **Parallel Routes**: (Futuro) Rutas paralelas para layouts complejos

---

## 7. API REST - Estructura de Endpoints

### 7.1 Autenticación (Google OAuth con Supabase Auth)
```
GET    /api/auth/callback            # Callback de OAuth (manejado por Supabase)
POST   /api/auth/logout/             # Logout (opcional, wrapper)
GET    /api/auth/session/            # Sesión actual
```

**Nota**: 
- La autenticación se hace directamente con Supabase Client en el frontend
- `supabase.auth.signInWithOAuth({ provider: 'google' })` inicia el flujo OAuth
- El callback de OAuth es manejado automáticamente por Supabase
- No hay endpoint de login tradicional, todo se maneja mediante OAuth

### 7.2 ONGs
```
GET    /api/ongs/                    # Listar ONGs del usuario (PostgREST)
GET    /api/ongs/[id]/               # Detalle de ONG (PostgREST)
PATCH  /api/ongs/[id]/               # Actualizar ONG (PostgREST + validación)
```
**Nota**: Muchas operaciones pueden usar PostgREST directamente desde el cliente.

### 7.3 Aulas
```
GET    /api/aulas/                   # Listar aulas (PostgREST o API Route)
POST   /api/aulas/                   # Crear aula (API Route con validación)
GET    /api/aulas/[id]/              # Detalle de aula (PostgREST)
PATCH  /api/aulas/[id]/              # Actualizar aula (API Route)
DELETE /api/aulas/[id]/              # Eliminar aula (API Route)
```

### 7.4 Estudiantes
```
GET    /api/estudiantes/             # Listar estudiantes (PostgREST)
POST   /api/estudiantes/             # Crear estudiante (API Route)
POST   /api/estudiantes/cargar-excel/ # Carga masiva (API Route)
GET    /api/estudiantes/[id]/        # Detalle estudiante (PostgREST)
PATCH  /api/estudiantes/[id]/        # Actualizar estudiante (API Route)
DELETE /api/estudiantes/[id]/       # Eliminar estudiante (API Route)
POST   /api/estudiantes/[id]/mover-aula/ # Mover a otra aula (API Route)
```

### 7.5 Asistencias
```
GET    /api/asistencias/             # Listar asistencias (PostgREST con filtros)
POST   /api/asistencias/             # Registrar asistencia del día (API Route)
GET    /api/asistencias/[id]/        # Detalle de asistencia (PostgREST)
PATCH  /api/asistencias/[id]/        # Editar asistencia (API Route)
DELETE /api/asistencias/[id]/       # Eliminar asistencia (API Route)
```

### 7.6 Reportes
```
GET    /api/reportes/semanal/        # Reporte semanal (API Route)
GET    /api/reportes/mensual/        # Reporte mensual (API Route)
GET    /api/reportes/general/        # Reporte general (API Route)
GET    /api/reportes/exportar-excel/ # Exportar a Excel (API Route)
GET    /api/reportes/exportar-pdf/   # Exportar a PDF (API Route)
```

### 7.7 PostgREST (API Automática)

Supabase genera automáticamente endpoints REST desde el esquema:
```
GET    /rest/v1/estudiantes          # Listar estudiantes
POST   /rest/v1/estudiantes          # Crear estudiante
GET    /rest/v1/estudiantes?id=eq.1  # Filtrar por ID
PATCH  /rest/v1/estudiantes?id=eq.1  # Actualizar estudiante
DELETE /rest/v1/estudiantes?id=eq.1  # Eliminar estudiante
```

**Uso**: Para operaciones CRUD simples, usar PostgREST directamente. Para lógica compleja, usar API Routes.

---

## 8. Modelo de Datos (Esquema Relacional)

### 8.1 Entidades Principales

```
ONG (1) ──< (N) UsuarioONG (N) >── (1) Usuario
  │
  ├──< (N) Aula
  │     │
  │     └──< (N) Estudiante
  │           │
  │           └──< (N) Asistencia
  │
  └──< (N) Asistencia (directa)
```

### 8.2 Tablas y Relaciones

- **ONG**: Entidad raíz, datos aislados por ONG
- **Usuario**: Usuarios del sistema (pueden pertenecer a múltiples ONGs)
- **UsuarioONG**: Relación muchos-a-muchos con rol (Director, Secretario, Tutor)
- **Aula**: Pertenece a una ONG
- **Estudiante**: Pertenece a una Aula (y por tanto a una ONG)
- **Asistencia**: Registro diario, relacionado con Estudiante y ONG

### 8.3 Campos de Auditoría

Todas las tablas principales incluyen:
- `created_at`: TIMESTAMP (default: now())
- `updated_at`: TIMESTAMP (default: now(), trigger para actualizar)
- `created_by`: UUID → auth.users (opcional, usando auth.uid())
- `updated_by`: UUID → auth.users (opcional)

**Implementación con Triggers**:
```sql
-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

---

## 9. Seguridad

### 9.1 Autenticación y Autorización

- **Supabase Auth**: Autenticación JWT gestionada por Supabase
- **HTTPS**: Obligatorio en producción (Supabase y Vercel lo requieren)
- **CORS**: Configurado automáticamente por Supabase
- **CSRF**: Protección integrada en Next.js

### 9.2 Row Level Security (RLS)

- **Políticas RLS**: Control de acceso a nivel de base de datos
- **Imposible bypassear**: Las políticas se ejecutan siempre, incluso si alguien accede directamente a la BD
- **Políticas por rol**: Diferentes políticas para Director, Secretario, Tutor
- **Verificación automática**: PostgreSQL verifica `auth.uid()` en cada query

### 9.3 Validación de Datos

- **Backend**: Validación con Zod en API Routes
- **Base de Datos**: Constraints y tipos en PostgreSQL
- **Frontend**: Validación con Zod + React Hook Form
- **Sanitización**: Next.js sanitiza automáticamente, evitar `dangerouslySetInnerHTML`

### 9.4 Aislamiento Multi-Tenant

- **RLS Policies**: Filtrado automático por ONG a nivel de BD
- **Validación de permisos**: Verificación de rol en API Routes
- **No hay acceso cruzado**: Imposible acceder a datos de otra ONG (garantizado por RLS)
- **Función helper**: Función SQL para verificar membresía en ONG

---

## 10. Manejo de Archivos

### 10.1 Logos de ONG (Supabase Storage)

- **Almacenamiento**: Supabase Storage bucket `logos`
- **Ruta**: `ongs/{ong_id}/logo.{ext}`
- **Formato**: JPG, PNG, WebP
- **Tamaño máximo**: 2MB
- **Procesamiento**: (Opcional) Resize con Sharp en API Route
- **Acceso**: URLs públicas o firmadas según necesidad

### 10.2 Archivos Excel

- **Carga**: Temporal en memoria o Supabase Storage
- **Validación**: Formato de columnas, duplicados, errores
- **Procesamiento**: xlsx library en API Route
- **Limpieza**: Archivos temporales eliminados después de procesar

### 10.3 Exportación

- **Excel**: xlsx library (puede ser en API Route o Client Component)
- **PDF**: jsPDF o pdfkit (preferible API Route para PDFs complejos)
- **Descarga**: Streaming desde API Route o blob desde cliente

---

## 11. Performance y Optimización

### 11.1 Base de Datos (Supabase/PostgreSQL)

- **Índices**: En `ong_id`, `codigo` (estudiantes), `fecha` (asistencias)
- **Índices compuestos**: Para queries frecuentes (ej: `(ong_id, fecha)`)
- **Paginación**: PostgREST soporta `limit` y `offset` automáticamente
- **Select optimizado**: Usar `.select()` específico en lugar de `*`

### 11.2 Next.js Optimizaciones

- **Server Components**: Renderizado en servidor, menos JavaScript en cliente
- **Streaming**: Suspense boundaries para carga progresiva
- **Image Optimization**: Next.js Image component con optimización automática
- **Code Splitting**: Automático por ruta con App Router
- **Caching**: Revalidation y cache de datos de Supabase

### 11.3 Frontend

- **Memoización**: React.memo, useMemo, useCallback donde sea necesario
- **Debounce**: En búsquedas y filtros
- **Optimistic Updates**: Actualizar UI antes de confirmar con servidor
- **Lazy Loading**: Cargar componentes pesados solo cuando se necesiten

---

## 12. Testing (Futuro)

### 12.1 Backend (API Routes)

- **Unit Tests**: Vitest para funciones y utilidades
- **API Tests**: Supertest o fetch para probar endpoints
- **Database Tests**: Supabase local para testing de BD

### 12.2 Frontend

- **Unit Tests**: Vitest + React Testing Library
- **Component Tests**: Testing Library para componentes
- **E2E Tests**: (Futuro) Playwright o Cypress

---

## 13. Despliegue

### 13.1 Opciones Recomendadas

- **Aplicación Next.js**: 
  - **Vercel** (Recomendado): Despliegue automático desde Git, optimizado para Next.js
  - **Netlify**: Alternativa similar a Vercel
  - **Railway / Render**: PaaS con más control
  - **VPS**: Más configuración manual pero más control

- **Base de Datos (Supabase)**:
  - **Supabase Cloud**: Plan gratuito generoso para MVP
  - **Supabase Self-Hosted**: (Futuro) Para más control

### 13.2 Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Solo en servidor

# Google OAuth se configura en Supabase Dashboard
# No se necesitan variables de entorno adicionales para Google OAuth
```

### 13.3 Proceso de Despliegue

1. Crear proyecto en Supabase
2. Ejecutar migraciones SQL
3. Configurar variables de entorno en Vercel
4. Conectar repositorio Git a Vercel
5. Despliegue automático en cada push

---

## 14. Consideraciones para el MVP

### 14.1 Prioridades

1. ✅ Funcionalidad core (CRUD básico)
2. ✅ Autenticación y autorización
3. ✅ Multi-tenancy funcional
4. ✅ Reportes básicos
5. ⚠️ Optimización (post-MVP)
6. ⚠️ Testing completo (post-MVP)

### 14.2 Limitaciones Aceptadas en MVP

- Sin cache avanzado
- Sin CDN para assets estáticos
- Testing manual inicial
- UI básica pero funcional

---

## 15. Próximos Pasos

1. ✅ Validar arquitectura con Next.js + Supabase
2. ✅ Definir autenticación con Google OAuth
3. Configurar proyecto Next.js con TypeScript
4. Configurar Supabase (proyecto cloud)
5. Configurar Google OAuth en Supabase
6. Crear esquema de base de datos (migraciones SQL)
7. Configurar RLS policies para multi-tenancy
8. Implementar autenticación con Google OAuth
9. Crear estructura de carpetas y componentes base
10. Implementar funcionalidades core (CRUD)
11. Agregar reportes y exportación
12. Testing y optimización

---

## 16. Ventajas del Stack Next.js + Supabase

### 16.1 Para el MVP

- **Desarrollo rápido**: Menos código backend, más productividad
- **Menos infraestructura**: No necesitas servidor propio
- **Seguridad integrada**: RLS garantiza aislamiento de datos
- **Escalable**: Supabase escala automáticamente
- **Costo**: Plan gratuito suficiente para MVP

### 16.2 Comparado con Django + React Separado

- ✅ Menos código que mantener (un solo proyecto)
- ✅ TypeScript end-to-end
- ✅ SSR mejorado con Server Components
- ✅ API automática con PostgREST
- ✅ Autenticación sin configuración manual
- ✅ Despliegue más simple (un solo deploy)

---

**Documento de Arquitectura - Versión 2.0**
**Stack**: Next.js 14 + Supabase
**Fecha**: 2024
**Autor**: Equipo de Desarrollo

