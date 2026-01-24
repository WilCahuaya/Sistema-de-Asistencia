# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA
## Sistema Web de Gestión de Asistencias para FCPs (Fondos de Cooperación para el Desarrollo)

---

## 1. INTRODUCCIÓN

### 1.1 Propósito
Este documento describe los requerimientos funcionales y no funcionales del sistema **Asistencia**, una plataforma web diseñada para la gestión de asistencias de estudiantes en **Fondos de Cooperación para el Desarrollo (FCPs)**.

### 1.2 Objetivo Principal
Resolver la pérdida de control de asistencias y la elaboración manual de reportes, proporcionando una solución digital simple, segura y escalable que permita:
- Registrar y gestionar asistencias diarias de estudiantes
- Centralizar la información por entidad (FCP)
- Generar reportes automáticos semanales, mensuales y generales
- Reducir errores humanos y tiempos administrativos

### 1.3 Alcance
Sistema web completo con arquitectura multi-entidad, control de acceso por roles, y generación automática de reportes.

---

## 2. REQUERIMIENTOS FUNCIONALES

### 2.1 Autenticación y Autorización

#### RF-001: Autenticación con Google OAuth
- **Descripción**: El sistema debe permitir el inicio de sesión mediante Google OAuth 2.0
- **Prioridad**: ALTA
- **Criterios de aceptación**:
  - Los usuarios pueden iniciar sesión con su cuenta de Google
  - Se crea automáticamente un registro en la tabla `usuarios` cuando un usuario se autentica por primera vez
  - El sistema sincroniza automáticamente nombre, email y avatar desde Google
  - Los usuarios sin roles asignados son redirigidos a una página de "pendiente"

#### RF-002: Gestión de Roles y Permisos
- **Descripción**: El sistema debe soportar múltiples roles con permisos específicos
- **Prioridad**: ALTA
- **Roles del sistema**:
  - **Facilitador**: Gestión de múltiples FCPs, puede crear FCPs, ver miembros
  - **Director**: Gestión completa de una FCP específica
  - **Secretario**: Gestión completa de una FCP específica
  - **Tutor**: Solo visualización de asistencias de aulas asignadas
- **Criterios de aceptación**:
  - Un usuario puede tener múltiples roles en diferentes FCPs
  - Los usuarios solo ven las FCPs donde tienen roles asignados
  - Los facilitadores solo ven las FCPs donde tienen el rol de facilitador asignado
  - Los directores solo ven las FCPs donde tienen el rol de director asignado
  - Los secretarios solo ven las FCPs donde tienen el rol de secretario asignado
  - Los tutores solo ven las FCPs donde tienen el rol de tutor asignado
  - Los usuarios pueden seleccionar el rol con el que desean trabajar si tienen múltiples roles, todo el ambiente, absolutamente todo el ambiente de la aplicacion se basara al rol seleccionado.

#### RF-003: Selección de Rol Activo
- **Descripción**: Los usuarios con múltiples roles deben poder seleccionar con cuál rol trabajar
- **Prioridad**: ya no hay prioridad ya que el usuario selecciona un rol
- **Criterios de aceptación**:
  - Si un usuario tiene un solo rol, se selecciona automáticamente
  - Si un usuario tiene múltiples roles, se muestra toda las páginas de selección
  - El rol seleccionado se guarda en localStorage y cookies
  - El rol seleccionado persiste entre sesiones

### 2.2 Gestión de FCPs (Fondos de Cooperación)

#### RF-004: Creación de FCPs
- **Descripción**: Los usuarios autenticados con rol facilitador pueden crear nuevas FCPs
- **Criterios de aceptación**:
  - Solo el usuario autenticado con rol facilitador puede crear una FCP
  - Los datos requeridos incluyen: razón social, número de identificación, contacto
  - El usuario que crea la FCP puede verla inmediatamente después de crearla
  - Se puede asignar un director a la FCP durante la creación

#### RF-005: Visualización de FCPs
- **Descripción**: Los usuarios solo deben ver las FCPs donde tienen roles asignados
- **Criterios de aceptación**:
  - Facilitadores solo ven FCPs donde tienen el rol de facilitador asignado
  - Directores solo ven FCPs donde tienen el rol de director asignado
  - Secretarios solo ven FCPs donde tienen el rol de secretario asignado
  - Tutores solo ven FCPs donde tienen el rol de tutor asignado

