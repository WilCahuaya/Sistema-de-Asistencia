# Diseño: Sistema de Períodos de Estudiantes

## Objetivo
Transformar el modelo de estudiantes de "un estudiante = un aula actual" a un modelo con **historial de participación** por períodos (fecha_inicio, fecha_fin), permitiendo:
- Nuevo ingreso con fecha de inicio
- Retiro con fecha
- Reactivación (nuevo período, sin tocar el anterior)
- Cambio de salón (cierra período, abre nuevo)
- Agregar estudiante histórico a meses pasados
- Historial de participación visible en perfil

## Modelo de Datos

### Tabla `estudiante_periodos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| estudiante_id | UUID | FK → estudiantes |
| aula_id | UUID | FK → aulas |
| fecha_inicio | DATE | Primer día en el aula |
| fecha_fin | DATE | Último día (NULL = aún activo) |
| motivo_retiro | TEXT | Opcional (solo si fecha_fin) |
| created_at | TIMESTAMPTZ | |
| created_by | UUID | FK → auth.users |

**Reglas:**
- Un estudiante puede tener varios períodos (mismo o distinto aula)
- Períodos no se solapan: si hay uno con fecha_fin=NULL, es el único activo
- fecha_fin NULL = período vigente

### Compatibilidad con modelo actual
- **estudiantes.aula_id**: Se mantiene como "aula actual" (sincronizada desde el período activo)
- **estudiantes.activo**: `true` si existe período con `fecha_fin IS NULL`
- **historial_movimientos**: Se puede deprecar progresivamente; `estudiante_periodos` lo reemplaza

## Casos de Uso

### CASO 1: Nuevo estudiante ingresa
- Usuario: Salón → Agregar estudiante → datos personales
- Sistema pregunta: "¿Desde qué fecha inicia?"
- Crear `estudiantes` + `estudiante_periodos` (fecha_inicio, fecha_fin=NULL)

### CASO 2: Estudiante se retira
- Usuario: Lista del salón → clic en estudiante → "Retirar estudiante" → fecha de retiro
- Actualizar período actual: `fecha_fin` = fecha seleccionada
- Actualizar `estudiantes.activo` = false, `aula_id` = último aula (histórico)

### CASO 3: Estudiante vuelve (reactivación)
- Usuario: Buscar estudiante (incluye inactivos) → "Reactivar en salón" → fecha de retorno
- Crear **nuevo** período (fecha_inicio, fecha_fin=NULL)
- NO modificar el período anterior

### CASO 4: Registrar asistencia de mes pasado
- Usuario selecciona mes/año → sistema muestra estudiantes activos en ese mes
- Si falta uno: "Agregar estudiante histórico a este mes"
  - A) Ya existe: crear período retroactivo (fecha_inicio, fecha_fin dentro del mes)
  - B) No existe: crear estudiante + período solo para ese rango

### CASO 5: Cambio de salón
- Usuario: Perfil estudiante → "Cambiar de salón" → fecha de cambio
- Cerrar período actual (fecha_fin = fecha - 1 día)
- Crear nuevo período (aula nueva, fecha_inicio = fecha)

## Interfaz

### Perfil del estudiante
- **Historial de participación:**
  | Salón | Inicio | Fin |
  |-------|--------|-----|
  | A     | Ene 2026 | Mar 2026 |
  | A     | Jul 2026 | Actual |

### Acciones visibles
- Agregar (con fecha inicio)
- Retirar
- Reactivar
- Cambiar de salón

## Función: Estudiantes activos en mes
```sql
-- Estudiantes que deben aparecer para registrar asistencia en un mes dado
WHERE EXISTS (
  SELECT 1 FROM estudiante_periodos ep
  WHERE ep.estudiante_id = e.id
  AND ep.fecha_inicio <= ultimo_dia_mes
  AND (ep.fecha_fin IS NULL OR ep.fecha_fin >= primer_dia_mes)
)
```
