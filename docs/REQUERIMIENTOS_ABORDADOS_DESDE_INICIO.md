# Requerimientos abordados desde el inicio del proyecto

Este documento consolida **todos los requerimientos** definidos para el sistema de Gestión de Asistencias (FCPs / ONG) y que han sido abordados desde el inicio del proyecto.  
Fuente principal: `docs/REQUERIMIENTOS.md` y `docs/MVP.md`.

---

## 1. Requerimientos funcionales

### 1.1 Autenticación y autorización

| Id       | Requerimiento                     | Descripción breve |
|----------|-----------------------------------|-------------------|
| RF-001   | Autenticación con Google OAuth    | Inicio de sesión con cuenta Google; creación/sincronización de usuario en `usuarios`; redirección a "pendiente" si no hay roles. |
| RF-002   | Gestión de roles y permisos      | Roles: Facilitador, Director, Secretario, Tutor. Múltiples roles por usuario; vista limitada a FCPs donde tiene rol. |
| RF-003   | Selección de rol activo           | Usuario con un solo rol: selección automática. Con varios: pantalla de selección; rol en cookies/localStorage; persistencia entre sesiones. |

### 1.2 Gestión de FCPs (Fondos de Cooperación)

| Id       | Requerimiento                | Descripción breve |
|----------|------------------------------|-------------------|
| RF-004   | Creación de FCPs             | Solo facilitador; datos: razón social, número de identificación, contacto; opción de asignar director. |
| RF-005   | Visualización de FCPs        | Cada rol ve solo las FCPs donde tiene ese rol asignado. |
| RF-006   | Gestión de miembros de FCP   | Director/Secretario: agregar miembros por email; asignar roles; invitaciones pendientes; asociación al registrarse. |

### 1.3 Gestión de aulas

| Id       | Requerimiento                  | Descripción breve |
|----------|--------------------------------|-------------------|
| RF-007   | Creación y gestión de aulas    | Director/Secretario: crear, editar, eliminar aulas (nombre, nivel). Tutores solo ven aulas asignadas; facilitador/director/secretario ven todas las de su FCP. |
| RF-008   | Asignación de tutores a aulas  | Un tutor puede tener varias aulas; solo ve estudiantes de sus aulas asignadas. |

### 1.4 Gestión de estudiantes

| Id       | Requerimiento                      | Descripción breve |
|----------|------------------------------------|-------------------|
| RF-009   | Registro individual de estudiantes | Código único, nombre completo, aula; código único por FCP. |
| RF-010   | Carga masiva desde Excel           | Formato .xlsx; columnas Código, Nombre completo, Aula; validación de duplicados/errores; resumen y reintento. |
| RF-011   | Movimiento entre aulas             | Mover estudiante de un aula a otra; conservar historial de asistencias; historial de movimientos con quién y cuándo. |

### 1.5 Registro de asistencias

| Id       | Requerimiento           | Descripción breve |
|----------|-------------------------|-------------------|
| RF-012   | Registro diario         | Por día y por aula; opción de marcar a todos como "Presente"; estados: Presente, Faltó, Permiso. |
| RF-013   | Edición de asistencias | Editar asistencias de días anteriores; registro de quién y cuándo editó; historial de cambios. |
| RF-014   | Visualización          | Tutores: solo sus aulas; director/secretario/facilitador: todas las de su FCP; filtros por fecha, aula, estudiante; vista calendario. |

### 1.6 Reportes

| Id       | Requerimiento     | Descripción breve |
|----------|-------------------|-------------------|
| RF-015   | Reporte mensual   | Estadísticas del mes; totales por aula; porcentaje de asistencia; días con asistencia incompleta; responsable (nombre y rol). |
| RF-016   | Reporte por nivel | Agrupado por nivel; totales por nivel; fechas con asistencias; días incompletos; porcentajes y subtotales; responsable. |
| RF-017   | Reporte general   | Estadísticas del mes; todas las fechas con asistencias; días incompletos; responsable. |
| RF-018   | Exportación       | Excel (.xlsx) y PDF con formato; metadatos (fecha de generación, responsable, período). |

