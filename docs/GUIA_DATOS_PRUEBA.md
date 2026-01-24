# 📊 Guía de Datos de Prueba

## Descripción

Este documento explica cómo usar el script de datos de prueba para generar un conjunto completo de datos de testing en la aplicación.

## 📁 Archivo

El script se encuentra en:
```
supabase/migrations/20240101000099_datos_prueba.sql
```

## 🎯 Qué Crea el Script

El script genera los siguientes datos de prueba:

### 1. **5 FCPs**
- **FCP001**: FCP Desarrollo Comunitario (grande, múltiples aulas)
- **FCP002**: FCP Educación Rural (mediana)
- **FCP003**: FCP Jóvenes Emprendedores (pequeña)
- **FCP004**: FCP Nuevos Horizontes (nueva, poca data)
- **FCP005**: FCP Inactiva (para probar filtros)

### 2. **15 Usuarios de Prueba**
- **2 Facilitadores**: Pueden crear FCPs y gestionar múltiples
- **3 Directores**: Uno por cada FCP principal
- **2 Secretarios**: Para FCP001 y FCP002
- **5 Tutores**: Asignados a diferentes aulas
- **1 Usuario Multi-Rol**: Tiene múltiples roles en diferentes FCPs (para probar selección de rol)

### 3. **15 Aulas**
- Distribuidas entre las FCPs activas
- Diferentes niveles y especialidades
- Algunas con tutores asignados

### 4. **200+ Estudiantes**
- Distribuidos en las aulas activas
- Entre 15-30 estudiantes por aula
- Nombres realistas generados aleatoriamente
- Códigos únicos por FCP

### 5. **Asistencias**
- **Mes anterior**: Completas e incompletas (70% completas, 30% incompletas)
- **Mes actual**: Hasta la fecha actual (80% completas, 20% incompletas)
- Solo días laborables (lunes a viernes)
- Estados: Presente (70%), Faltó (20%), Permiso (10%)

### 6. **Relaciones**
- Roles asignados en `fcp_miembros`
- Tutores asignados a aulas en `tutor_aula`

## ⚠️ IMPORTANTE: Antes de Ejecutar

### 1. Crear Usuarios en auth.users ⚠️ OBLIGATORIO

**El script REQUIERE que los usuarios existan primero en `auth.users`**. Si no los creas, el script fallará con error de foreign key constraint.

**Debes crear estos usuarios primero usando uno de estos métodos:**

#### Opción A: Crear usuarios manualmente en Supabase Dashboard (Recomendado para testing)

1. Ve a **Authentication > Users** en Supabase Dashboard
2. Haz clic en **"Add User"** o **"Invite User"**
3. Crea usuarios con estos emails y contraseñas temporales (ej: `Test123!`):
   - `facilitador1@test.com`
   - `facilitador2@test.com`
   - `director1@test.com`
   - `director2@test.com`
   - `director3@test.com`
   - `secretario1@test.com`
   - `secretario2@test.com`
   - `tutor1@test.com`
   - `tutor2@test.com`
   - `tutor3@test.com`
   - `tutor4@test.com`
   - `tutor5@test.com`
   - `multirole@test.com`

#### Opción B: Usar Google OAuth (Más realista - Recomendado)

1. Crea cuentas de Gmail de prueba o usa cuentas existentes
2. Inicia sesión en la aplicación con esas cuentas (una por una)
3. Esto creará automáticamente los usuarios en `auth.users` y `public.usuarios`
4. **IMPORTANTE**: Después de crear los usuarios, obtén sus UUIDs reales:
   ```sql
   SELECT id, email FROM auth.users WHERE email LIKE '%@test.com' ORDER BY email;
   ```
5. Actualiza los UUIDs en el script `20240101000099_datos_prueba.sql` con los UUIDs reales

#### Opción C: Usar Supabase Admin API (Para automatización)

Si tienes acceso a la Service Role Key, puedes crear usuarios programáticamente:

