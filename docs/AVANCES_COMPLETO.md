# Documento de Avances Completo del Proyecto

**Sistema de Gestión de Asistencias para FCP**  
**Fecha:** Enero 2025  
**Versión:** 2.0

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estructura del Sistema](#estructura-del-sistema)
3. [Roles y Permisos](#roles-y-permisos)
4. [Funcionalidades Implementadas](#funcionalidades-implementadas)
5. [Estructura de Datos FCP](#estructura-de-datos-fcp)
6. [Componentes Principales](#componentes-principales)
7. [Reportes Disponibles](#reportes-disponibles)
8. [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
9. [Cambios Recientes](#cambios-recientes)
10. [Tecnologías Utilizadas](#tecnologías-utilizadas)

---

## Resumen Ejecutivo

Sistema web completo para la gestión de asistencias de estudiantes en **FCP (Fundaciones de Cooperación Popular)**. El sistema permite gestionar múltiples FCPs con datos completamente aislados, registrar asistencias diarias, generar reportes automáticos y exportar datos en múltiples formatos.

### Características Principales

- ✅ **Autenticación con Google OAuth** - Inicio de sesión seguro
- ✅ **Gestión Multi-entidad** - Soporte para múltiples FCPs con datos aislados
- ✅ **4 Roles de Usuario** - Facilitador, Director, Secretario, Tutor
- ✅ **Gestión Completa** - FCPs, Aulas, Estudiantes, Asistencias
- ✅ **Reportes Avanzados** - 4 tipos de reportes con exportación Excel/PDF
- ✅ **Seguridad RLS** - Row Level Security a nivel de base de datos
- ✅ **Interfaz Moderna** - UI responsive con Tailwind CSS y shadcn/ui

---

## Estructura del Sistema

### Arquitectura

```
┌─────────────────────────────────────────┐
│      Next.js 14 (App Router)           │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │  API Routes  │   │
│  │  (React 18)  │  │  (Backend)   │   │
│  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────┘
              │              │
              ▼              ▼
┌─────────────────────────────────────────┐
│         Supabase Platform              │
│  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │   Auth   │  │PostgreSQL│  │Storage││
│  │  (JWT)   │  │ + RLS    │  │       ││
│  └──────────┘  └──────────┘  └──────┘ │
└─────────────────────────────────────────┘
```

### Estructura de Datos

```
FCP (Fundación de Cooperación Popular)
  │
  ├── Aulas
  │     │
  │     └── Estudiantes
  │           │
  │           └── Asistencias (diarias)
  │
  └── Usuarios (con roles)
        │
        └── Relación Usuario-FCP (con rol)
```

---

## Roles y Permisos

El sistema cuenta con **4 roles** principales, cada uno con permisos específicos:

### 1. Facilitador

**Permisos:**
- ✅ Crear nuevas FCPs
- ✅ Ver todas las FCPs del sistema
- ✅ Ver reportes de todas las FCPs
- ✅ Gestionar miembros de FCPs
- ❌ NO puede crear aulas
- ❌ NO puede agregar/editar estudiantes
- ❌ NO puede registrar/editar asistencias
- ❌ NO puede cambiar tutores

**Dashboard:**
- Muestra resumen de reportes mensuales del mes actual
- Muestra perfil del usuario
- Acceso rápido a reportes

### 2. Director

**Permisos:**
- ✅ Gestionar miembros (agregar, editar, eliminar)
- ✅ Crear y editar aulas
- ✅ Agregar y editar estudiantes
- ✅ Registrar y editar asistencias
- ✅ Ver reportes
- ✅ Exportar reportes (Excel/PDF)
- ✅ Asignar/cambiar tutores
- ✅ Mover estudiantes entre aulas

**Dashboard:**
- Estadísticas completas
- Acceso a todas las funcionalidades

### 3. Secretario

**Permisos:**
- ✅ Gestionar miembros (agregar, editar, eliminar)
- ✅ Crear y editar aulas
- ✅ Agregar y editar estudiantes
- ✅ Registrar y editar asistencias
- ✅ Ver reportes
- ✅ Exportar reportes (Excel/PDF)
- ✅ Asignar/cambiar tutores
- ✅ Mover estudiantes entre aulas

**Dashboard:**
- Estadísticas completas
- Acceso a todas las funcionalidades

### 4. Tutor

**Permisos:**
- ✅ Ver asistencias (solo de sus aulas asignadas)
- ✅ Ver estudiantes (solo de sus aulas asignadas)
- ✅ Ver aulas (solo las asignadas)
- ❌ Solo lectura - NO puede modificar nada

**Dashboard:**
- Vista limitada a sus aulas asignadas

---

## Funcionalidades Implementadas

### 1. Gestión de FCPs

**Componentes:**
- `ONGList.tsx` - Lista de FCPs
- `ONGDialog.tsx` - Crear nueva FCP
- `ONGEditDialog.tsx` - Editar FCP existente

**Funcionalidades:**
- Crear nuevas FCPs (solo facilitadores)
- Editar información de FCPs (facilitadores y directores)
- Ver lista de FCPs (todos los usuarios según su rol)
- Gestión de miembros de FCPs

**Campos de FCP:**
- Número de identificación (ej: PE0530)
- Razón social (ej: RESCATANDO VALORES)
- Nombre completo del contacto (ej: Juan Pérez Camacho)
- Teléfono (ej: +51 987654321)
- Correo electrónico (ej: juan.perez@ci.org)
- Ubicación (ej: Lima, Perú)
- Rol del contacto (ej: Director)

### 2. Gestión de Aulas

**Componentes:**
- `AulaList.tsx` - Lista de aulas
- `AulaDialog.tsx` - Crear/editar aula
- `AulaTutorDialog.tsx` - Asignar/cambiar tutor

**Funcionalidades:**
- Crear aulas (director y secretario)
- Editar aulas (director y secretario)
- Asignar tutores a aulas (director y secretario)
- Ver aulas (todos los usuarios según su rol)

### 3. Gestión de Estudiantes

**Componentes:**
- `EstudianteList.tsx` - Lista de estudiantes
- `EstudianteDialog.tsx` - Crear/editar estudiante
- `EstudianteUploadDialog.tsx` - Carga masiva desde Excel
- `EstudianteMovimientoDialog.tsx` - Mover estudiante entre aulas

**Funcionalidades:**
- Agregar estudiantes individualmente (director y secretario)
- Carga masiva desde Excel (director y secretario)
- Editar información de estudiantes (director y secretario)
- Mover estudiantes entre aulas (director y secretario)
- Ver estudiantes (todos según su rol)

### 4. Gestión de Asistencias

**Componentes:**
- `AsistenciaList.tsx` - Lista de asistencias
- `AsistenciaCalendarView.tsx` - Vista de calendario mensual
- `AsistenciaRegistroDialog.tsx` - Registrar asistencias del día
- `AsistenciaEditDialog.tsx` - Editar asistencia individual

**Funcionalidades:**
- Registro diario de asistencias (director y secretario)
- Vista de calendario mensual (todos)
- Edición de asistencias (director y secretario)
- Estados: Presente, Faltó, Permiso
- Observaciones por asistencia

**Vista de Calendario:**
- Interfaz tipo calendario con todos los días del mes
- Click simple: Presente
- Doble click: Faltó
- Mantener presionado: Permiso
- Botones para marcar todos como presentes
- Botones para eliminar todas las asistencias de un día

### 5. Gestión de Miembros

**Componentes:**
- `MiembrosList.tsx` - Lista de miembros de una FCP
- `MiembroAddDialog.tsx` - Agregar nuevo miembro
- `MiembroEditDialog.tsx` - Editar miembro existente

**Funcionalidades:**
- Agregar miembros a FCPs (facilitador, director, secretario)
- Editar roles de miembros (facilitador, director, secretario)
- Invitaciones pendientes para usuarios no registrados
- Asignación automática cuando el usuario se registra

---

## Estructura de Datos FCP

### Campos Obligatorios

Cada FCP debe tener los siguientes campos:

1. **Número de Identificación** (VARCHAR) - Ej: PE0530
2. **Razón Social** (VARCHAR) - Ej: RESCATANDO VALORES
3. **Nombre Completo** (VARCHAR) - Ej: Juan Pérez Camacho
4. **Teléfono** (VARCHAR) - Ej: +51 987654321
5. **Correo Electrónico** (VARCHAR) - Ej: juan.perez@ci.org
6. **Ubicación** (VARCHAR) - Ej: Lima, Perú
7. **Rol** (VARCHAR) - Ej: Director

### Migración de Datos

- Los campos antiguos (`nombre`, `descripcion`, `direccion`, `logo_url`) fueron eliminados
- Nueva estructura implementada en migración `20240101000029_add_fcp_fields.sql`
- Todos los campos son obligatorios (NOT NULL)

---

## Componentes Principales

### Navegación

**Archivo:** `components/layout/DashboardNav.tsx`

- Menú principal con acceso a todas las secciones
- Navegación: Dashboard, FCPs, Aulas, Estudiantes, Asistencias, Reportes
- Botón de cerrar sesión

### Dashboard

**Archivo:** `app/(dashboard)/dashboard/page.tsx`

**Para Facilitadores:**
- Resumen de reportes mensuales del mes actual
- Perfil del usuario
- Acceso rápido a reportes

**Para Otros Roles:**
- Estadísticas completas
- Contadores de estudiantes, aulas, asistencias
- Acceso a todas las funcionalidades

**Componente:** `components/features/dashboard/ReportesMensualesResumen.tsx`
- Muestra resumen de asistencia por FCP del mes actual
- Calcula porcentajes de asistencia
- Muestra 0% en rojo si no hay asistencias
- Enlaces a reportes detallados

### Gestión de FCPs

**Página:** `app/(dashboard)/ongs/page.tsx`

**Componentes:**
- `ONGList.tsx` - Lista principal de FCPs
- `ONGDialog.tsx` - Formulario de creación
- `ONGEditDialog.tsx` - Formulario de edición
- `MiembrosList.tsx` - Gestión de miembros

### Gestión de Aulas

**Página:** `app/(dashboard)/aulas/page.tsx`

**Componentes:**
- `AulaList.tsx` - Lista de aulas con selector de FCP
- `AulaDialog.tsx` - Crear/editar aula
- `AulaTutorDialog.tsx` - Asignar tutor a aula

### Gestión de Estudiantes

**Página:** `app/(dashboard)/estudiantes/page.tsx`

**Componentes:**
- `EstudianteList.tsx` - Lista con búsqueda y filtros
- `EstudianteDialog.tsx` - Crear/editar estudiante
- `EstudianteUploadDialog.tsx` - Carga masiva desde Excel
- `EstudianteMovimientoDialog.tsx` - Mover entre aulas

### Gestión de Asistencias

**Página:** `app/(dashboard)/asistencias/page.tsx`

**Componentes:**
- `AsistenciaList.tsx` - Lista de asistencias por fecha
- `AsistenciaCalendarView.tsx` - Vista de calendario mensual
- `AsistenciaRegistroDialog.tsx` - Registrar asistencias del día
- `AsistenciaEditDialog.tsx` - Editar asistencia

---

## Reportes Disponibles

### 1. Reporte General

**Componente:** `ReporteList.tsx`

**Características:**
- Reporte por rango de fechas
- Resumen por estudiante
- Totales de asistencias, faltas, permisos
- Exportación Excel y PDF
- Selector de FCP (facilitadores ven todas)

### 2. Reporte Mensual

**Componente:** `ReporteMensual.tsx`

**Características:**
- Reporte por mes y año específico
- Resumen por nivel/aula
- Porcentajes de asistencia
- Información del facilitador
- Exportación Excel y PDF
- Auto-generación desde dashboard

**URLs de acceso:**
- `/reportes?view=mensual&ong={id}&auto=true&year={año}&month={mes}`

### 3. Reporte por Nivel

**Componente:** `ReporteAsistenciaPorNivel.tsx`

**Características:**
- Reporte detallado por nivel/aula
- Vista de calendario con asistencias diarias
- Días completos vs días incompletos
- Exportación Excel y PDF
- Selector de FCP (facilitadores ven todas)

### 4. Reporte FCPs por Mes

**Componente:** `ReporteParticipantesPorMes.tsx`

**Características:**
- Reporte consolidado de todas las FCPs
- Porcentaje de asistencia por FCP por mes
- Vista anual con todos los meses
- Exportación Excel y PDF
- **NO tiene selector de FCP** (muestra todas automáticamente)
- Auto-generación desde dashboard

**URLs de acceso:**
- `/reportes?view=participantes-mes&auto=true`

**Página de Reportes:** `app/(dashboard)/reportes/page.tsx`
- Selector de tipo de reporte
- Botones para cada tipo de reporte
- Integración con parámetros de URL

---

## Migraciones de Base de Datos

### Migraciones Principales

1. **`20240101000000_initial_schema.sql`**
   - Esquema inicial de la base de datos
   - Tablas: ongs, usuarios, usuario_ong, aulas, estudiantes, asistencias, historial_movimientos
   - Políticas RLS básicas

2. **`20240101000013_create_new_rol_type.sql`**
   - Agregar rol 'facilitador' al ENUM

3. **`20240101000028_add_director_role.sql`**
   - Agregar rol 'director' al ENUM

4. **`20240101000029_add_fcp_fields.sql`**
   - Reestructurar tabla ongs con nuevos campos
   - Eliminar campos antiguos (nombre, descripcion, direccion, logo_url)
   - Agregar campos nuevos (numero_identificacion, razon_social, nombre_completo_contacto, ubicacion, rol_contacto)
   - Migración segura con verificación de campos

5. **`20240101000030_clean_all_data.sql`**
   - Limpiar todos los datos de la base de datos
   - Mantiene la estructura de tablas
   - Deshabilita RLS temporalmente para limpieza completa

### Otras Migraciones Importantes

- Políticas RLS para todos los roles
- Triggers para auditoría
- Funciones RPC para obtener roles
- Relaciones tutor-aula
- Invitaciones pendientes

---

## Cambios Recientes

### Cambio de Nomenclatura: ONG → FCP

**Fecha:** Enero 2025

**Cambios realizados:**
- Todos los textos visibles al usuario cambiados de "ONG" a "FCP"
- Menú de navegación: "ONGs" → "FCPs"
- Labels y títulos actualizados
- Reportes actualizados
- Documentación actualizada

**Archivos modificados:**
- `app/layout.tsx` - Metadata
- `components/layout/DashboardNav.tsx` - Menú
- Todos los componentes de reportes
- Todos los componentes de gestión de FCPs
- Páginas principales

### Nueva Estructura de Datos FCP

**Campos eliminados:**
- `nombre`
- `descripcion`
- `direccion`
- `logo_url`

**Campos nuevos:**
- `numero_identificacion` (obligatorio)
- `razon_social` (obligatorio)
- `nombre_completo_contacto` (obligatorio)
- `ubicacion` (obligatorio)
- `rol_contacto` (obligatorio)

**Campos mantenidos:**
- `telefono` (ahora obligatorio)
- `email` (ahora obligatorio)
- `activa` (boolean)
- Campos de auditoría (created_at, updated_at, etc.)

### Permisos Actualizados

**Facilitador:**
- ✅ Crear FCPs
- ✅ Ver todas las FCPs
- ✅ Ver reportes
- ✅ Gestionar miembros
- ❌ NO puede crear aulas
- ❌ NO puede agregar/editar estudiantes
- ❌ NO puede registrar/editar asistencias
- ❌ NO puede cambiar tutores

**Director:**
- ✅ Todas las funcionalidades de gestión
- ✅ Gestionar miembros
- ✅ Crear aulas
- ✅ Agregar estudiantes
- ✅ Registrar asistencias
- ✅ Ver reportes

**Secretario:**
- ✅ Mismas funcionalidades que Director
- ✅ Gestionar miembros
- ✅ Crear aulas
- ✅ Agregar estudiantes
- ✅ Registrar asistencias
- ✅ Ver reportes

**Tutor:**
- ✅ Solo lectura
- ✅ Ver asistencias de sus aulas
- ✅ Ver estudiantes de sus aulas

### Dashboard para Facilitadores

**Implementación:**
- Componente `ReportesMensualesResumen.tsx`
- Muestra resumen del mes actual
- Enlaces a reportes detallados
- Auto-generación de reportes desde enlaces

**Características:**
- Porcentaje de asistencia por FCP
- 0% mostrado en rojo si no hay asistencias
- Botón "Ver Detalles" → Reporte FCPs por Mes
- Botón "Ver Reporte" → Reporte Mensual específico

---

## Tecnologías Utilizadas

### Frontend

- **Next.js 14** - Framework React con App Router
- **React 18** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utility-first
- **shadcn/ui** - Componentes UI
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas

### Backend

- **Supabase** - Plataforma Backend-as-a-Service
  - PostgreSQL - Base de datos relacional
  - PostgREST - API REST automática
  - Auth - Autenticación OAuth
  - Storage - Almacenamiento de archivos
  - RLS - Row Level Security

### Librerías Adicionales

- **xlsx-js-style** - Exportación a Excel con estilos
- **jspdf** - Generación de PDFs
- **jspdf-autotable** - Tablas en PDFs
- **lucide-react** - Iconos

---

## Seguridad

### Row Level Security (RLS)

- Todas las tablas tienen políticas RLS activas
- Filtrado automático por FCP (`ong_id`)
- Verificación de roles en políticas
- Imposible bypassear desde la aplicación

### Autenticación

- Google OAuth 2.0
- Tokens JWT gestionados por Supabase
- Sesiones automáticas
- Renovación automática de tokens

### Validación

- Validación en frontend (Zod + React Hook Form)
- Validación en backend (políticas RLS)
- Validación en base de datos (constraints)

---

## Estado Actual del Proyecto

### ✅ Funcionalidades Completadas

1. **Autenticación y Autorización**
   - ✅ Google OAuth
   - ✅ 4 roles implementados
   - ✅ Control de acceso por rol

2. **Gestión de FCPs**
   - ✅ Crear FCPs (facilitadores)
   - ✅ Editar FCPs (facilitadores, directores)
   - ✅ Gestión de miembros
   - ✅ Nueva estructura de datos

3. **Gestión de Aulas**
   - ✅ Crear aulas (director, secretario)
   - ✅ Editar aulas
   - ✅ Asignar tutores

4. **Gestión de Estudiantes**
   - ✅ Agregar estudiantes
   - ✅ Carga masiva desde Excel
   - ✅ Editar estudiantes
   - ✅ Mover entre aulas

5. **Gestión de Asistencias**
   - ✅ Registro diario
   - ✅ Vista de calendario
   - ✅ Edición de asistencias
   - ✅ Estados: Presente, Faltó, Permiso

6. **Reportes**
   - ✅ Reporte General
   - ✅ Reporte Mensual
   - ✅ Reporte por Nivel
   - ✅ Reporte FCPs por Mes
   - ✅ Exportación Excel
   - ✅ Exportación PDF

7. **Dashboard**
   - ✅ Dashboard completo para director/secretario/tutor
   - ✅ Dashboard simplificado para facilitadores
   - ✅ Resumen de reportes mensuales

### 🔄 Mejoras Futuras Sugeridas

- [ ] Notificaciones automáticas
- [ ] Dashboard con gráficos avanzados
- [ ] Filtros avanzados en reportes
- [ ] Búsqueda global
- [ ] Exportación de datos completos
- [ ] Historial de cambios detallado
- [ ] Configuración de períodos escolares
- [ ] Múltiples años académicos

---

## Estructura de Archivos

```
Asistencia/
├── app/
│   ├── (auth)/              # Rutas de autenticación
│   ├── (dashboard)/         # Rutas protegidas
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── ongs/            # Gestión de FCPs
│   │   ├── aulas/           # Gestión de aulas
│   │   ├── estudiantes/    # Gestión de estudiantes
│   │   ├── asistencias/     # Gestión de asistencias
│   │   └── reportes/        # Reportes
│   └── api/                 # API Routes
│
├── components/
│   ├── ui/                  # Componentes UI base
│   ├── layout/              # Componentes de layout
│   ├── auth/                # Componentes de autenticación
│   └── features/            # Componentes por feature
│       ├── ongs/            # Gestión de FCPs
│       ├── aulas/           # Gestión de aulas
│       ├── estudiantes/    # Gestión de estudiantes
│       ├── asistencias/     # Gestión de asistencias
│       ├── reportes/        # Reportes
│       └── dashboard/      # Componentes del dashboard
│
├── hooks/
│   └── useUserRole.ts       # Hook para obtener rol del usuario
│
├── lib/
│   ├── supabase/           # Cliente Supabase
│   └── utils/              # Utilidades
│
├── supabase/
│   └── migrations/         # Migraciones SQL
│
└── docs/                   # Documentación
```

---

## Conclusión

El sistema está completamente funcional con todas las características principales implementadas:

- ✅ Gestión completa de FCPs con nueva estructura de datos
- ✅ 4 roles con permisos bien definidos
- ✅ Gestión completa de aulas, estudiantes y asistencias
- ✅ 4 tipos de reportes con exportación
- ✅ Dashboard diferenciado por rol
- ✅ Seguridad RLS implementada
- ✅ Interfaz moderna y responsive

El sistema está listo para uso en producción con todas las funcionalidades core implementadas y probadas.

---

**Documento generado:** Enero 2025  
**Última actualización:** Enero 2025  
**Versión del sistema:** 2.0

