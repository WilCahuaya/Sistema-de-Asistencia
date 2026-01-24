# Guía de Capturas para Presentación a Stakeholders

Este documento lista las capturas recomendadas para presentar el Sistema de Gestión de Asistencias a los stakeholders.

## 📋 Índice de Capturas Recomendadas

### 1. Página de Login (Inicio)
**Ruta:** `/login`
**Qué destacar:**
- Diseño moderno y profesional
- Autenticación con Google OAuth
- Características principales visibles
- Enlaces a Términos y Privacidad

**Elementos clave a mostrar:**
- Diseño con gradientes y efectos visuales modernos
- Botón de "Continuar con Google"
- Tarjetas de características (Registro Rápido, 100% Seguro, Reportes Automáticos, Multi-FCP)
- Estadísticas (100% Seguro, 24/7 Disponible, ∞ Escalable)

---

### 2. Dashboard Principal
**Ruta:** `/dashboard`
**Qué destacar:**
- Vista general del sistema
- Métricas clave (Aulas, Estudiantes, FCPs)
- Reporte mensual resumido
- Información del perfil del usuario

**Elementos clave a mostrar:**
- Tarjetas de métricas principales
- Tabla de reporte mensual con datos
- Sección "Mi Perfil" con información del usuario
- Navegación clara y organizada

---

### 3. Gestión de FCPs
**Ruta:** `/fcps`
**Qué destacar:**
- Lista de proyectos educativos
- Información detallada de cada FCP
- Capacidad de crear y gestionar múltiples proyectos

**Elementos clave a mostrar:**
- Lista de FCPs activas
- Información de contacto y responsables
- Botones de acción (Crear, Editar)
- Estado activo/inactivo

---

### 4. Gestión de Aulas
**Ruta:** `/aulas`
**Qué destacar:**
- Organización por niveles educativos
- Asignación de tutores
- Banner del proyecto seleccionado
- Vista de tarjetas organizadas

**Elementos clave a mostrar:**
- Banner "PROYECTO: [Código] [Nombre]"
- Tarjetas de aulas con información completa
- Asignación de tutores por aula
- Estados activos/inactivos

---

### 5. Gestión de Estudiantes
**Ruta:** `/estudiantes`
**Qué destacar:**
- Lista completa de estudiantes
- Filtros por FCP y Aula
- Búsqueda de estudiantes
- Tabla con información detallada
- Capacidad de carga masiva desde Excel

**Elementos clave a mostrar:**
- Banner del proyecto
- Selectores de FCP y Aula
- Barra de búsqueda
- Tabla con columnas: Código, Nombre, Aula, Tutor
- Botones de acción (Crear, Cargar desde Excel, Movimiento)

---

### 6. Registro de Asistencias (Vista Principal)
**Ruta:** `/asistencias`
**Qué destacar:**
- Vista de calendario mensual
- Registro rápido de asistencias
- Columnas fijas (Código y Participante)
- Scroll horizontal con Shift + mouse
- Indicadores visuales de asistencia completa/incompleta
- Colores de alerta para días incompletos

**Elementos clave a mostrar:**
- Banner del proyecto
- Selectores de Nivel y Mes
- Tabla con días del mes como columnas
- Iconos de estado (✓ Presente, ✗ Faltó, ⏰ Permiso)
- Encabezados de columna con indicadores (X/Total estudiantes)
- Colores de alerta naranja para días incompletos
- Botón "Marcar todos como presentes" por día

---

### 7. Reportes - Vista General
**Ruta:** `/reportes`
**Qué destacar:**
- Tres tipos de reportes disponibles
- Selectores de mes y año
- Botón de generar reporte

**Elementos clave a mostrar:**
- Pestañas: Reporte General, Reporte por Nivel, Reporte Mensual
- Selectores de Mes y Año
- Botón "Generar Reporte"

---

### 8. Reporte General Generado
**Ruta:** `/reportes` (después de generar)
**Qué destacar:**
- Información del proyecto y responsable
- Advertencia de días incompletos (si aplica)
- Tabla detallada de asistencias
- Botones de exportación (Excel y PDF)
- Resumen por estudiante