```bash
# Ejemplo usando curl
curl -X POST 'https://[tu-proyecto].supabase.co/auth/v1/admin/users' \
  -H "apikey: [service-role-key]" \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "facilitador1@test.com",
    "password": "Test123!",
    "email_confirm": true
  }'
```

Repite para cada usuario de la lista.

### 2. Obtener UUIDs Reales y Actualizar el Script

**Después de crear los usuarios** (con cualquier método), necesitas obtener sus UUIDs reales:

1. Ejecuta esta consulta en Supabase SQL Editor:
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN (
  'facilitador1@test.com',
  'facilitador2@test.com',
  'director1@test.com',
  'director2@test.com',
  'director3@test.com',
  'secretario1@test.com',
  'secretario2@test.com',
  'tutor1@test.com',
  'tutor2@test.com',
  'tutor3@test.com',
  'tutor4@test.com',
  'tutor5@test.com',
  'multirole@test.com'
)
ORDER BY email;
```

2. Copia los UUIDs de la consulta anterior

3. Abre el archivo `supabase/migrations/20240101000099_datos_prueba.sql`

4. Busca la sección "3. CREAR USUARIOS DE PRUEBA" (alrededor de la línea 60)

5. Reemplaza los UUIDs fijos con los UUIDs reales obtenidos de la consulta

**Ejemplo:**
```sql
-- Antes (UUIDs fijos):
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'facilitador1@test.com', ...)

-- Después (UUIDs reales):
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'facilitador1@test.com', ...)
```

## 🚀 Cómo Ejecutar

### Método 1: Supabase Dashboard (Recomendado)

1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia y pega el contenido de `supabase/migrations/20240101000099_datos_prueba.sql`
4. **IMPORTANTE**: Asegúrate de haber creado los usuarios primero (ver sección anterior)
5. Ejecuta el script
6. Verifica que no haya errores

### Método 2: Supabase CLI

```bash
# Asegúrate de estar en el directorio del proyecto
cd /home/wilcahuaya/Documents/Aplicaciones/Asistencia

# Aplicar migración
supabase db push

# O aplicar solo esta migración específica
supabase migration up 20240101000099_datos_prueba
```

### Método 3: psql Directo

```bash
psql -h [tu-host] -U [tu-usuario] -d [tu-database] -f supabase/migrations/20240101000099_datos_prueba.sql
```

## ✅ Verificar Datos Creados

Después de ejecutar el script, verifica que los datos se crearon correctamente:

```sql
-- Ver FCPs creadas
SELECT id, razon_social, numero_identificacion, activa 
FROM public.fcps 
WHERE razon_social LIKE '%[TEST]%'
ORDER BY created_at;

-- Ver usuarios creados
SELECT id, email, nombre_completo 
FROM public.usuarios 
WHERE email LIKE '%@test.com'
ORDER BY email;

-- Ver roles asignados
SELECT 
  u.email,
  u.nombre_completo,
  f.razon_social,
  fm.rol
FROM public.fcp_miembros fm
JOIN public.usuarios u ON fm.usuario_id = u.id
JOIN public.fcps f ON fm.fcp_id = f.id
WHERE u.email LIKE '%@test.com'
ORDER BY u.email, f.razon_social;

-- Ver aulas creadas
SELECT 
  f.razon_social,
  a.nombre,
  COUNT(e.id) as total_estudiantes
FROM public.aulas a
JOIN public.fcps f ON a.fcp_id = f.id
LEFT JOIN public.estudiantes e ON a.id = e.aula_id AND e.activo = true
WHERE f.razon_social LIKE '%[TEST]%'
GROUP BY f.razon_social, a.id, a.nombre
ORDER BY f.razon_social, a.nombre;

-- Ver asistencias creadas
SELECT 
  f.razon_social,
  DATE_TRUNC('month', a.fecha) as mes,
  COUNT(*) as total_asistencias,
  COUNT(DISTINCT a.fecha) as dias_con_asistencia