#### RF-006: Gestión de Miembros de FCP
- **Descripción**: Los directores y secretarios pueden agregar miembros a su FCP
- **Criterios de aceptación**:
  - Los directores y secretarios pueden agregar nuevos miembros por email
  - Se pueden asignar roles (director, secretario, tutor) a los miembros
  - Se pueden crear invitaciones pendientes (usuario aún no registrado)
  - Cuando un usuario se registra, se asocian automáticamente las invitaciones pendientes

### 2.3 Gestión de Aulas

#### RF-007: Creación y Gestión de Aulas
- **Descripción**: Los directores y secretarios pueden crear y gestionar aulas
- **Criterios de aceptación**:
  - Se pueden crear aulas con nombre y nivel
  - Se pueden editar y eliminar aulas
  - Los tutores solo ven las aulas asignadas a ellos
  - Los facilitadores, directores y secretarios ven todas las aulas de sus FCPs

#### RF-008: Asignación de Tutores a Aulas
- **Descripción**: Los directores y secretarios pueden asignar tutores a aulas específicas
- **Criterios de aceptación**:
  - Un tutor puede estar asignado a múltiples aulas
  - Los tutores solo ven estudiantes de sus aulas asignadas

### 2.4 Gestión de Estudiantes

#### RF-009: Registro Individual de Estudiantes
- **Descripción**: Los directores y secretarios pueden registrar estudiantes individualmente
- **Criterios de aceptación**:
  - Datos requeridos: código único, nombre completo, aula asignada
  - Se valida que el código sea único dentro de la FCP
  - Se puede asignar un estudiante a un aula al momento de creación

#### RF-010: Carga Masiva de Estudiantes
- **Descripción**: Los directores y secretarios pueden cargar estudiantes desde archivos Excel
- **Criterios de aceptación**:
  - Formato de archivo: Excel (.xlsx)
  - Columnas requeridas: Código, Nombre completo, Aula
  - El sistema valida duplicados y errores antes de guardar
  - Se muestra un resumen de estudiantes cargados y errores encontrados
  - Se pueden corregir errores y reintentar la carga

#### RF-011: Movimiento de Estudiantes entre Aulas
- **Descripción**: Los directores y secretarios pueden mover estudiantes entre aulas
- **Criterios de aceptación**:
  - Se puede mover un estudiante de un aula a otra
  - El historial de asistencias se conserva
  - El cambio queda registrado en el historial de movimientos
  - Se registra quién hizo el cambio y cuándo

### 2.5 Registro de Asistencias

#### RF-012: Registro Diario de Asistencias
- **Descripción**: Los directores y secretarios pueden registrar asistencias diarias
- **Criterios de aceptación**:
  - La asistencia se registra por día y por aula
  - se puede registrar a todos los estudiantes como "Presente" con un icono
  - Se puede cambiar el estado de cada estudiante individualmente
  - Estados disponibles: Presente, Faltó, Permiso

#### RF-013: Edición de Asistencias
- **Descripción**: Los directores y secretarios pueden editar asistencias registradas
- **Criterios de aceptación**:
  - Se pueden editar asistencias de días anteriores
  - Se registra quién editó y cuándo se editó
  - Se mantiene el historial de cambios

#### RF-014: Visualización de Asistencias
- **Descripción**: Todos los usuarios pueden ver asistencias según sus permisos
- **Criterios de aceptación**:
  - Los tutores solo ven asistencias de sus aulas asignadas
  - Los facilitadores, directores y secretarios ven todas las asistencias de sus FCPs
  - Se puede filtrar por fecha, aula y estudiante
  - Vista de calendario para navegación por fechas

### 2.6 Reportes

#### RF-015: Reporte Mensual
- **Descripción**: Generar reporte mensual de asistencias
- **Criterios de aceptación**:
  - Muestra estadísticas del mes seleccionado
  - Incluye totales de presentes y registrados por aula
  - Incluye porcentaje de asistencia por aula y los totales
  - Muestra resumen por aula
  - Identifica días con asistencia incompleta 
  - Muestra el nombre y rol del responsable que genera el reporte

