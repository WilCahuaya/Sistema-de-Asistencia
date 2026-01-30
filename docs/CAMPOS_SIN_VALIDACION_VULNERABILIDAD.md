# Campos sin validación y vulnerabilidad

Resumen de campos/entradas que **no tienen validación** (longitud, formato, sanitización) en frontend ni en API, y el riesgo asociado.

---

## 1. API `/api/set-selected-role` (POST)

| Campo   | Validación actual | Riesgo |
|--------|--------------------|--------|
| `roleId` | Solo se comprueba que el usuario tenga ese rol (fcp_miembros o facilitadores). No se valida tipo/formato. | Bajo si la comprobación en BD es correcta. |
| `role`   | **No se valida** contra valores permitidos (`facilitador`, `director`, `secretario`, `tutor`). Se guarda tal cual en cookie. | **Medio**: cookie con valor arbitrario; lógica que confíe en `role` podría comportarse mal. |
| `fcpId`  | Para facilitador se comprueba que la FCP exista y sea del usuario. No se valida que sea UUID. | Bajo. |

**Recomendación:** Validar `role` contra el enum (`facilitador` \| `director` \| `secretario` \| `tutor`) y rechazar el request si no coincide. Opcional: validar `roleId` y `fcpId` como UUID cuando aplique.

---

## 2. Estudiantes

| Campo            | Límite BD   | Validación en formulario | Riesgo |
|------------------|------------|---------------------------|--------|
| `codigo`         | VARCHAR(50) | Solo `required`          | **Medio**: strings largos o caracteres raros pueden causar errores o desborde si la BD trunca. |
| `nombre_completo`| VARCHAR(200)| Solo `required`          | **Medio**: igual que arriba; además posible XSS si se renderiza sin escapar (React suele escapar). |

**Dónde:** `EstudianteDialog.tsx`, `EstudianteUploadDialog.tsx` (carga masiva).

**Recomendación:** `maxLength` en frontend (50 y 200), y opcional `trim()`. En backend/Supabase, la longitud la impone la BD; añadir validación explícita (p. ej. Zod) en API si se añade una.

---

## 3. Aulas

| Campo         | Límite BD   | Validación en formulario | Riesgo |
|---------------|------------|---------------------------|--------|
| `nombre`      | VARCHAR(200)| Solo `required`          | **Medio**: longitud y caracteres no controlados. |
| `descripcion` | TEXT       | Ninguna                   | **Medio**: texto arbitrario; riesgo XSS si se muestra HTML. |

**Dónde:** `AulaDialog.tsx`, `AulaEditDialog.tsx`.

**Recomendación:** `maxLength` para nombre (200); para descripción, límite razonable (p. ej. 2000) y sanitización si se muestra como HTML.

---

## 4. FCP (Proyectos)

| Campo                    | Límite BD (si existe) | Validación en formulario | Riesgo |
|--------------------------|------------------------|---------------------------|--------|
| `numero_identificacion`  | Varía en migraciones   | Solo `required`          | **Medio**. |
| `razon_social`           | Varía                  | Solo `required`          | **Medio**. |
| `nombre_completo_contacto` | -                    | Solo `required`          | **Medio**. |
| `telefono`               | -                      | Solo `required`          | **Medio**: no se valida formato (números, longitud). |
| `email`                  | -                      | Solo `required`          | **Alto**: no se valida formato email; se puede guardar valor inválido. |
| `ubicacion`              | -                      | Solo `required`          | **Medio**. |
| `rol_contacto`           | -                      | Solo `required`          | **Medio**. |

**Dónde:** `FCPDialog.tsx`, `FCPEditDialog.tsx`.

**Recomendación:** Validar formato de email; longitud máxima en todos los textos; formato básico de teléfono (longitud, solo dígitos/espacios/+) si se usa para envío o integraciones.

---

## 5. Miembros FCP / invitaciones

| Campo        | Validación actual | Riesgo |
|-------------|--------------------|--------|
| `email`     | En algunos flujos hay búsqueda por email; no hay validación de formato estándar. | **Alto**: emails inválidos, posibles problemas de integración o notificaciones. |
| `rol`       | Viene del formulario; se confía en valores del select. | Bajo si el select solo ofrece valores válidos; validar en servidor para estar seguros. |

**Dónde:** `MiembroAddDialog.tsx`, `MiembroEditDialog.tsx`.

**Recomendación:** Validar email (formato + longitud). Validar `rol` en backend contra enum de la BD.

---

## 6. Asistencias

| Campo          | Límite BD | Validación | Riesgo |
|----------------|-----------|------------|--------|
| `estado`       | ENUM      | Valores fijos desde UI (presente/falto/permiso). | Bajo. |
| `observaciones`| TEXT      | **Ninguna** en frontend ni CHECK en BD. | **Medio**: texto arbitrario; XSS si se muestra sin escapar. |
| `fecha`        | DATE      | Generada/controlada por UI. | Bajo. |
| `estudiante_id`, `fcp_id`, `aula_id` | UUID/FK | Vienen de contexto/select. | Bajo si no se permite elegir IDs ajenos (RLS correcto). |

**Dónde:** `AsistenciaCalendarView.tsx`, `AsistenciaEditDialog.tsx`, `AsistenciaRegistroDialog.tsx`.

**Recomendación:** Límite de longitud y sanitización para `observaciones` si se muestran en HTML.

---

## 7. Historial de movimientos (estudiante)

| Campo   | Límite BD | Validación | Riesgo |
|--------|-----------|------------|--------|
| `motivo`| TEXT      | **Ninguna** | **Medio**: texto libre; mismo riesgo que observaciones. |

**Dónde:** `EstudianteMovimientoDialog.tsx`.

---

## 8. Carga masiva de estudiantes (Excel/CSV)

| Fuente | Validación | Riesgo |
|--------|------------|--------|
| Archivo subido | Se parsea y se hace `insert` por fila; no hay esquema de validación (longitud, caracteres, duplicados por lote). | **Alto**: datos mal formados, códigos/nombres excesivamente largos, inyección de filas duplicadas o inconsistentes. |

**Dónde:** `EstudianteUploadDialog.tsx`.

**Recomendación:** Validar cada fila (longitud de código y nombre, formato, unicidad en el lote) antes de insertar; límite de filas por archivo.

---

## Resumen por prioridad

| Prioridad | Qué hacer |
|-----------|-----------|
| **Alta**  | API `set-selected-role`: validar `role` contra enum. Formularios FCP y miembros: validar formato de **email**. Carga masiva: validar filas (longitud, formato, duplicados). |
| **Media** | Todos los textos de formulario: `maxLength` acorde a la BD (codigo 50, nombre_completo 200, nombre aula 200, etc.). Campos TEXT libres (`observaciones`, `motivo`, `descripcion`): límite de longitud y no confiar en HTML sin sanitizar. |
| **Baja**  | Validar UUID donde se reciba `id` desde cliente. Validar `rol` en servidor en flujos de miembros. |

---

## Notas

- **SQL injection**: Supabase client usa parámetros preparados; el riesgo es bajo si no se construyen consultas a mano con concatenación.
- **XSS**: React escapa por defecto; el riesgo está en renderizar `dangerouslySetInnerHTML` o HTML generado desde datos no sanitizados.
- **Autorización**: RLS en Supabase controla quién puede insertar/actualizar/borrar; este documento se centra en **validación de datos** (formato, longitud, valores permitidos), no en permisos.
