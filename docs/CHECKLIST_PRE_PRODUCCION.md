# ✅ Checklist Pre-Producción

## 📋 Antes de Desplegar a Producción

### 1. 🔍 Limpieza de Código

#### 1.1. Remover Logs de Depuración
- [ ] **Reportes**: Remover o comentar `console.log` de depuración en:
  - `components/features/reportes/ReporteList.tsx` (52 logs)
  - `components/features/reportes/ReporteAsistenciaPorNivel.tsx` (23 logs)
  - `components/features/reportes/ReporteMensual.tsx` (18 logs)
  - `components/features/reportes/ReporteParticipantesPorMes.tsx` (25 logs)
- [ ] **Contextos**: Revisar logs en:
  - `contexts/SelectedRoleContext.tsx`
  - `contexts/FCPContext.tsx`
- [ ] **Componentes de Debug**: Considerar remover o deshabilitar:
  - `components/debug/RoleLogger.tsx` (o hacerlo condicional con variable de entorno)

**Nota**: Mantener solo logs críticos de errores (`console.error`).

#### 1.2. Código Comentado
- [ ] Revisar y remover código comentado innecesario
- [ ] Verificar que los comentarios útiles estén en español y sean claros

---

### 2. 🗄️ Base de Datos

#### 2.1. Migraciones
- [ ] Verificar que todas las migraciones estén aplicadas en producción
- [ ] Revisar orden cronológico de migraciones en `supabase/migrations/`
- [ ] Verificar que no haya migraciones duplicadas o conflictivas
- [ ] **Backup completo de la base de datos antes de aplicar migraciones**

#### 2.2. Políticas RLS (Row Level Security)
- [ ] Verificar que todas las políticas RLS estén correctamente configuradas:
  - `fcps` - Facilitadores solo ven sus FCPs asignadas
  - `fcp_miembros` - Usuarios solo ven sus propios roles
  - `aulas` - Filtrado por FCP y tutor
  - `estudiantes` - Filtrado por FCP y aula
  - `asistencias` - Filtrado por FCP
- [ ] Ejecutar scripts de verificación:
  - `verificar_politicas.sql`
  - `verificar_politicas_detallado.sql`

#### 2.3. Funciones y Triggers
- [ ] Verificar que todas las funciones helper existan:
  - `es_facilitador_de_fcp(uuid, uuid)`
  - `es_director_de_fcp(uuid, uuid)`
  - `es_secretario_de_fcp(uuid, uuid)`
  - `es_tutor_de_aula(uuid, uuid)`
- [ ] Verificar triggers:
  - `handle_new_user` en `auth.users`
  - Triggers de sincronización de usuarios

---

### 3. 🔐 Seguridad

#### 3.1. Variables de Entorno
- [ ] Verificar que todas las variables de entorno estén configuradas:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Variables de Google OAuth (si aplica)
- [ ] **NO incluir archivos `.env` en el repositorio** (ya está en `.gitignore`)
- [ ] Configurar variables de entorno en la plataforma de despliegue (Vercel, etc.)

#### 3.2. Autenticación
- [ ] Verificar configuración de Google OAuth en Supabase
- [ ] Verificar que los redirect URLs estén correctamente configurados:
  - `http://localhost:3000/auth/callback` (desarrollo)
  - `https://tu-dominio.com/auth/callback` (producción)
- [ ] Probar flujo completo de autenticación

#### 3.3. Permisos y Roles
- [ ] Verificar que los roles funcionen correctamente:
  - Facilitador
  - Director
  - Secretario
  - Tutor
- [ ] Probar acceso restringido por rol
- [ ] Verificar que usuarios sin rol sean redirigidos a `/pendiente`

---

### 4. 🧪 Testing

#### 4.1. Funcionalidades Críticas
- [ ] **Autenticación**:
  - [ ] Login con Google OAuth
  - [ ] Selección de rol (múltiples roles)
  - [ ] Redirección automática desde `/pendiente`
- [ ] **Gestión de FCPs**:
  - [ ] Crear FCP (solo facilitadores)
  - [ ] Ver solo FCPs asignadas (por rol)
  - [ ] Editar FCP
  - [ ] Gestionar miembros
- [ ] **Gestión de Aulas**:
  - [ ] Crear/editar aulas
  - [ ] Asignar tutores
  - [ ] Ver solo aulas de FCP asignada
- [ ] **Gestión de Estudiantes**:
  - [ ] Crear/editar estudiantes
  - [ ] Movimientos entre aulas
  - [ ] Carga masiva (Excel)
- [ ] **Asistencias**:
  - [ ] Registrar asistencia
  - [ ] Editar asistencia
  - [ ] Ver historial
  - [ ] Marcar todos como presente
  - [ ] Detección de días incompletos
- [ ] **Reportes**:
  - [ ] Reporte General
  - [ ] Reporte por Nivel
  - [ ] Reporte Mensual
  - [ ] Reporte FCPs por Mes
  - [ ] Exportar a Excel
  - [ ] Exportar a PDF
  - [ ] Alertas de días incompletos

