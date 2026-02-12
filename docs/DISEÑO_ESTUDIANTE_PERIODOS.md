# Diseño: Sistema de Períodos de Estudiantes

## Objetivo
Modelo con **un período por mes**: cada mes es independiente, cerrado (fecha_fin siempre definido). Historial limpio y predecible.

## Modelo de Datos

### Tabla `estudiante_periodos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| estudiante_id | UUID | FK → estudiantes |
| aula_id | UUID | FK → aulas |
| fecha_inicio | DATE | Primer día del mes (siempre día 1) |
| fecha_fin | DATE | Último día del mes (obligatorio) |
| motivo_retiro | TEXT | Opcional |
| created_at | TIMESTAMPTZ | |
| created_by | UUID | FK → auth.users |

### Reglas fundamentales
- **1 período = 1 mes** (01-MM al 28/29/30/31)
- **fecha_fin siempre definido** — no hay períodos abiertos indefinidos
- **Rollover mensual:** al ver el mes actual, se crean períodos para estudiantes que tenían el mes anterior
- Un estudiante puede tener varios períodos (uno por mes, mismo o distinto aula)

### Compatibilidad
- **estudiantes.aula_id**: Sincronizada desde el período que contiene la fecha actual
- **estudiantes.activo**: `true` si tiene período que contiene la fecha actual

## Casos de Uso

### CASO 1: Nuevo estudiante ingresa
- Crear `estudiantes` + `estudiante_periodos` (fecha_inicio=01, fecha_fin=último día del mes actual)
- No se pregunta fecha: mes actual

### CASO 2: Estudiante se retira en mes M
- **No crear período de M.** Eliminar el período de M si existe.
- El último período será M-1.
- Indicación clara: no participó en M.

### CASO 3: Cambio de salón en mes M
- **Solo actualizar** `aula_id` del período de M.
- Febrero a M-1 quedan intactos. No cerrar ni cortar períodos.

### CASO 4: Cambio de salón dentro del mismo mes
- Si estamos en junio y cambian de salón: simplemente actualizar el período de junio.
- No crear otro. No dividir el mes.

### CASO 5: Estudiante vuelve (reactivación)
- Crear período del mes de retorno (fecha_inicio, fecha_fin = primer y último día del mes)
- NO modificar períodos anteriores

### CASO 6: Agregar estudiante a mes pasado
- Crear período exacto para ese mes (01-MM a último día)
- Validar que no superponga con períodos existentes

## Ejemplo

Si un estudiante entra en febrero y estamos en junio:

| Mes | Período |
|-----|---------|
| Febrero | 01-02 → 28-02 |
| Marzo | 01-03 → 31-03 |
| Abril | 01-04 → 30-04 |
| Mayo | 01-05 → 31-05 |
| Junio | 01-06 → 30-06 |

→ 1 período por mes. Siempre empieza el 1 y termina el último día.

**Retiro en junio:** No crear período de junio. Último período = mayo.

**Cambio de salón en junio:** Actualizar el período de junio con el nuevo salón. Febrero a mayo intactos.

## Función: asegurar_periodos_mes
Crea períodos del mes para estudiantes que tenían el mes anterior en esa aula. Se invoca al cargar la vista del mes actual (rollover).

## Función: estudiantes_activos_en_rango
Devuelve IDs de estudiantes con período que se superpone al rango (primer día, último día del mes).
