# Guía de Capturas de Pantalla para Presentación al Cliente

**Propósito:** Documentar las capturas de pantalla necesarias para presentar el sistema a clientes potenciales

---

## 📸 Capturas de Pantalla Recomendadas

### 1. AUTENTICACIÓN Y ACCESO

#### 1.1 Página de Login
**Ruta:** `/login`  
**Qué mostrar:**
- Botón "Iniciar sesión con Google"
- Diseño limpio y profesional
- Logo o branding del sistema

**Mensaje:** "Acceso rápido y seguro con tu cuenta de Google"

---

#### 1.2 Dashboard Principal (Diferentes Roles)

**1.2.1 Dashboard - Facilitador**
**Ruta:** `/dashboard` (como facilitador)  
**Qué mostrar:**
- Resumen de reportes mensuales
- Vista consolidada de todas las FCPs
- Estadísticas generales

**Mensaje:** "Vista consolidada para supervisión de múltiples FCPs"

---

**1.2.2 Dashboard - Director/Secretario**
**Ruta:** `/dashboard` (como director)  
**Qué mostrar:**
- Tarjetas con estadísticas (Aulas, Estudiantes, Asistencias)
- Reporte mensual resumido
- Accesos rápidos a funcionalidades

**Mensaje:** "Dashboard completo con todas las estadísticas importantes"

---

**1.2.3 Dashboard - Tutor**
**Ruta:** `/dashboard` (como tutor)  
**Qué mostrar:**
- Vista limitada a sus aulas asignadas
- Estadísticas de asistencia de sus estudiantes
- Información de perfil

**Mensaje:** "Vista personalizada según el rol del usuario"

---

### 2. GESTIÓN DE FCPs

#### 2.1 Lista de FCPs
**Ruta:** `/fcps`  
**Qué mostrar:**
- Tabla con lista de FCPs
- Información: Razón social, número de identificación, contacto
- Botones de acción (Ver, Editar)
- Diseño organizado y profesional

**Mensaje:** "Gestión centralizada de todas las FCPs"

---

#### 2.2 Crear/Editar FCP
**Ruta:** `/fcps` → Botón "Nueva FCP"  
**Qué mostrar:**
- Formulario completo con todos los campos
- Validación en tiempo real
- Diseño limpio y fácil de usar

**Mensaje:** "Formulario intuitivo para registrar FCPs"

---

#### 2.3 Gestión de Miembros
**Ruta:** `/fcps/[id]/miembros`  
**Qué mostrar:**
- Lista de miembros de la FCP
- Roles asignados (Director, Secretario, Tutor)
- Botón para agregar nuevos miembros

**Mensaje:** "Gestión de usuarios y permisos por FCP"

---

### 3. GESTIÓN DE AULAS

#### 3.1 Lista de Aulas
**Ruta:** `/aulas`  
**Qué mostrar:**
- Tabla con aulas de la FCP seleccionada
- Información: Nombre del aula, tutor asignado, cantidad de estudiantes
- Selector de FCP en la parte superior
- Botones de acción

**Mensaje:** "Organización clara de aulas por FCP"

---

#### 3.2 Asignar Tutor a Aula
**Ruta:** `/aulas` → Botón "Asignar Tutor"  
**Qué mostrar:**
- Diálogo para seleccionar tutor
- Lista de tutores disponibles
- Confirmación visual

**Mensaje:** "Asignación fácil de tutores a aulas"

---

### 4. GESTIÓN DE ESTUDIANTES

#### 4.1 Lista de Estudiantes
**Ruta:** `/estudiantes`  
**Qué mostrar:**
- Tabla con estudiantes
- Columnas: Código, Nombre completo, Aula
- Barra de búsqueda funcionando
- Filtros por aula
- Paginación

**Mensaje:** "Búsqueda rápida y filtrado de estudiantes"

---

#### 4.2 Carga Masiva desde Excel
**Ruta:** `/estudiantes` → Botón "Cargar desde Excel"  
**Qué mostrar:**
- Diálogo de carga de archivo
- Instrucciones claras del formato requerido
- Botón de selección de archivo
- Mensaje de éxito después de cargar

**Mensaje:** "Carga masiva rápida desde Excel"

---

#### 4.3 Crear/Editar Estudiante
**Ruta:** `/estudiantes` → Botón "Nuevo Estudiante"  
**Qué mostrar:**
- Formulario completo
- Selector de aula
- Validación de campos
- Diseño limpio

**Mensaje:** "Registro individual simple e intuitivo"

---

### 5. REGISTRO DE ASISTENCIAS

#### 5.1 Vista de Calendario Mensual
**Ruta:** `/asistencias` → Vista "Calendario"  
**Qué mostrar:**
- Calendario mensual completo
- Días con asistencias marcadas (colores diferentes)
- Navegación entre meses
- Botones de acción rápida