**Elementos clave a mostrar:**
- Información del reporte (PROYECTO, RESPONSABLE, AÑO, EMAIL, MES, ROL)
- Banner de advertencia naranja para días incompletos (si hay)
- Tabla con columnas: No, Estudiante, Código, Nivel, Tutor, días del mes
- Botones de exportación Excel y PDF
- Resumen por estudiante con totales

---

### 9. Reporte por Nivel
**Ruta:** `/reportes` → Pestaña "Reporte por Nivel"
**Qué destacar:**
- Organización por niveles educativos
- Estadísticas por aula
- Porcentajes de asistencia
- Totales y subtotales

**Elementos clave a mostrar:**
- Tabla organizada por niveles
- Columnas: Niveles, Asisten. Promed, Registrados, Porcentaje
- Subtotales por nivel
- Total general
- Advertencias de días incompletos

---

### 10. Reporte Mensual
**Ruta:** `/reportes` → Pestaña "Reporte Mensual"
**Qué destacar:**
- Resumen mensual consolidado
- Estadísticas generales
- Vista por mes completo

**Elementos clave a mostrar:**
- Información del mes seleccionado
- Estadísticas consolidadas
- Tabla de resumen

---

### 11. Sistema de Temas (Opcional pero recomendado)
**Ruta:** Cualquier página → Menú de usuario (tres puntos)
**Qué destacar:**
- Múltiples temas disponibles
- Temas claros: Azul, Verde, Púrpura, Gris
- Temas oscuros: Azul Oscuro, Verde Oscuro, Púrpura Oscuro
- Personalización visual

**Elementos clave a mostrar:**
- Menú desplegable con opciones de tema
- Cambio visual inmediato al seleccionar un tema
- Organización en "Temas Claros" y "Temas Oscuros"

---

### 12. Páginas Legales
**Rutas:** `/terminos` y `/privacidad`
**Qué destacar:**
- Términos y Condiciones completos
- Política de Privacidad detallada
- Cumplimiento legal
- Transparencia con usuarios

**Elementos clave a mostrar:**
- Diseño profesional y legible
- Contenido completo y organizado
- Fecha de última actualización
- Enlace de regreso al login

---

## 🎯 Orden Recomendado para la Presentación

1. **Login** - Primera impresión y seguridad
2. **Dashboard** - Vista general del sistema
3. **Gestión de FCPs** - Multi-tenancy y organización
4. **Gestión de Aulas** - Estructura educativa
5. **Gestión de Estudiantes** - Base de datos estudiantil
6. **Registro de Asistencias** - Funcionalidad principal
7. **Reportes - General** - Generación de reportes
8. **Reportes - Por Nivel** - Análisis detallado
9. **Reportes - Mensual** - Resúmenes consolidados
10. **Sistema de Temas** - Personalización (opcional)
11. **Páginas Legales** - Cumplimiento (opcional)

---

## 📸 Consejos para las Capturas

1. **Usar datos de ejemplo realistas** para que se vea profesional
2. **Mostrar diferentes roles** si es posible (Director, Secretario, Tutor)
3. **Incluir el banner del proyecto** en las capturas relevantes
4. **Mostrar estados diferentes** (días completos vs incompletos)
5. **Capturar los colores de alerta** para días incompletos
6. **Mostrar la exportación** (botones Excel/PDF visibles)
7. **Usar un tema consistente** en todas las capturas (recomendado: Azul claro)
8. **Asegurar buena resolución** (al menos 1920x1080)
9. **Evitar información sensible** en las capturas de ejemplo

---

## 🎨 Temas Recomendados para Capturas

- **Tema Azul Claro**: Profesional y educativo (recomendado para presentación)
- **Tema Verde Claro**: Natural y crecimiento (alternativa)
- **Tema Oscuro**: Para mostrar versatilidad (opcional)

---

## 📝 Notas Adicionales

- Asegúrate de que todas las capturas muestren el sistema funcionando correctamente
- Considera crear un usuario de demostración con datos de ejemplo
- Las capturas deben mostrar el flujo completo de trabajo
- Destaca características únicas como el scroll horizontal, colores de alerta, y exportación

---

## 🔄 Actualización

Este documento debe actualizarse cuando se agreguen nuevas funcionalidades o características importantes al sistema.