#### RF-016: Reporte por Nivel
- **Descripción**: Generar reporte de asistencias agrupado por nivel
- **Criterios de aceptación**:
  - Agrupa estadísticas por nivel de aula
  - Muestra totales por nivel
  - Incluye todas las fechas con asistencias registradas
  - Identifica días con asistencia incompleta
  - Muestra el nombre y rol del responsable que genera el reporte
  muestra porcentajes de asistio, falto y permiso
  muestra subtotales

#### RF-017: Reporte General
- **Descripción**: Generar reporte general de asistencias
- **Criterios de aceptación**:
  - Muestra estadísticas del mes seleccionado
  - Incluye todas las fechas con asistencias registradas
  - Identifica días con asistencia incompleta
  - Muestra el nombre y rol del responsable que genera el reporte

#### RF-018: Exportación de Reportes
- **Descripción**: Exportar reportes en diferentes formatos
- **Criterios de aceptación**:
  - Exportación a Excel (.xlsx) con formato y estilos
  - Exportación a PDF con formato profesional
  - Los reportes exportados incluyen toda la información visible en pantalla
  - Se incluyen metadatos (fecha de generación, responsable, período)

### 2.7 Dashboard

#### RF-019: Dashboard Principal
- **Descripción**: Mostrar estadísticas y resumen en el dashboard
- **Criterios de aceptación**:
  - Muestra total de aulas y estudiantes según el rol del usuario
  - Los tutores ven solo sus aulas asignadas
  - Los facilitadores, directores y secretarios ven todas las aulas y estudiantes de sus FCPs
  - Muestra información de la FCP seleccionada
  - El facilitador ve el porcentaje de asistencia de las fpcs que tiene a su cargo del mes actual
  - El director y secretario ven los porcentajes de asitencia por nivel del mes actual
  - el tutoe ve la cantidad de asistios y faltos de sus salones que tien a cargo del mes actual
---

## 3. REQUERIMIENTOS NO FUNCIONALES

### 3.1 Seguridad

#### RNF-001: Row Level Security (RLS)
- **Descripción**: Implementar seguridad a nivel de fila en la base de datos
- **Prioridad**: CRÍTICA
- **Criterios de aceptación**:
  - Todas las tablas tienen RLS habilitado
  - Los usuarios solo pueden acceder a datos de sus FCPs asignadas
  - Las políticas RLS se aplican automáticamente en todas las consultas
  - No es posible bypassear las políticas RLS desde el frontend

#### RNF-002: Autenticación JWT
- **Descripción**: Usar tokens JWT para autenticación
- **Prioridad**: CRÍTICA
- **Criterios de aceptación**:
  - Los tokens se generan automáticamente por Supabase Auth
  - Los tokens se renuevan automáticamente
  - Los tokens expiran después de un tiempo configurado

#### RNF-003: Validación de Datos
- **Descripción**: Validar todos los datos de entrada
- **Prioridad**: ALTA
- **Criterios de aceptación**:
  - Validación en frontend con Zod
  - Validación en backend antes de guardar
  - Mensajes de error claros y descriptivos

### 3.2 Rendimiento

#### RNF-004: Tiempo de Respuesta
- **Descripción**: El sistema debe responder rápidamente
- **Prioridad**: MEDIA
- **Criterios de aceptación**:
  - Las páginas cargan en menos de 2 segundos
  - Las consultas a la base de datos se optimizan con índices
  - Se usa paginación para listas grandes

#### RNF-005: Escalabilidad
- **Descripción**: El sistema debe escalar con el crecimiento
- **Prioridad**: MEDIA
- **Criterios de aceptación**:
  - Soporta múltiples FCPs sin degradación de rendimiento
  - La arquitectura permite agregar más recursos según necesidad

### 3.3 Usabilidad

#### RNF-006: Interfaz Intuitiva
- **Descripción**: La interfaz debe ser fácil de usar
- **Prioridad**: ALTA
- **Criterios de aceptación**:
  - Diseño limpio y moderno
  - Navegación clara y consistente
  - Mensajes de error y éxito claros
  - Feedback visual para acciones del usuario

