# COTIZACIÓN - Sistema de Gestión de Asistencias para FCP

**Fecha:** Enero 2025  
**Versión:** 1.0  
**Vigencia:** 30 días

---

## INFORMACIÓN DEL PROYECTO

**Cliente:** [Nombre del Cliente]  
**Proyecto:** Sistema de Gestión de Asistencias para FCP  
**Tipo:** Desarrollo de Software Web  
**Plataforma:** Web (Next.js + Supabase)

---

## RESUMEN EJECUTIVO

Sistema web completo para la gestión de asistencias de estudiantes en Fundaciones de Cooperación Popular (FCP), con arquitectura multi-entidad que permite gestionar múltiples FCPs de forma independiente, registrar asistencias diarias, generar reportes automáticos y exportar datos en múltiples formatos.

---

## ALCANCE DEL PROYECTO

### Módulos Incluidos

#### 1. Autenticación y Autorización
- ✅ Autenticación con Google OAuth 2.0
- ✅ 4 roles de usuario: Facilitador, Director, Secretario, Tutor
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Gestión de sesiones y tokens JWT

#### 2. Gestión de FCPs
- ✅ Crear y editar información de FCPs
- ✅ Gestión de miembros y asignación de roles
- ✅ Datos de contacto y ubicación
- ✅ Estado activo/inactivo

#### 3. Gestión de Aulas
- ✅ Crear y editar aulas por FCP
- ✅ Asignar tutores a aulas
- ✅ Listado y búsqueda de aulas
- ✅ Estado activo/inactivo

#### 4. Gestión de Estudiantes
- ✅ Registro individual de estudiantes
- ✅ Carga masiva desde archivos Excel (.xlsx)
- ✅ Edición de información de estudiantes
- ✅ Movimiento de estudiantes entre aulas
- ✅ Búsqueda y filtrado avanzado
- ✅ Validación de duplicados

#### 5. Registro de Asistencias
- ✅ Registro diario de asistencias por aula
- ✅ Estados: Presente, Faltó, Permiso
- ✅ Vista de calendario mensual
- ✅ Edición de asistencias individuales
- ✅ Observaciones por asistencia
- ✅ Historial completo de cambios

#### 6. Reportes y Análisis
- ✅ Reporte General (por rango de fechas)
- ✅ Reporte Mensual (estadísticas del mes)
- ✅ Reporte por Nivel/Aula (vista detallada)
- ✅ Reporte FCPs por Mes (consolidado)
- ✅ Exportación a Excel (.xlsx)
- ✅ Exportación a PDF

#### 7. Dashboard
- ✅ Dashboard diferenciado por rol
- ✅ Estadísticas en tiempo real
- ✅ Resumen de reportes mensuales
- ✅ Accesos rápidos a funcionalidades

#### 8. Seguridad y Privacidad
- ✅ Row Level Security (RLS) en base de datos
- ✅ Aislamiento de datos por FCP
- ✅ Encriptación en tránsito (HTTPS/TLS)
- ✅ Encriptación en reposo (PostgreSQL)
- ✅ Auditoría completa de cambios
- ✅ Protección de datos sensibles

---

## ESPECIFICACIONES TÉCNICAS

### Stack Tecnológico

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend:**
- Supabase (PostgreSQL)
- PostgREST (API REST automática)
- Row Level Security (RLS)
- Google OAuth 2.0

**Características:**
- Responsive (móvil, tablet, desktop)
- Multi-idioma ready (estructura preparada)
- Optimizado para rendimiento
- Escalable hasta 4,500+ usuarios

---

## DESGLOSE DE COSTOS

### 1. DESARROLLO INICIAL

#### 1.1 Análisis y Diseño
- Análisis de requisitos
- Diseño de arquitectura
- Diseño de base de datos
- Diseño de interfaz de usuario
- Documentación técnica

**Horas:** 25 horas  
**Costo:** S/ 1,000.00 (S/ 40/hora × 25 horas)

#### 1.2 Desarrollo Frontend
- Configuración de proyecto Next.js
- Componentes UI reutilizables
- Páginas y rutas protegidas
- Formularios y validaciones
- Integración con backend

**Horas:** 70 horas  
**Costo:** S/ 2,800.00 (S/ 40/hora × 70 horas)

#### 1.3 Desarrollo Backend
- Configuración de Supabase
- Migraciones de base de datos
- Políticas RLS
- API Routes
- Funciones de negocio

**Horas:** 60 horas  
**Costo:** S/ 2,400.00 (S/ 40/hora × 60 horas)

#### 1.4 Funcionalidades Específicas
- Gestión de FCPs
- Gestión de Aulas
- Gestión de Estudiantes
- Registro de Asistencias
- Sistema de Reportes
- Dashboard

**Horas:** 90 horas  
**Costo:** S/ 3,600.00 (S/ 40/hora × 90 horas)

