# Mejoras en la Carga de Datos

## Cambios implementados

### 1. SelectedRoleContext – Paralelización
- **Facilitador por FCP**: Las consultas a `facilitadores` y `fcps` ahora se ejecutan en paralelo con `Promise.all` (antes secuenciales).
- **Carga de todos los roles**: Las consultas a `facilitadores` y `fcp_miembros` se ejecutan en paralelo.

### 2. Dashboard tutor – Consultas agrupadas
- **Antes**: Por cada aula, 3 consultas secuenciales (count estudiantes, estudiantes, asistencias). Con N aulas = 3N consultas.
- **Ahora**: 2 consultas en total:
  - Estudiantes de todas las aulas del tutor.
  - Asistencias del mes para todos esos estudiantes.
- El procesamiento por aula se hace en memoria.

### 3. ReportesMensualesResumen
- Ya usa `Promise.all` para procesar cada FCP en paralelo.

---

## Recomendaciones adicionales (opcional)

### Caché en cliente (React Query / SWR)
- Usar React Query o SWR para caché de datos que no cambian seguido: FCPs del usuario, aulas, etc.
- Reduce consultas repetidas al navegar entre páginas.

### RPC en Supabase para agregaciones
- Crear funciones SQL (RPC) para cálculos complejos del dashboard (por ejemplo estadísticas por aula) y ejecutar una sola llamada en lugar de varias consultas.
- Reduce latencia de red y aprovecha el procesamiento en la base de datos.

### Paginación en listas
- Aulas, estudiantes y reportes largos pueden paginarse en lugar de cargar todo de una vez.
- Usar `range()` de Supabase para paginación por offset o cursor.

### Índices en base de datos
- Verificar índices en columnas usadas en `WHERE`, `JOIN` y filtros por `fecha`, `aula_id`, `estudiante_id`, `fcp_id`.
- Ejemplo: índice en `asistencias(fcp_id, fecha)` para reportes por rango de fechas.

### Prefetch al hover
- Al hacer hover en el menú (por ejemplo en "Reportes"), cargar datos de reportes por adelantado para que estén listos al hacer clic.
