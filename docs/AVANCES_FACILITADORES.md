# Documento de Avances - Funcionalidades para Facilitadores

**Fecha:** Diciembre 2024  
**Versión:** 1.0

---

## Resumen Ejecutivo

Se han implementado mejoras significativas en el sistema para permitir que los facilitadores gestionen ONGs y accedan a reportes de todas las ONGs del sistema. Los cambios incluyen:

- ✅ Creación de nuevas ONGs por facilitadores
- ✅ Selector de ONG en todos los reportes para facilitadores
- ✅ Visualización de todas las ONGs en el dashboard
- ✅ Acceso completo a reportes de todas las ONGs del sistema

---

## 1. Gestión de ONGs para Facilitadores

### 1.1 Creación de ONGs

**Archivo modificado:** `components/features/ongs/ONGList.tsx`

**Cambios realizados:**
- Se agregó un botón "Crear Nueva ONG" visible solo para facilitadores
- Los facilitadores pueden crear nuevas ONGs directamente desde la interfaz
- Al crear una ONG, el usuario se asocia automáticamente como facilitador de la nueva ONG
- La lista de ONGs se actualiza automáticamente después de crear una nueva ONG

**Funcionalidad:**
- Botón ubicado en la esquina superior derecha de la página de gestión de ONGs
- Usa el componente `ONGDialog` existente para el formulario de creación
- Validación y manejo de errores integrados

**Comportamiento:**
- **Facilitadores:** Ven todas las ONGs del sistema y pueden crear nuevas
- **Otros usuarios:** Ven solo sus ONGs asignadas y no pueden crear nuevas

---

## 2. Selector de ONG en Reportes

### 2.1 Reporte Mensual

**Archivo modificado:** `components/features/reportes/ReporteMensual.tsx`

**Cambios realizados:**
- Se agregó verificación de rol facilitador
- El selector de ONG ahora se muestra siempre para facilitadores, incluso si hay un `ongIdProp`
- Los facilitadores ven todas las ONGs activas del sistema en el selector
- Los no facilitadores mantienen el comportamiento original (solo sus ONGs)

**Lógica implementada:**
```typescript
// Verificación de facilitador
const checkIfFacilitador = async () => {
  // Verifica si el usuario tiene rol 'facilitador' en alguna ONG
}

// Selector visible para facilitadores
{(!ongIdProp || isFacilitador) && (
  <select>
    {/* Lista de ONGs */}
  </select>
)}
```

### 2.2 Reporte por Nivel

**Archivo modificado:** `components/features/reportes/ReporteAsistenciaPorNivel.tsx`

**Cambios realizados:**
- Misma funcionalidad que Reporte Mensual
- Selector de ONG visible para facilitadores
- Carga de todas las ONGs del sistema para facilitadores

### 2.3 Reporte General (ReporteList)

**Archivo modificado:** `components/features/reportes/ReporteList.tsx`

**Cambios realizados:**
- Selector de ONG actualizado para mostrar todas las ONGs a facilitadores
- Los facilitadores pueden elegir cualquier ONG del sistema para generar reportes

### 2.4 Reporte ONGs por Mes

**Archivo modificado:** `components/features/reportes/ReporteParticipantesPorMes.tsx`

**Comportamiento especial:**
- **NO tiene selector de ONG** para facilitadores
- Muestra automáticamente todas las ONGs del sistema
- Incluye un mensaje informativo: "Como facilitador, el reporte incluirá todas las ONGs del sistema"
- Este es el único reporte donde los facilitadores NO pueden seleccionar una ONG específica

---

## 3. Carga de ONGs en Componentes

### 3.1 Función `loadUserONGs` Actualizada

**Archivos modificados:**
- `components/features/reportes/ReporteMensual.tsx`
- `components/features/reportes/ReporteAsistenciaPorNivel.tsx`
- `components/features/reportes/ReporteList.tsx`
- `components/features/ongs/ONGList.tsx`

**Lógica implementada:**
```typescript
const loadUserONGs = async () => {
  // 1. Verificar si el usuario es facilitador
  const isFacilitador = await checkIfFacilitador()
  
  if (isFacilitador) {
    // Cargar TODAS las ONGs activas del sistema
    const { data } = await supabase
      .from('ongs')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre', { ascending: true })
  } else {
    // Cargar solo las ONGs asociadas al usuario
    const { data } = await supabase
      .from('usuario_ong')
      .select('ong:ongs(id, nombre)')
      .eq('usuario_id', user.id)
      .eq('activo', true)
  }
}
```

**Beneficios:**
- Código reutilizable y consistente
- Misma lógica en todos los componentes
- Fácil mantenimiento

---

## 4. Dashboard Actualizado

**Archivo modificado:** `app/(dashboard)/dashboard/page.tsx`

### 4.1 Visualización de ONGs

**Cambios realizados:**
- Los facilitadores ven todas las ONGs activas del sistema
- El contador de ONGs muestra el total de ONGs del sistema para facilitadores
- La sección "Mi Perfil" muestra "ONGs del Sistema" para facilitadores
- Los no facilitadores mantienen el comportamiento original

### 4.2 Lógica de Acceso

**Antes:**
- Todos los usuarios necesitaban tener al menos una ONG asignada para acceder al dashboard

**Ahora:**
- Los facilitadores pueden acceder al dashboard incluso sin ONGs asignadas directamente
- Los no facilitadores siguen siendo redirigidos si no tienen ONGs

### 4.3 Código Implementado

```typescript
// Verificar si es facilitador
const isFacilitador = await checkIfFacilitador()

if (isFacilitador) {
  // Cargar todas las ONGs del sistema
  const { data } = await supabase
    .from('ongs')
    .select('*')
    .eq('activa', true)
} else {
  // Cargar solo ONGs del usuario
  const { data } = await supabase
    .from('usuario_ong')
    .select('ong:ongs(*)')
    .eq('usuario_id', user.id)
}
```