#### 1.5 Integraciones
- Google OAuth 2.0
- Exportación Excel/PDF
- Carga masiva desde Excel
- Sistema de autenticación

**Horas:** 25 horas  
**Costo:** S/ 1,000.00 (S/ 40/hora × 25 horas)

#### 1.6 Testing y Aseguramiento de Calidad
- Pruebas unitarias
- Pruebas de integración
- Pruebas de seguridad
- Pruebas de rendimiento
- Corrección de bugs

**Horas:** 35 horas  
**Costo:** S/ 1,400.00 (S/ 40/hora × 35 horas)

#### 1.7 Documentación
- Documentación técnica
- Documentación para usuarios
- Manuales de uso
- Guías de instalación

**Horas:** 18 horas  
**Costo:** S/ 720.00 (S/ 40/hora × 18 horas)

**SUBTOTAL DESARROLLO:** S/ 12,920.00 (323 horas totales)

---

### 2. DESPLIEGUE Y CONFIGURACIÓN

#### 2.1 Configuración de Infraestructura
- Configuración de Supabase
- Configuración de Google OAuth
- Configuración de dominio
- Configuración de SSL/HTTPS

**Horas:** 5 horas  
**Costo:** S/ 200.00 (S/ 40/hora × 5 horas)

#### 2.2 Migración de Datos (si aplica)
- Análisis de datos existentes
- Scripts de migración
- Validación de datos migrados
- Pruebas de migración

**Horas:** 10 horas  
**Costo:** S/ 400.00 (S/ 40/hora × 10 horas)

#### 2.3 Capacitación
- Sesión de capacitación para administradores (2 horas)
- Sesión de capacitación para usuarios finales (2 horas)
- Material de capacitación
- Videos tutoriales

**Horas:** 7 horas (4 horas capacitación + 3 horas preparación material)  
**Costo:** S/ 280.00 (S/ 40/hora × 7 horas)

**SUBTOTAL DESPLIEGUE:** S/ 880.00 (22 horas totales)

---

### 3. COSTOS MENSUALES RECURRENTES

#### 3.1 Hosting y Infraestructura

**Supabase (Backend + Base de Datos):**
- Plan Pro: $25 USD/mes
- O Plan Gratuito: $0 USD/mes (limitado)

**Hosting Frontend (Vercel/Netlify):**
- Plan Pro: $20 USD/mes
- O Plan Gratuito: $0 USD/mes (limitado)

**Total Hosting:** $45 USD/mes (o $0 USD/mes con planes gratuitos)

#### 3.2 Mantenimiento y Soporte

**Opción Básica (8 horas/mes):**
- Monitoreo del sistema
- Corrección de bugs críticos
- Actualizaciones de seguridad
- Soporte por email

**Costo:** S/ 320.00/mes (S/ 40/hora × 8 horas)

**Opción Estándar (16 horas/mes):**
- Todo lo de Opción Básica
- Mejoras menores
- Optimizaciones de rendimiento
- Soporte prioritario

**Costo:** S/ 640.00/mes (S/ 40/hora × 16 horas)

**Opción Premium (32 horas/mes):**
- Todo lo de Opción Estándar
- Nuevas funcionalidades menores
- Soporte 24/7
- Reuniones mensuales de revisión

**Costo:** S/ 1,280.00/mes (S/ 40/hora × 32 horas)

---

## RESUMEN DE COSTOS

### Costo Inicial (Una Sola Vez)

| Concepto | Horas | Monto (Soles) | Monto (USD)* |
|----------|-------|---------------|--------------|
| Desarrollo Inicial | 323 horas | S/ 12,920.00 | ~$3,446 USD |
| Despliegue y Configuración | 22 horas | S/ 880.00 | ~$235 USD |
| **TOTAL INICIAL** | **345 horas** | **S/ 13,800.00** | **~$3,680 USD** |

*Conversión aproximada: 1 USD ≈ 3.75 PEN (tipo de cambio referencial)

### Costos Recurrentes (Mensuales)

| Concepto | Monto (Soles) | Monto (USD)* |
|----------|---------------|--------------|
| Hosting e Infraestructura | S/ 169.00/mes | $45 USD/mes |
| Mantenimiento (Opción Básica) | S/ 320.00/mes | ~$85 USD/mes |
| **TOTAL MENSUAL** | **S/ 489.00/mes** | **~$130 USD/mes** |

*Nota: Hosting puede ser S/ 0.00/mes con planes gratuitos (limitado)

---

## OPCIONES DE PAGO

### Opción 1: Pago Único
- 50% al inicio del proyecto: **S/ 6,900.00**
- 50% al finalizar y entregar el sistema: **S/ 6,900.00**
- **Descuento del 5%** por pago anticipado completo: **S/ 13,110.00** (ahorro de S/ 690.00)

### Opción 2: Pago por Etapas
- 30% al inicio del proyecto: **S/ 4,140.00**
- 30% al completar desarrollo frontend: **S/ 4,140.00**
- 30% al completar desarrollo backend: **S/ 4,140.00**
- 10% al finalizar y entregar el sistema: **S/ 1,380.00**

