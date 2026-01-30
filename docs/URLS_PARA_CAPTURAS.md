# URLs para Capturas de Pantalla

Lista de URLs que debes visitar para tomar las capturas necesarias para la presentación.

## 🆕 Funcionalidades Recientes Implementadas

### Regla de Inmutabilidad de Asistencias
- **Las asistencias de meses anteriores quedan cerradas y consolidadas**
- No se permiten modificaciones (editar, eliminar o registrar nuevas) sobre asistencias de meses anteriores
- El sistema bloquea automáticamente cualquier intento de modificar datos históricos
- **Captura recomendada:** Intentar editar una asistencia de un mes anterior para mostrar el mensaje de bloqueo

### Historial Preservado al Cambiar de Salón
- **Cuando un estudiante cambia de salón, el cambio solo aplica hacia adelante**
- En reportes de meses anteriores, el estudiante aparece en su salón histórico original
- El historial de asistencias se mantiene intacto y no se reescribe
- **Captura recomendada:** 
  - Cambiar un estudiante de salón
  - Generar reporte del mes actual (debe mostrar nuevo salón)
  - Generar reporte de mes anterior (debe mostrar salón histórico)

### Alertas de Días Incompletos
- **Los reportes muestran alertas cuando hay días con asistencia incompleta**
- Se detecta automáticamente cuando faltan registros de asistencia para algún estudiante en un día específico
- Las alertas aparecen en todos los tipos de reportes (General, Por Nivel, Mensual, FCPs por Mes)
- **Captura recomendada:** Generar un reporte con al menos un día incompleto para mostrar las alertas visuales

### Información de Usuario en Menú
- **El menú de tres puntos (⋮) ahora muestra información completa del usuario**
- Muestra: nombre, email, rol actual con badge de color, y FCP (ONG) activa
- Diseño profesional y organizado dentro del menú desplegable
- **Captura recomendada:** Abrir el menú de usuario para mostrar la información completa

## 🔗 URLs Principales

### 1. Login
```
http://localhost:3000/login
```
**Requisitos:** Asegúrate de estar deslogueado para ver la página completa

**Descripción:** Página de login con formulario y botón "Continuar con Google", incluyendo banner del proyecto.

---

### 2. Selección de Rol
```
http://localhost:3000/seleccionar-rol
```
**Requisitos:** Usuario autenticado con múltiples roles asignados

**Descripción:** Página de selección de rol mostrando tarjetas con cada rol disponible (rol, FCP asociada, número de identificación) y botón "Acceder con este rol".

---

### 3. Dashboard
```
http://localhost:3000/dashboard
```
**Requisitos:** Usuario con rol Director o Secretario

**Descripción:** Vista principal del dashboard con tarjetas de resumen, navegación superior y menú de usuario (⋮).

---

### 4. Gestión de FCPs
```
http://localhost:3000/fcps
```
**Requisitos:** Usuario con acceso a FCPs

**Descripción:** Lista de FCPs en tabla con número de identificación, razón social, estado y botón "Nueva FCP".

---

### 5. Gestión de Aulas
```
http://localhost:3000/aulas
```
**Requisitos:** Usuario con rol Director o Secretario, con FCP seleccionada

**Descripción:** Lista de aulas con nombre, nivel, tutor asignado, cantidad de estudiantes y botón "Nueva Aula".

---

### 6. Gestión de Estudiantes
```
http://localhost:3000/estudiantes
```
**Requisitos:** Usuario con rol Director o Secretario, con FCP seleccionada

**Descripción:** Lista de estudiantes con código, nombre, aula asignada, estado y botones "Nuevo Estudiante" y "Cargar desde Excel".

---

### 7. Registro de Asistencias
```
http://localhost:3000/asistencias
```
**Requisitos:** Usuario con rol Director o Secretario, con FCP y Aula seleccionadas

**Descripción - Vista Principal:** Calendario mensual con asistencias marcadas (presente/faltó/permiso), selectores de mes/año y aula.

**Descripción - Bloqueo Inmutabilidad:** Mensaje de error al intentar editar asistencia de mes anterior: "No se pueden modificar asistencias de meses anteriores".

**Descripción - Bloqueo Registrar:** Mensaje de bloqueo al intentar registrar nueva asistencia en mes anterior.

**Descripción - Alerta Día Incompleto:** Vista detallada del día mostrando alerta visual y estudiantes faltantes en el registro.

---

### 8. Reportes - Vista Inicial
```
http://localhost:3000/reportes
```
**Requisitos:** Usuario con acceso a reportes

**Descripción:** Página inicial con selectores de mes/año/FCP, pestañas de tipos de reporte y botón "Generar Reporte".

---

### 9. Reportes - General (después de generar)
```
http://localhost:3000/reportes?view=general
```
**Pasos:**
1. Seleccionar mes y año
2. Click en "Generar Reporte"
3. Esperar a que se genere el reporte

**Descripción - Mes Actual:** Tabla completa con estudiantes agrupados por aula actual, columnas de días del mes, botones de exportación (Excel/PDF) y resumen con totales.

**Descripción - Mes Anterior:** Tabla mostrando estudiantes en su salón histórico (no el actual), demostrando preservación del historial.

**Descripción - Alertas:** Alerta visual destacada en días con asistencia incompleta, mostrando qué día y cuántos estudiantes faltan.

---

### 10. Reportes - Por Nivel
```
http://localhost:3000/reportes?view=por-nivel
```
**Pasos:**
1. Cambiar a pestaña "Reporte por Nivel"
2. Seleccionar mes y año
3. Click en "Generar Reporte"

**Descripción:** Reporte agrupado por nivel/aula con secciones separadas, lista de estudiantes por aula, resumen por tutor con estadísticas y alertas agrupadas por nivel.

---