#### RNF-007: Responsive Design
- **Descripción**: El sistema debe funcionar en diferentes dispositivos
- **Prioridad**: MEDIA
- **Criterios de aceptación**:
  - Funciona en desktop, tablet y móvil
  - La interfaz se adapta al tamaño de pantalla
  - Las funcionalidades principales están disponibles en móvil

### 3.4 Mantenibilidad

#### RNF-008: Código Limpio
- **Descripción**: El código debe ser mantenible
- **Prioridad**: ALTA
- **Criterios de aceptación**:
  - Código bien documentado
  - Estructura de carpetas clara
  - Uso de TypeScript para type safety
  - Separación de responsabilidades

#### RNF-009: Migraciones de Base de Datos
- **Descripción**: Las migraciones deben ser versionadas y reversibles
- **Prioridad**: ALTA
- **Criterios de aceptación**:
  - Todas las migraciones están en archivos SQL versionados
  - Las migraciones se pueden ejecutar en orden
  - Se documentan los cambios en cada migración

---

## 4. PERMISOS POR ROL

### 4.1 Facilitador
- ✅ Crear FCPs
- ✅ Ver solo FCPs donde tiene el rol asignado
- ✅ Gestionar miembros de sus FCPs asignadas
- ✅ Ver todas las aulas y estudiantes de sus FCPs asignadas
- ✅ Ver reportes de sus FCPs asignadas
- ✅ Exportar reportes
- ❌ No puede registrar asistencias directamente
- ❌ No puede crear aulas o estudiantes directamente

### 4.2 Director
- ✅ Ver solo FCPs donde tiene el rol asignado
- ✅ Crear y gestionar aulas
- ✅ Crear y gestionar estudiantes (individual y masivo)
- ✅ Registrar asistencias
- ✅ Editar y eliminar asistencias
- ✅ Mover estudiantes entre aulas
- ✅ Ver reportes
- ✅ Exportar reportes
- ✅ Gestionar miembros de su FCP

### 4.3 Secretario
- ✅ Ver solo FCPs donde tiene el rol asignado
- ✅ Crear y gestionar aulas
- ✅ Crear y gestionar estudiantes (individual y masivo)
- ✅ Registrar asistencias
- ✅ Editar y eliminar asistencias
- ✅ Mover estudiantes entre aulas
- ✅ Ver reportes
- ✅ Exportar reportes
- ✅ Gestionar miembros de su FCP

### 4.4 Tutor
- ✅ Ver solo FCPs donde tiene el rol asignado
- ✅ Ver solo aulas asignadas
- ✅ Ver solo estudiantes de aulas asignadas
- ✅ Ver asistencias de aulas asignadas
- ❌ No puede crear, editar o eliminar datos
- ❌ No puede registrar asistencias
- ❌ No puede ver reportes
- ❌ No puede exportar reportes

---

## 5. ARQUITECTURA TÉCNICA

### 5.1 Stack Tecnológico

#### Frontend
- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **UI Library**: React 18
- **Estilos**: Tailwind CSS
- **Componentes UI**: shadcn/ui
- **Formularios**: React Hook Form + Zod
- **Estado Global**: Context API

#### Backend
- **Plataforma**: Supabase
- **Base de Datos**: PostgreSQL
- **API**: PostgREST (automática desde PostgreSQL)
- **Autenticación**: Supabase Auth (Google OAuth)
- **Storage**: Supabase Storage (para archivos Excel)

#### Exportación
- **Excel**: xlsx-js-style
- **PDF**: jsPDF + jspdf-autotable

### 5.2 Estructura de Base de Datos

#### Tablas Principales
- `usuarios`: Información de usuarios del sistema
- `fcps`: Información de Fondos de Cooperación
- `fcp_miembros`: Relación Usuario-FCP con rol
- `aulas`: Aulas por FCP
- `estudiantes`: Estudiantes por aula
- `asistencias`: Registros de asistencia diaria
- `tutor_aula`: Relación Tutor-Aula
- `historial_movimientos`: Historial de cambios de aula de estudiantes

### 5.3 Seguridad

#### Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado
- Políticas RLS basadas en roles y FCPs asignadas
- Funciones SECURITY DEFINER para evitar recursión
- Verificación de permisos en múltiples capas