### Opción 3: Pago Mensual
- Pago mensual durante el desarrollo
- Dividido en 3 meses: **S/ 4,600.00/mes**
- Sin intereses adicionales

---

## TIEMPO DE DESARROLLO

### Cronograma Estimado

| Fase | Duración | Descripción |
|------|----------|-------------|
| Análisis y Diseño | 1 semana | Revisión de requisitos, diseño de arquitectura |
| Desarrollo Frontend | 2-3 semanas | Implementación de interfaz y componentes |
| Desarrollo Backend | 2-3 semanas | API, base de datos, lógica de negocio |
| Integración y Testing | 1-2 semanas | Integración completa, pruebas |
| Despliegue y Capacitación | 1 semana | Configuración, migración, capacitación |
| **TOTAL** | **7-10 semanas** | **Aproximadamente 2-2.5 meses** |

**Nota:** Los tiempos pueden variar según la complejidad de requisitos adicionales y disponibilidad de información.

---

## GARANTÍAS Y SOPORTE

### Garantía de Desarrollo
- **3 meses** de garantía post-entrega
- Corrección gratuita de bugs encontrados
- Ajustes menores sin costo adicional

### Soporte Post-Entrega
- Soporte por email durante horario laboral
- Tiempo de respuesta: 24-48 horas hábiles
- Actualizaciones de seguridad incluidas

---

## ENTREGABLES

### Código Fuente
- ✅ Código completo del proyecto
- ✅ Documentación técnica
- ✅ Scripts de migración de base de datos
- ✅ Configuraciones y variables de entorno

### Documentación
- ✅ Documentación técnica (arquitectura, API)
- ✅ Documentación para usuarios finales
- ✅ Manuales de uso por módulo
- ✅ Guías de instalación y configuración

### Sistema Funcional
- ✅ Sistema desplegado y funcionando
- ✅ Base de datos configurada
- ✅ Autenticación configurada
- ✅ Usuarios de prueba creados

### Capacitación
- ✅ Sesiones de capacitación
- ✅ Material de capacitación
- ✅ Videos tutoriales
- ✅ Acceso a documentación

---

## EXCLUSIONES

Los siguientes elementos **NO están incluidos** en esta cotización:

- ❌ Diseño gráfico personalizado (logos, branding)
- ❌ Desarrollo de aplicación móvil nativa
- ❌ Integraciones con sistemas externos no especificados
- ❌ Funcionalidades no incluidas en el alcance
- ❌ Hosting de servidores propios (se usa Supabase/Vercel)
- ❌ Dominio personalizado (se puede configurar adicionalmente)
- ❌ Certificados SSL personalizados (incluidos en hosting)
- ❌ Migración de datos de sistemas legacy complejos

---

## TÉRMINOS Y CONDICIONES

### Propiedad Intelectual
- El código fuente desarrollado será propiedad del cliente
- Se otorga licencia de uso perpetua
- El desarrollador puede usar el proyecto como portfolio (sin datos sensibles)

### Modificaciones y Cambios
- Cambios al alcance original pueden afectar el costo y tiempo
- Cambios menores pueden ser incluidos sin costo adicional
- Cambios mayores requieren cotización adicional

### Cancelación
- Si el proyecto se cancela antes de iniciar: sin costo
- Si se cancela durante desarrollo: se cobra trabajo realizado
- Si se cancela después de entrega: sin reembolso

### Confidencialidad
- Toda la información del proyecto es confidencial
- No se compartirá información con terceros
- Protección de datos sensibles garantizada

---

## PRÓXIMOS PASOS

1. **Revisión de Cotización**
   - Revisar alcance y costos
   - Aclarar dudas o modificaciones

2. **Aprobación**
   - Aprobar cotización
   - Firmar acuerdo de trabajo

3. **Inicio del Proyecto**
   - Pago inicial (según opción elegida)
   - Reunión de kick-off
   - Inicio de desarrollo

---

## CONTACTO

Para consultas, modificaciones o aprobación de esta cotización:

**Desarrollador:** [Tu Nombre]  
**Email:** [tu-email@ejemplo.com]  
**Teléfono:** [tu-teléfono]  
**Disponibilidad:** [horarios de atención]

---

## NOTAS ADICIONALES

- Esta cotización tiene una vigencia de **30 días** desde la fecha de emisión
- Los precios están en **USD** (dólares estadounidenses)
- Los costos de hosting pueden variar según el proveedor elegido
- Se puede ajustar el alcance según necesidades específicas
- Se pueden agregar funcionalidades adicionales con cotización separada

---

**Fecha de Emisión:** [Fecha]  
**Vigencia:** 30 días  
**Versión:** 1.0

---

*Esta cotización es confidencial y está destinada únicamente al cliente mencionado.*