**Mensaje:** "Vista visual intuitiva de asistencias del mes"

---

#### 5.2 Registro Diario de Asistencias
**Ruta:** `/asistencias` → Botón "Registrar Asistencias"  
**Qué mostrar:**
- Lista de estudiantes del aula seleccionada
- Estados: Presente (verde), Faltó (rojo), Permiso (amarillo)
- Botones para cambiar estados rápidamente
- Botón "Marcar todos como presentes"
- Campo de observaciones

**Mensaje:** "Registro rápido y visual de asistencias diarias"

---

#### 5.3 Lista de Asistencias
**Ruta:** `/asistencias` → Vista "Lista"  
**Qué mostrar:**
- Tabla con asistencias por fecha
- Filtros por fecha, aula, estudiante
- Información completa de cada registro

**Mensaje:** "Historial completo y fácil de consultar"

---

### 6. REPORTES

#### 6.1 Página Principal de Reportes
**Ruta:** `/reportes`  
**Qué mostrar:**
- Selector de tipo de reporte
- Botones para cada tipo de reporte
- Descripción de cada tipo

**Mensaje:** "Múltiples tipos de reportes disponibles"

---

#### 6.2 Reporte Mensual
**Ruta:** `/reportes?view=mensual`  
**Qué mostrar:**
- Estadísticas del mes
- Resumen por aula
- Porcentajes de asistencia
- Gráficos o tablas visuales
- Botones de exportación (Excel, PDF)

**Mensaje:** "Reportes profesionales listos para presentar"

---

#### 6.3 Reporte por Nivel/Aula
**Ruta:** `/reportes?view=nivel`  
**Qué mostrar:**
- Vista detallada por aula
- Calendario con asistencias marcadas
- Estadísticas del nivel
- Exportación disponible

**Mensaje:** "Análisis detallado por aula"

---

#### 6.4 Reporte FCPs por Mes (Facilitador)
**Ruta:** `/reportes?view=participantes-mes`  
**Qué mostrar:**
- Vista consolidada de todas las FCPs
- Porcentajes por mes
- Comparativa entre FCPs
- Tabla anual completa

**Mensaje:** "Vista consolidada para supervisión"

---

#### 6.5 Exportación Excel
**Qué mostrar:**
- Archivo Excel descargado abierto
- Múltiples hojas con datos organizados
- Formato profesional
- Datos completos

**Mensaje:** "Exportación completa a Excel"

---

#### 6.6 Exportación PDF
**Qué mostrar:**
- PDF abierto con el reporte
- Formato profesional
- Logo y branding
- Datos completos y organizados

**Mensaje:** "Reportes listos para imprimir o compartir"

---

### 7. INTERFAZ Y DISEÑO

#### 7.1 Navegación Principal
**Qué mostrar:**
- Menú de navegación lateral o superior
- Todas las secciones visibles
- Diseño responsive
- Iconos claros

**Mensaje:** "Navegación intuitiva y clara"

---

#### 7.2 Diseño Responsive (Móvil)
**Qué mostrar:**
- Vista en smartphone
- Menú adaptado
- Formularios adaptados
- Tablas con scroll horizontal

**Mensaje:** "Funciona perfectamente en móviles y tablets"

---

#### 7.3 Perfil de Usuario
**Ruta:** Dashboard → Sección "Mi Perfil"  
**Qué mostrar:**
- Información del usuario
- Email, nombre, avatar
- Lista de FCPs asignadas
- Roles

**Mensaje:** "Información del usuario centralizada"

---

## 📋 Checklist de Capturas

### Capturas Esenciales (Mínimo para Presentación)

- [ ] Página de Login
- [ ] Dashboard (Facilitador)
- [ ] Dashboard (Director/Secretario)
- [ ] Lista de FCPs
- [ ] Lista de Estudiantes
- [ ] Vista de Calendario de Asistencias
- [ ] Registro Diario de Asistencias
- [ ] Reporte Mensual
- [ ] Exportación Excel (archivo abierto)

### Capturas Recomendadas (Presentación Completa)

- [ ] Dashboard (Tutor)
- [ ] Crear FCP (formulario)
- [ ] Gestión de Miembros
- [ ] Lista de Aulas
- [ ] Carga Masiva Excel (diálogo)
- [ ] Lista de Asistencias
- [ ] Reporte por Nivel
- [ ] Reporte FCPs por Mes
- [ ] Exportación PDF (archivo abierto)
- [ ] Vista en móvil

---

## 🎨 Recomendaciones para las Capturas

### Antes de Capturar

1. **Datos de Prueba Realistas**
   - Usar nombres y datos que parezcan reales
   - Variedad de información (no solo datos de prueba genéricos)
   - Números y estadísticas coherentes