#### 4.2. Casos Edge
- [ ] Usuario sin roles asignados
- [ ] Usuario con múltiples roles en diferentes FCPs
- [ ] Facilitador "Sistema" (fcp_id = null) - debe estar oculto
- [ ] Aulas sin estudiantes
- [ ] Días sin asistencia registrada
- [ ] Estudiantes movidos entre aulas
- [ ] FCPs sin aulas

---

### 5. ⚡ Performance

#### 5.1. Optimización
- [ ] Ejecutar `npm run build` y verificar:
  - [ ] Sin errores de compilación
  - [ ] Tamaño del bundle razonable
  - [ ] Sin warnings críticos
- [ ] Verificar carga inicial de páginas principales
- [ ] Optimizar imágenes (si hay)
- [ ] Verificar lazy loading de componentes pesados

#### 5.2. Base de Datos
- [ ] Verificar índices en tablas principales:
  - `fcp_miembros` (usuario_id, fcp_id, rol)
  - `aulas` (fcp_id, activa)
  - `estudiantes` (fcp_id, aula_id, activo)
  - `asistencias` (fcp_id, fecha, estudiante_id)
- [ ] Revisar queries lentas con EXPLAIN ANALYZE

---

### 6. 📱 Responsive y UX

#### 6.1. Diseño Responsive
- [ ] Probar en diferentes tamaños de pantalla:
  - [ ] Desktop (1920x1080, 1366x768)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667, 414x896)
- [ ] Verificar que las tablas sean scrollables en móvil
- [ ] Verificar que los formularios sean usables en móvil

#### 6.2. Accesibilidad
- [ ] Verificar contraste de colores
- [ ] Verificar que los botones tengan texto descriptivo
- [ ] Verificar navegación por teclado
- [ ] Verificar que los mensajes de error sean claros

---

### 7. 📄 Documentación

#### 7.1. Documentación Técnica
- [ ] Actualizar `README.md` con instrucciones de despliegue
- [ ] Documentar variables de entorno necesarias
- [ ] Documentar proceso de migraciones
- [ ] Actualizar `REQUERIMIENTOS.md` si hay cambios

#### 7.2. Documentación de Usuario
- [ ] Crear guía de usuario básica (opcional pero recomendado)
- [ ] Documentar roles y permisos
- [ ] Documentar proceso de creación de FCPs

---

### 8. 🔄 Despliegue

#### 8.1. Configuración de Plataforma
- [ ] Configurar proyecto en plataforma de despliegue (Vercel, Netlify, etc.)
- [ ] Configurar dominio personalizado (si aplica)
- [ ] Configurar SSL/HTTPS
- [ ] Configurar variables de entorno en producción

#### 8.2. Supabase Producción
- [ ] Crear proyecto de Supabase para producción (o usar el mismo)
- [ ] Aplicar todas las migraciones
- [ ] Configurar Google OAuth con URLs de producción
- [ ] Verificar políticas RLS
- [ ] Configurar backups automáticos

#### 8.3. Monitoreo
- [ ] Configurar logging de errores (Sentry, LogRocket, etc.)
- [ ] Configurar monitoreo de performance
- [ ] Configurar alertas para errores críticos

---

### 9. ✅ Verificación Final

#### 9.1. Smoke Tests en Producción
- [ ] Login y autenticación
- [ ] Navegación principal
- [ ] Crear/editar FCP
- [ ] Crear/editar aula
- [ ] Crear/editar estudiante
- [ ] Registrar asistencia
- [ ] Generar reporte
- [ ] Exportar reporte

#### 9.2. Rollback Plan
- [ ] Tener plan de rollback listo
- [ ] Backup de base de datos antes del despliegue
- [ ] Documentar pasos para revertir cambios

---

## 🚀 Comandos Útiles

### Build y Testing Local
```bash
# Instalar dependencias
npm install

# Ejecutar lint
npm run lint

# Build de producción (local)
npm run build

# Iniciar servidor de producción (local)
npm start
```

### Base de Datos
```bash
# Aplicar migraciones (usar Supabase CLI)
supabase db push

# Verificar políticas RLS
psql -h [host] -U [user] -d [database] -f verificar_politicas.sql
```

### Limpieza de Logs (Opcional)
```bash
# Buscar todos los console.log
grep -r "console.log" components/features/reportes/

# Reemplazar logs de debug (cuidado: revisar antes de aplicar)
# Considerar usar una variable de entorno para logs en desarrollo
```

---

## 📝 Notas Importantes

1. **Backup**: Siempre hacer backup completo de la base de datos antes de aplicar migraciones en producción.

2. **Logs de Debug**: Los logs de debug pueden ser útiles en producción para troubleshooting, pero deberían estar controlados por una variable de entorno (ej: `NEXT_PUBLIC_DEBUG_LOGS=true`).

3. **Variables de Entorno**: Nunca commitear archivos `.env` con credenciales reales.

4. **Testing**: Probar todas las funcionalidades críticas en un ambiente de staging antes de producción.

5. **Monitoreo**: Configurar alertas para detectar problemas rápidamente después del despliegue.

---

## ✅ Firma de Aprobación

- [ ] **Desarrollador**: _________________ Fecha: _______
- [ ] **QA/Tester**: _________________ Fecha: _______
- [ ] **Product Owner**: _________________ Fecha: _______

---

**Última actualización**: $(date)