---

## 5. Verificación de Rol Facilitador

### 5.1 Función Helper

Se implementó una función consistente para verificar si un usuario es facilitador:

```typescript
const checkIfFacilitador = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('usuario_ong')
    .select('rol')
    .eq('usuario_id', user.id)
    .eq('rol', 'facilitador')
    .eq('activo', true)
    .limit(1)

  return data && data.length > 0
}
```

**Uso en componentes:**
- Se ejecuta al cargar el componente
- Se almacena en estado local (`isFacilitador`)
- Se usa para condicionar la visualización de elementos UI

---

## 6. Resumen de Archivos Modificados

### 6.1 Componentes de Reportes
- ✅ `components/features/reportes/ReporteMensual.tsx`
- ✅ `components/features/reportes/ReporteAsistenciaPorNivel.tsx`
- ✅ `components/features/reportes/ReporteList.tsx`
- ✅ `components/features/reportes/ReporteParticipantesPorMes.tsx`

### 6.2 Componentes de ONGs
- ✅ `components/features/ongs/ONGList.tsx`

### 6.3 Páginas
- ✅ `app/(dashboard)/dashboard/page.tsx`
- ✅ `app/(dashboard)/reportes/page.tsx` (ya tenía soporte para facilitadores)

---

## 7. Comportamiento por Rol

### 7.1 Facilitadores

**Permisos:**
- ✅ Crear nuevas ONGs
- ✅ Ver todas las ONGs del sistema
- ✅ Seleccionar cualquier ONG en reportes (excepto "ONGs por Mes")
- ✅ Acceder al dashboard sin necesidad de ONGs asignadas directamente
- ✅ Ver reportes de todas las ONGs

**Interfaz:**
- Botón "Crear Nueva ONG" visible
- Selector de ONG en todos los reportes (excepto "ONGs por Mes")
- Título "ONGs del Sistema" en lugar de "Mis ONGs"

### 7.2 Secretarios y Tutores

**Permisos:**
- ❌ No pueden crear ONGs
- ✅ Ven solo sus ONGs asignadas
- ✅ Selector de ONG solo muestra sus ONGs
- ✅ Acceso normal al dashboard y reportes

**Interfaz:**
- Sin botón de crear ONG
- Selector de ONG limitado a sus ONGs
- Título "Mis ONGs"

---

## 8. Mejoras Técnicas

### 8.1 Consistencia de Código
- Misma lógica de verificación de facilitador en todos los componentes
- Función `loadUserONGs` estandarizada
- Manejo de errores consistente

### 8.2 Performance
- Verificación de facilitador se hace una vez al cargar
- Carga de ONGs optimizada con queries específicas
- No se cargan datos innecesarios

### 8.3 Mantenibilidad
- Código modular y reutilizable
- Fácil de extender para nuevos roles
- Comentarios claros en el código

---

## 9. Pruebas Recomendadas

### 9.1 Como Facilitador
1. ✅ Verificar que aparece el botón "Crear Nueva ONG"
2. ✅ Crear una nueva ONG y verificar que aparece en la lista
3. ✅ Verificar que el dashboard muestra todas las ONGs
4. ✅ Verificar que los reportes tienen selector de ONG
5. ✅ Generar reportes de diferentes ONGs
6. ✅ Verificar que "ONGs por Mes" muestra todas las ONGs sin selector

### 9.2 Como Secretario/Tutor
1. ✅ Verificar que NO aparece el botón "Crear Nueva ONG"
2. ✅ Verificar que solo se ven sus ONGs asignadas
3. ✅ Verificar que el selector de ONG solo muestra sus ONGs
4. ✅ Generar reportes y verificar que funcionan correctamente

---

## 10. Notas Importantes

### 10.1 Reporte "ONGs por Mes"
- Este reporte tiene un comportamiento especial
- Los facilitadores NO tienen selector de ONG
- Muestra automáticamente todas las ONGs del sistema
- Esto es intencional según los requisitos

### 10.2 Asociación Automática
- Cuando un facilitador crea una ONG, se asocia automáticamente como facilitador
- Esto se maneja en el componente `ONGDialog`
- No requiere intervención manual

### 10.3 Políticas RLS
- Las políticas de Row Level Security (RLS) siguen aplicándose
- Los facilitadores pueden ver todas las ONGs pero las políticas RLS pueden limitar el acceso a datos específicos
- Esto asegura la seguridad a nivel de base de datos

---

## 11. Próximos Pasos Sugeridos

### 11.1 Mejoras Futuras
- [ ] Agregar permisos para que facilitadores gestionen miembros de ONGs
- [ ] Implementar edición masiva de ONGs para facilitadores
- [ ] Agregar filtros avanzados en reportes para facilitadores
- [ ] Dashboard con estadísticas agregadas de todas las ONGs

### 11.2 Optimizaciones
- [ ] Cachear la verificación de rol facilitador
- [ ] Implementar paginación para listas grandes de ONGs
- [ ] Agregar búsqueda en el selector de ONG

---

## 12. Conclusión

Se han implementado exitosamente todas las funcionalidades solicitadas para facilitadores:

1. ✅ Creación de ONGs
2. ✅ Selector de ONG en reportes
3. ✅ Visualización de todas las ONGs en dashboard
4. ✅ Acceso completo a reportes de todas las ONGs

El sistema ahora permite a los facilitadores gestionar completamente las ONGs del sistema mientras mantiene la seguridad y el aislamiento de datos para otros roles.

---

**Documento generado:** Diciembre 2024  
**Última actualización:** Diciembre 2024

