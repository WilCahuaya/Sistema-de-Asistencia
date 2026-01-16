# DOCUMENTO DE DEFINICIÓN DEL MVP

## SISTEMA WEB DE GESTIÓN DE ASISTENCIAS PARA ONG

---

## 1. Introducción

El presente documento describe la definición funcional del **MVP (Producto Mínimo Viable)** del sistema **Asistencia**, una plataforma web diseñada para la gestión de asistencias de estudiantes en **Organizaciones No Gubernamentales (ONG)**.

El objetivo principal del sistema es resolver la **pérdida de control de asistencias** y la **elaboración manual de reportes**, proporcionando una solución digital simple, segura y escalable.

---

## 2. Objetivo del MVP

Desarrollar una plataforma web funcional que permita:

* Registrar y gestionar asistencias diarias de estudiantes.
* Centralizar la información por entidad (ONG).
* Generar reportes automáticos semanales y mensuales.
* Reducir errores humanos y tiempos administrativos.

El MVP servirá para validar el uso real del sistema en ONG antes de añadir funcionalidades avanzadas.

---

## 3. Alcance del Proyecto

### 3.1 Alcance incluido (MVP)

* Sistema web
* Arquitectura multi-entidad (datos aislados por ONG)
* Gestión de aulas
* Carga masiva de estudiantes por archivo Excel
* Registro diario de asistencias
* Edición y auditoría de asistencias
* Movimiento de estudiantes entre aulas
* Reportes semanales, mensuales y generales
* Exportación de reportes en Excel y PDF

### 3.2 Fuera del alcance del MVP

* Pagos o planes de suscripción
* Notificaciones automáticas
* Aplicación móvil
* Inteligencia artificial
* Reconocimiento facial
* Configuraciones avanzadas

---

## 4. Tipo de Usuario y Roles

### 4.1 Roles del sistema

* Director
* Secretario
* Tutor / Docente

### 4.2 Permisos por rol

| Funcionalidad                | Director | Secretario | Tutor/Docente |
| ---------------------------- | -------- | ---------- | ------------- |
| Cargar alumnos por Excel     | Sí       | Sí         | No            |
| Mover alumnos de aula        | Sí       | Sí         | No            |
| Registrar asistencia         | Sí       | Sí         | No            |
| Editar / eliminar asistencia | Sí       | Sí         | No            |
| Ver asistencias              | Sí       | Sí         | Sí            |
| Ver reportes                 | Sí       | Sí         | No            |
| Exportar reportes            | Sí       | Sí         | No            |

Un usuario puede pertenecer a más de una ONG.

---

## 5. Estructura Académica

La estructura organizativa del sistema será la siguiente:

Entidad (ONG)

* Aula
* Estudiantes
* Registros de asistencia

Cada estudiante pertenece a una sola aula, pero puede ser trasladado a otra manteniendo su historial.

---

## 6. Gestión de Estudiantes

### 6.1 Datos mínimos del estudiante

* Código único
* Nombre completo
* Aula asignada

### 6.2 Carga de estudiantes por Excel

El sistema permitirá la carga masiva de estudiantes mediante archivos Excel (.xlsx).

Columnas obligatorias:

* Código
* Nombre completo
* Aula

El sistema validará duplicados y errores antes de guardar la información.

---

## 7. Registro de Asistencia

* La asistencia se registra **por día**.
* Por defecto, todos los estudiantes figuran como **PRESENTE**.
* El usuario puede modificar el estado por estudiante.

### Estados de asistencia

* Presente
* Faltó
* Permiso

### Auditoría

Cada registro almacenará:

* Usuario que registró la asistencia
* Fecha y hora de creación
* Usuario que editó
* Fecha y hora de modificación

---

## 8. Movimiento de Estudiantes entre Aulas

Los roles Director y Secretario podrán mover estudiantes de un aula a otra.

* El historial de asistencias se conserva.
* El cambio queda registrado en el sistema.

---

## 9. Reportes

### 9.1 Tipos de reportes

* Reporte semanal
* Reporte mensual
* Reporte general por ONG

Los reportes incluirán:

* Total de asistencias
* Total de faltas
* Total de permisos
* Resumen por aula y por estudiante

### 9.2 Formatos

* Visualización en pantalla
* Exportación a Excel
* Exportación a PDF

---

## 10. Multi-entidad y Seguridad

* Cada ONG tendrá datos completamente aislados.
* Cada entidad podrá registrar:

  * Nombre
  * Logo
  * Datos básicos

El sistema contará con control de acceso por roles y auditoría de cambios.

---

## 11. Validación del MVP

El éxito del MVP se medirá por:

* Número de ONG activas utilizando el sistema
* Uso constante del registro de asistencias
* Generación efectiva de reportes

---

## 12. Cronograma Inicial

Tiempo estimado de desarrollo del MVP:

* **1 semana**

Este periodo contempla un sistema funcional, listo para uso real en ONG.

---

## 13. Conclusión

El MVP del sistema **Asistencia** permitirá validar una solución práctica y funcional para la gestión de asistencias en ONG, estableciendo una base sólida para futuras mejoras como monetización, notificaciones y aplicaciones móviles.

---

**Documento elaborado para fines de presentación, validación y desarrollo del MVP.**

