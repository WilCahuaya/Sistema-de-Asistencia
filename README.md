# Sistema de Gestión de Asistencias

Sistema web para la gestión de asistencias de estudiantes en Organizaciones No Gubernamentales (ONG). Desarrollado con Next.js 14, TypeScript, Supabase y Tailwind CSS.

## Características

- ✅ **Autenticación con Google OAuth** - Inicio de sesión seguro con Google
- ✅ **Gestión Multi-entidad** - Soporte para múltiples ONGs con datos aislados
- ✅ **Gestión de Aulas** - Crear y administrar aulas por ONG
- ✅ **Gestión de Estudiantes** - Registro individual y carga masiva desde Excel
- ✅ **Registro de Asistencias** - Registro diario con estados: Presente, Faltó, Permiso
- ✅ **Movimiento de Estudiantes** - Transferencia entre aulas con historial de auditoría
- ✅ **Reportes y Exportación** - Generación de reportes semanales, mensuales y generales en Excel y PDF
- ✅ **Row Level Security (RLS)** - Seguridad a nivel de base de datos para multi-tenancy
- ✅ **Control de Acceso por Roles** - Director, Secretario y Tutor con permisos específicos

## Tecnologías

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Estilos**: Tailwind CSS, shadcn/ui
- **Autenticación**: Google OAuth 2.0
- **Formularios**: React Hook Form + Zod
- **Exportación**: xlsx, jspdf

## Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Supabase
- Credenciales de Google OAuth (para autenticación)

## Instalación

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd Asistencia
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env.local
```

Editar `.env.local` y agregar tus credenciales de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

4. Configurar base de datos:
   - Crear un proyecto en Supabase
   - Ejecutar las migraciones SQL desde `supabase/migrations/` en el SQL Editor de Supabase
   - Ver `docs/CONFIGURACION_SUPABASE.md` para más detalles

5. Configurar Google OAuth:
   - Ver `docs/CONFIGURACION_GOOGLE_OAUTH.md` para instrucciones detalladas

6. Ejecutar el proyecto en desarrollo:
```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## Estructura del Proyecto

```
Asistencia/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rutas de autenticación
│   ├── (dashboard)/       # Rutas del dashboard (protegidas)
│   ├── api/               # API routes
│   └── globals.css        # Estilos globales
├── components/            # Componentes React
│   ├── features/         # Componentes por funcionalidad
│   ├── layout/           # Componentes de layout
│   └── ui/               # Componentes UI (shadcn/ui)
├── contexts/             # Contextos de React
├── lib/                  # Utilidades y helpers
│   └── supabase/         # Clientes de Supabase
├── supabase/
│   └── migrations/       # Migraciones SQL
└── docs/                 # Documentación

```

## Roles y Permisos

### Director
- Acceso completo a todas las funcionalidades
- Gestión de ONGs, aulas y estudiantes
- Registro y edición de asistencias
- Generación y exportación de reportes

### Secretario
- Mismas capacidades que el Director
- Gestión completa de datos

### Tutor/Docente
- Solo visualización de asistencias
- No puede crear, editar o eliminar registros

## Funcionalidades Principales

### Gestión de Estudiantes
- Registro individual de estudiantes
- Carga masiva desde archivos Excel (.xlsx)
- Búsqueda y filtrado por ONG, aula, nombre o código
- Movimiento de estudiantes entre aulas

### Registro de Asistencias
- Registro diario por aula
- Estados: Presente, Faltó, Permiso
- Edición de asistencias individuales
- Campos opcionales de observaciones

### Reportes
- **Reporte Semanal**: Estadísticas de la semana actual
- **Reporte Mensual**: Estadísticas del mes actual
- **Reporte General**: Estadísticas desde el inicio del año
- Exportación a Excel (múltiples hojas)
- Exportación a PDF

## Migraciones de Base de Datos

Las migraciones SQL se encuentran en `supabase/migrations/` y deben ejecutarse en orden:

1. `20240101000000_initial_schema.sql` - Esquema inicial
2. `20240101000001_rls_policies.sql` - Políticas RLS
3. `20240101000002_trigger_usuario.sql` - Trigger de sincronización de usuarios
4. ... (migraciones adicionales para correcciones)

Ver `docs/INSTRUCCIONES_MIGRACIONES.md` para más detalles.

## Desarrollo

### Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Construcción para producción
npm run start    # Servidor de producción
npm run lint     # Linting con ESLint
```

## Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Datos aislados por ONG mediante políticas RLS
- Autenticación JWT con Supabase Auth
- Validación de formularios con Zod
- Control de acceso basado en roles

## Licencia

MIT

## Soporte

Para problemas o preguntas, consulta la documentación en `docs/` o abre un issue en el repositorio.