FROM public.asistencias a
JOIN public.fcps f ON a.fcp_id = f.id
WHERE f.razon_social LIKE '%[TEST]%'
GROUP BY f.razon_social, DATE_TRUNC('month', a.fecha)
ORDER BY f.razon_social, mes DESC;
```

## 🧪 Casos de Prueba Cubiertos

El script genera datos que cubren estos casos de prueba:

### ✅ Roles y Permisos
- [x] Facilitador con múltiples FCPs
- [x] Director de una FCP específica
- [x] Secretario de una FCP específica
- [x] Tutor asignado a aulas específicas
- [x] Usuario con múltiples roles en diferentes FCPs

### ✅ Filtrado por Rol
- [x] Facilitadores solo ven sus FCPs asignadas
- [x] Directores solo ven su FCP asignada
- [x] Secretarios solo ven su FCP asignada
- [x] Tutores solo ven sus aulas asignadas

### ✅ Asistencias
- [x] Días completos (todos los estudiantes marcados)
- [x] Días incompletos (algunos estudiantes sin marcar) - **Para probar alertas**
- [x] Diferentes estados (presente, faltó, permiso)
- [x] Asistencias del mes actual y mes anterior

### ✅ Reportes
- [x] Datos suficientes para generar reportes completos
- [x] Días incompletos para probar alertas en reportes
- [x] Múltiples FCPs para probar reportes comparativos

## 🗑️ Limpiar Datos de Prueba

Si necesitas limpiar los datos de prueba:

```sql
-- CUIDADO: Esto eliminará TODOS los datos de prueba
-- Asegúrate de hacer backup si es necesario

DELETE FROM public.asistencias 
WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');

DELETE FROM public.historial_movimientos 
WHERE estudiante_id IN (
  SELECT id FROM public.estudiantes 
  WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%')
);

DELETE FROM public.estudiantes 
WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');

DELETE FROM public.tutor_aula 
WHERE aula_id IN (
  SELECT id FROM public.aulas 
  WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%')
);

DELETE FROM public.aulas 
WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');

DELETE FROM public.fcp_miembros 
WHERE fcp_id IN (SELECT id FROM public.fcps WHERE razon_social LIKE '%[TEST]%');

DELETE FROM public.usuarios 
WHERE email LIKE '%@test.com';

DELETE FROM public.fcps 
WHERE razon_social LIKE '%[TEST]%';
```

## 📝 Notas

1. **UUIDs Fijos**: El script usa UUIDs fijos para facilitar el testing. Si necesitas ejecutarlo múltiples veces, puedes comentar la sección de limpieza o usar UUIDs diferentes.

2. **Fechas**: Las asistencias se generan para el mes actual y el mes anterior. Si ejecutas el script en diferentes meses, los datos cambiarán.

3. **Días Incompletos**: El script genera intencionalmente días incompletos (30% en el mes anterior, 20% en el mes actual) para probar las alertas de días incompletos en los reportes.

4. **Performance**: El script puede tardar varios minutos en ejecutarse debido a la cantidad de datos generados. Sé paciente.

5. **Errores Comunes**:
   - Si ves errores de "usuario no existe", asegúrate de crear los usuarios en `auth.users` primero
   - Si ves errores de "violación de constraint único", los datos ya existen. Usa la sección de limpieza primero

## 🆘 Solución de Problemas

### Error: "usuario no existe en auth.users"
**Solución**: Crea los usuarios primero usando uno de los métodos descritos arriba.

### Error: "violación de constraint único"
**Solución**: Los datos ya existen. Ejecuta la sección de limpieza primero o comenta las inserciones que ya existen.

### Error: "no existe la tabla tutor_aula"
**Solución**: Asegúrate de que todas las migraciones anteriores se hayan aplicado correctamente.

### Los datos no aparecen en la aplicación
**Solución**: 
1. Verifica que los usuarios estén creados en `auth.users`
2. Verifica que los UUIDs en el script coincidan con los UUIDs reales
3. Verifica que las políticas RLS permitan ver los datos
4. Cierra sesión y vuelve a iniciar sesión en la aplicación

---

**Última actualización**: $(date)