### 1.7 Dashboard

| Id       | Requerimiento     | Descripción breve |
|----------|-------------------|-------------------|
| RF-019   | Dashboard principal | Total aulas y estudiantes según rol; tutores: solo sus aulas; facilitador/director/secretario: todas de su FCP; facilitador: % asistencia FCPs del mes; director/secretario: % por nivel del mes; tutor: asistencias/faltos de sus salones del mes. |

---

## 2. Requerimientos no funcionales

### 2.1 Seguridad

| Id        | Requerimiento       | Descripción breve |
|-----------|---------------------|-------------------|
| RNF-001   | Row Level Security  | RLS en todas las tablas; acceso solo a datos de FCPs asignadas; políticas automáticas; no bypassear desde frontend. |
| RNF-002   | Autenticación JWT   | Tokens por Supabase Auth; renovación automática; expiración configurada. |
| RNF-003   | Validación de datos | Validación en frontend (Zod) y en backend; mensajes de error claros. |

### 2.2 Rendimiento

| Id        | Requerimiento       | Descripción breve |
|-----------|---------------------|-------------------|
| RNF-004   | Tiempo de respuesta | Páginas &lt; 2 s; consultas con índices; paginación en listas grandes. |
| RNF-005   | Escalabilidad       | Múltiples FCPs sin degradación; arquitectura que permita más recursos. |

### 2.3 Usabilidad

| Id        | Requerimiento     | Descripción breve |
|-----------|-------------------|-------------------|
| RNF-006   | Interfaz intuitiva| Diseño limpio; navegación clara; mensajes y feedback visual. |
| RNF-007   | Responsive design | Desktop, tablet y móvil; adaptación al tamaño de pantalla. |

### 2.4 Mantenibilidad

| Id        | Requerimiento           | Descripción breve |
|-----------|-------------------------|-------------------|
| RNF-008   | Código limpio           | Código documentado; estructura clara; TypeScript; separación de responsabilidades. |
| RNF-009   | Migraciones de BD       | Migraciones SQL versionadas; ejecución ordenada; documentación de cambios. |

---

## 3. Infraestructura y configuración

- **Servicios**: Supabase (PostgreSQL, Auth, Storage), Google OAuth, hosting (Vercel/Next.js).
- **Variables de entorno**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; OAuth en Supabase Dashboard; opcional `NEXT_PUBLIC_APP_TIMEZONE` para zona horaria de la app.

---

## 4. Mejoras adicionales abordadas en desarrollo

Además de los requerimientos formales, en el proyecto se han abordado:

- **Fechas en reportes**: Corrección para que el rango del mes no incluya el día siguiente por uso de UTC (`toLocalDateString` en reportes).
- **Zona horaria de la aplicación**: "Hoy" y "mes actual" no dependen de la zona del servidor (Vercel); zona configurable (`NEXT_PUBLIC_APP_TIMEZONE`, por defecto America/Lima).
- **Documentación de seguridad**: Resumen de medidas (RLS, auth, cookies) y recomendaciones de validación (`CAMPOS_SIN_VALIDACION_VULNERABILIDAD.md`).
- **Confidencialidad en tránsito**: Uso de HTTPS con Supabase y en producción.

---

## 5. Fuera del alcance actual (futuro)

Según `REQUERIMIENTOS.md` y `MVP.md`:

- Sistema de pagos o planes de suscripción  
- Notificaciones automáticas por email  
- Aplicación móvil nativa  
- IA para análisis predictivo  
- Reconocimiento facial para registro automático  
- Integración con sistemas externos  
- Dashboard avanzado con gráficos y métricas  

---

**Referencias**: `docs/REQUERIMIENTOS.md`, `docs/MVP.md`, `README.md`.  
**Última actualización**: documento generado a partir de la documentación del proyecto.