### 11. Reportes - Mensual
```
http://localhost:3000/reportes?view=mensual
```
**Pasos:**
1. Cambiar a pestaña "Reporte Mensual"
2. Seleccionar mes y año
3. Click en "Generar Reporte"

**Descripción:** Reporte mensual consolidado con estadísticas generales, resumen por aula, lista de estudiantes con resumen mensual y alertas destacadas.

---

### 12. Reportes - FCPs por Mes
```
http://localhost:3000/reportes?view=participantes-por-mes
```
**Pasos:**
1. Cambiar a pestaña "FCPs por Mes"
2. Seleccionar año
3. Click en "Generar Reporte"

**Descripción:** Reporte anual con sección por cada mes, estadísticas mensuales, historial preservado por mes y alertas agrupadas por mes.

---

### 13. Menú de Usuario (Información Completa)
**Ubicación:** Click en los tres puntos (⋮) en la barra de navegación superior derecha

**Descripción:** Menú desplegable mostrando avatar, nombre completo, email, rol con badge de color, FCP activa con número y razón social, selector de tema y cerrar sesión.

---

### 14. Términos y Condiciones
```
http://localhost:3000/terminos
```
**Requisitos:** Página pública, no requiere login

**Descripción:** Página completa de términos y condiciones con contenido legal formateado, header/navegación y diseño profesional.

---

### 15. Política de Privacidad
```
http://localhost:3000/privacidad
```
**Requisitos:** Página pública, no requiere login

**Descripción:** Página completa de política de privacidad con contenido sobre protección de datos, header/navegación y diseño consistente.

---

## 🎨 Variaciones por Tema (Opcional)

Si quieres mostrar la versatilidad del sistema, puedes tomar capturas con diferentes temas:

### Tema Azul Claro
- Cambiar tema a "Azul" desde el menú de usuario

### Tema Verde Claro
- Cambiar tema a "Verde" desde el menú de usuario

### Tema Púrpura Claro
- Cambiar tema a "Púrpura" desde el menú de usuario

### Tema Oscuro (Azul Oscuro)
- Cambiar tema a "Azul Oscuro" desde el menú de usuario

---

## 📋 Checklist de Preparación

Antes de tomar las capturas, asegúrate de:

- [ ] Tener datos de ejemplo cargados (FCPs, Aulas, Estudiantes)
- [ ] Tener asistencias registradas para mostrar en reportes
- [ ] **Tener asistencias en meses anteriores** para demostrar la inmutabilidad
- [ ] **Tener al menos un estudiante que haya cambiado de salón** para mostrar el historial preservado
- [ ] Usar un usuario con rol Director o Secretario para acceso completo
- [ ] Tener al menos un día con asistencia incompleta para mostrar las alertas
- [ ] Navegador en modo de pantalla completa o ventana maximizada
- [ ] Resolución de pantalla adecuada (1920x1080 o superior)
- [ ] Tema consistente seleccionado (recomendado: Azul claro)

---

## 🛠️ Herramientas Recomendadas para Capturas

### Opciones Nativas:
- **Windows:** Win + Shift + S (Snipping Tool) o Win + Print Screen
- **Linux:** Screenshot (PrtSc) o herramientas como Flameshot
- **Mac:** Cmd + Shift + 4

### Herramientas Avanzadas:
- **ShareX** (Windows) - Gratis, con edición
- **Flameshot** (Linux) - Gratis, con anotaciones
- **Lightshot** (Multiplataforma) - Gratis, fácil de usar
- **Greenshot** (Windows) - Gratis, open source

---

## 📐 Configuración Recomendada

- **Resolución:** 1920x1080 o superior
- **Formato:** PNG (mejor calidad) o JPG (menor tamaño)
- **Zoom del navegador:** 100% (sin zoom)
- **Modo:** Pantalla completa o ventana maximizada

---

## 🎯 Orden Sugerido para Capturas

1. Login (sin usuario)
2. **Selección de Rol** (usuario con múltiples roles)
3. Dashboard (con usuario logueado)
4. **Menú de Usuario** (mostrar información completa: nombre, rol, FCP)
5. FCPs
6. Aulas
7. Estudiantes
8. Asistencias (vista completa del mes actual)
9. **Asistencias - Intentar editar mes anterior** (mostrar bloqueo de inmutabilidad)
10. **Asistencias - Intentar registrar en mes anterior** (mostrar bloqueo)
11. Asistencias (detalle de día con alerta de incompleto)
12. Reportes - Vista inicial
13. **Reportes - General del mes actual** (con estudiantes en salones actuales)
14. **Reportes - General de mes anterior** (con estudiantes en salones históricos)
15. Reportes - General con alertas de días incompletos
16. Reportes - Por Nivel generado (con alertas)
17. Reportes - Mensual generado (con alertas)
18. Reportes - FCPs por Mes (mostrando historial preservado)
19. Términos (opcional)
20. Privacidad (opcional)

---

## 💡 Tips Adicionales

- **Usa datos realistas:** Nombres de estudiantes, códigos, etc.
- **Muestra funcionalidades clave:** 
  - Scroll horizontal en tablas
  - Colores de alerta para días incompletos
  - Mensajes de bloqueo para inmutabilidad
  - Badges de rol en el menú de usuario
  - Exportación a Excel y PDF
- **Demuestra el historial preservado:**
  - Cambia un estudiante de salón
  - Captura reporte del mes actual (nuevo salón)
  - Captura reporte de mes anterior (salón histórico)
- **Incluye el banner del proyecto** en capturas relevantes
- **Evita información sensible** en capturas de ejemplo
- **Mantén consistencia visual** usando el mismo tema en todas las capturas
- **Destaca las nuevas funcionalidades:** Inmutabilidad, historial preservado, alertas, menú de usuario