#### Autenticación
- Google OAuth 2.0
- Tokens JWT automáticos
- Renovación automática de tokens
- Sincronización automática de usuarios

---

## 6. REQUERIMIENTOS DE INFRAESTRUCTURA

### 6.1 Servicios Requeridos
- **Supabase**: Proyecto activo con PostgreSQL, Auth y Storage habilitados
- **Google Cloud**: Proyecto con OAuth 2.0 configurado
- **Hosting**: Vercel, Netlify u otro servicio compatible con Next.js

### 6.2 Variables de Entorno
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima de Supabase
- `GOOGLE_CLIENT_ID`: ID de cliente de Google OAuth
- `GOOGLE_CLIENT_SECRET`: Secreto de cliente de Google OAuth

---

## 7. CASOS DE USO PRINCIPALES

### CU-001: Registro de Asistencia Diaria
1. Usuario (Director/Secretario) selecciona una FCP
2. Selecciona un aula
3. Selecciona una fecha
4. El sistema muestra todos los estudiantes del aula
5. Por defecto, todos están marcados como "Presente"
6. Usuario modifica el estado de los estudiantes que faltaron o tienen permiso
7. Usuario guarda la asistencia
8. El sistema registra quién y cuándo registró la asistencia

### CU-002: Generación de Reporte Mensual
1. Usuario (Facilitador/Director/Secretario) va a la sección de Reportes
2. Selecciona "Reporte Mensual"
3. Selecciona una FCP (si tiene múltiples)
4. Selecciona un mes
5. El sistema genera el reporte con estadísticas
6. Usuario puede exportar a Excel o PDF
7. El reporte incluye el nombre y rol del responsable

### CU-003: Carga Masiva de Estudiantes
1. Usuario (Director/Secretario) va a la sección de Estudiantes
2. Selecciona "Cargar desde Excel"
3. Descarga la plantilla o usa un archivo existente
4. Sube el archivo Excel
5. El sistema valida los datos
6. Muestra resumen de estudiantes válidos y errores
7. Usuario corrige errores si es necesario
8. Usuario confirma la carga
9. El sistema guarda los estudiantes

---

## 8. RESTRICCIONES Y LIMITACIONES

### 8.1 Restricciones de Negocio
- Un estudiante solo puede pertenecer a una aula a la vez
- Un usuario puede tener múltiples roles en diferentes FCPs
- Los facilitadores solo ven FCPs donde tienen el rol asignado (no todas)
- Los facilitadores del sistema (fcp_id = null) no se muestran en la selección de roles

### 8.2 Limitaciones Técnicas
- Requiere conexión a internet para funcionar
- Depende de servicios externos (Supabase, Google OAuth)
- Los reportes grandes pueden tardar en generarse

---

## 9. REQUERIMIENTOS FUTUROS (Fuera del Alcance Actual)

- Sistema de pagos o planes de suscripción
- Notificaciones automáticas por email
- Aplicación móvil nativa
- Inteligencia artificial para análisis predictivo
- Reconocimiento facial para registro automático
- Integración con sistemas externos
- Dashboard avanzado con gráficos y métricas

---

## 10. CRITERIOS DE ACEPTACIÓN GENERALES

### 10.1 Funcionalidad
- Todas las funcionalidades descritas deben estar implementadas y funcionando
- Los datos deben persistir correctamente entre sesiones
- Los reportes deben ser precisos y completos

### 10.2 Seguridad
- Los usuarios solo pueden acceder a datos de sus FCPs asignadas
- Las políticas RLS deben funcionar correctamente
- La autenticación debe ser segura y confiable

### 10.3 Usabilidad
- La interfaz debe ser intuitiva y fácil de usar
- Los mensajes de error deben ser claros
- El sistema debe proporcionar feedback visual adecuado

### 10.4 Rendimiento
- El sistema debe responder en tiempos razonables
- Las páginas deben cargar rápidamente
- Las consultas deben estar optimizadas

---

**Documento creado**: 2024
**Versión**: 1.0
**Última actualización**: Incluye correcciones de lógica para facilitadores, directores, secretarios y tutores