2. **Diseño Limpio**
   - Asegurar que no haya datos de prueba obvios o incorrectos
   - Verificar que los colores se vean bien
   - Comprobar que el diseño esté completo

3. **Funcionalidad Visible**
   - Mostrar características clave funcionando
   - Botones y acciones visibles
   - Estados diferentes (presente, faltó, permiso)

### Durante la Captura

1. **Resolución**
   - Usar resolución alta (1920x1080 o superior)
   - Capturar ventana completa del navegador
   - Evitar capturas parciales

2. **Navegador**
   - Usar Chrome o Firefox (más común)
   - Modo claro (no dark mode) para mejor presentación
   - Ventana maximizada

3. **Datos Sensibles**
   - Ocultar o enmascarar datos personales reales si los hay
   - Usar datos de prueba consistentes

### Después de Capturar

1. **Edición (Opcional)**
   - Agregar anotaciones o flechas si es necesario
   - Resaltar características importantes
   - Asegurar buena calidad de imagen

2. **Organización**
   - Nombrar archivos descriptivamente:
     - `01-login.png`
     - `02-dashboard-facilitador.png`
     - `03-lista-fcps.png`
   - Crear carpeta `screenshots/` en el proyecto

---

## 📝 Script de Presentación Sugerido

### Slide 1: Introducción
- Captura: Logo o página principal
- Texto: "Sistema de Gestión de Asistencias para FCP"

### Slide 2: Acceso Simple
- Captura: Página de Login
- Texto: "Inicio de sesión con Google - Sin contraseñas"

### Slide 3: Dashboard Facilitador
- Captura: Dashboard facilitador
- Texto: "Vista consolidada de todas las FCPs"

### Slide 4: Dashboard Director
- Captura: Dashboard director
- Texto: "Estadísticas completas de tu FCP"

### Slide 5: Gestión de Estudiantes
- Captura: Lista de estudiantes
- Texto: "Búsqueda rápida y carga masiva desde Excel"

### Slide 6: Registro de Asistencias
- Captura: Vista de calendario
- Texto: "Registro visual e intuitivo de asistencias"

### Slide 7: Reportes
- Captura: Reporte mensual
- Texto: "Reportes profesionales con exportación Excel/PDF"

### Slide 8: Precios
- Captura: Tabla de precios
- Texto: "Planes accesibles desde S/ 70/mes"

---

## 🛠️ Herramientas Recomendadas

### Para Capturar Pantalla

**Windows:**
- `Win + Shift + S` - Herramienta de recorte de Windows
- Snipping Tool
- Lightshot (gratis)

**Linux:**
- `Print Screen` - Captura de pantalla nativa
- `Shift + Print Screen` - Seleccionar área
- Flameshot (recomendado)

**Mac:**
- `Cmd + Shift + 3` - Captura completa
- `Cmd + Shift + 4` - Seleccionar área

### Para Editar

- GIMP (gratis)
- Canva (online, fácil)
- Figma (online, profesional)
- Paint.NET (Windows, gratis)

---

## 📂 Estructura de Archivos Sugerida

```
screenshots/
├── 01-autenticacion/
│   ├── login.png
│   └── dashboard-facilitador.png
├── 02-gestion-fcps/
│   ├── lista-fcps.png
│   ├── crear-fcp.png
│   └── miembros-fcp.png
├── 03-gestion-aulas/
│   ├── lista-aulas.png
│   └── asignar-tutor.png
├── 04-gestion-estudiantes/
│   ├── lista-estudiantes.png
│   ├── carga-masiva.png
│   └── crear-estudiante.png
├── 05-asistencias/
│   ├── calendario-mensual.png
│   ├── registro-diario.png
│   └── lista-asistencias.png
├── 06-reportes/
│   ├── reporte-mensual.png
│   ├── reporte-nivel.png
│   ├── reporte-fcps-mes.png
│   ├── excel-exportado.png
│   └── pdf-exportado.png
└── 07-diseno/
    ├── navegacion.png
    ├── responsive-movil.png
    └── perfil-usuario.png
```

---

## 💡 Tips Adicionales

1. **Mostrar Flujo Completo**
   - Capturar el proceso completo: Login → Dashboard → Acción → Resultado

2. **Destacar Características Únicas**
   - Vista de calendario (única)
   - Carga masiva Excel (ahorra tiempo)
   - Reportes automáticos (valor agregado)

3. **Comparar Antes/Después**
   - Mostrar cómo era antes (manual) vs ahora (digital)
   - Enfocarse en ahorro de tiempo

4. **Datos Realistas**
   - Usar números que parezcan reales
   - Variedad de estudiantes y aulas
   - Estadísticas coherentes

---

**Nota:** Esta guía te ayudará a tomar las capturas de pantalla necesarias. Una vez que las tengas, puedes crear una presentación o documento visual para mostrar a los clientes.

