# Facilitador: asignación y gestión en base de datos

El rol de **Facilitador** es **global** y se asigna solo desde la base de datos (no hay interfaz en la app). Un facilitador puede empezar sin FCPs y crear las suyas después de iniciar sesión.

## Flujo del facilitador

1. **Asignación**: Se añade al usuario en la tabla `facilitadores` con un script SQL.
2. **Inicio de sesión**: El usuario entra con su cuenta (email/contraseña o OAuth).
3. **Selección de rol**: En `/seleccionar-rol` elige el rol "Facilitador".
4. **Crear FCPs**: Desde la página FCPs crea sus FCPs; cada una quedará asociada a él.

## Estructura de datos

- **Tabla `facilitadores`**: Usuarios con rol Facilitador (rol global, solo lectura desde la app).
- **Tabla `fcps`**: Columna `facilitador_id` indica el facilitador dueño de cada FCP (relación 1:N).

## Requisitos

- Acceso al **SQL Editor** de Supabase (Dashboard → SQL Editor).
- El usuario debe existir en `auth.users` (haber iniciado sesión al menos una vez).

---

## Opción 1: Asignar facilitador global (sin FCPs)

Para dar el rol de facilitador a un usuario que aún no tiene FCPs:

1. Usa el script `scripts/asignar_facilitador.sql`
2. Sustituye `email@ejemplo.com` por el email del usuario
3. Ejecuta en Supabase → SQL Editor

El usuario podrá iniciar sesión, elegir el rol Facilitador y crear sus FCPs desde la app.

---

## Opción 2: Cambiar el facilitador de UNA o VARIAS FCPs

### 1. Obtener IDs necesarios

```sql
-- Ver facilitadores actuales
SELECT f.id, f.usuario_id, u.email 
FROM facilitadores f 
JOIN auth.users u ON u.id = f.usuario_id;

-- Ver FCPs y sus facilitadores actuales
SELECT fcps.id, fcps.razon_social, fcps.facilitador_id, u.email AS facilitador_email
FROM fcps
LEFT JOIN auth.users u ON u.id = fcps.facilitador_id;

-- Buscar el usuario que será el nuevo facilitador (por email)
SELECT id, email FROM auth.users WHERE email = 'nuevo-facilitador@ejemplo.com';
```

### 2. Registrar al nuevo facilitador (si no está en la tabla)

```sql
INSERT INTO facilitadores (usuario_id)
VALUES ('UUID-DEL-NUEVO-USUARIO')
ON CONFLICT (usuario_id) DO NOTHING;
```

### 3. Asignar la FCP al nuevo facilitador

```sql
-- Reemplaza:
-- 'UUID-DE-LA-FCP' = id de la FCP a cambiar
-- 'UUID-DEL-NUEVO-FACILITADOR' = id del usuario que será el nuevo facilitador

UPDATE fcps
SET facilitador_id = 'UUID-DEL-NUEVO-FACILITADOR'
WHERE id = 'UUID-DE-LA-FCP';
```

**Para varias FCPs a la vez:**

```sql
UPDATE fcps
SET facilitador_id = 'UUID-DEL-NUEVO-FACILITADOR'
WHERE id IN ('UUID-FCP-1', 'UUID-FCP-2', 'UUID-FCP-3');
```

---

## Opción 3: Script completo (por email)

Ejecuta esto en el SQL Editor de Supabase, reemplazando los emails:

```sql
-- Variables (reemplaza con tus valores)
-- Email del NUEVO facilitador
-- Email o ID de la FCP (usa razon_social o numero_identificacion si prefieres)

DO $$
DECLARE
  v_nuevo_facilitador_id UUID;
  v_fcp_id UUID;
BEGIN
  -- Obtener ID del nuevo facilitador por email
  SELECT id INTO v_nuevo_facilitador_id 
  FROM auth.users 
  WHERE email = 'nuevo-facilitador@ejemplo.com' 
  LIMIT 1;

  IF v_nuevo_facilitador_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado. Verifica el email.';
  END IF;

  -- Agregar a facilitadores si no existe
  INSERT INTO facilitadores (usuario_id)
  VALUES (v_nuevo_facilitador_id)
  ON CONFLICT (usuario_id) DO NOTHING;

  -- Opción A: Actualizar UNA FCP por ID
  v_fcp_id := 'UUID-DE-LA-FCP';  -- Reemplaza con el ID real de la FCP
  UPDATE fcps SET facilitador_id = v_nuevo_facilitador_id WHERE id = v_fcp_id;

  -- Opción B: Actualizar por numero_identificacion
  -- UPDATE fcps SET facilitador_id = v_nuevo_facilitador_id 
  -- WHERE numero_identificacion = 'PE0530';

  RAISE NOTICE 'Facilitador actualizado correctamente.';
END $$;
```

---

## Opción 4: Transferir TODAS las FCPs de un facilitador a otro

```sql
-- Reemplaza los emails
UPDATE fcps
SET facilitador_id = (
  SELECT id FROM auth.users WHERE email = 'nuevo-facilitador@ejemplo.com' LIMIT 1
)
WHERE facilitador_id = (
  SELECT id FROM auth.users WHERE email = 'facilitador-actual@ejemplo.com' LIMIT 1
);
```

---

## Verificar el cambio

```sql
SELECT fcps.razon_social, fcps.numero_identificacion, u.email AS facilitador_actual
FROM fcps
LEFT JOIN auth.users u ON u.id = fcps.facilitador_id
ORDER BY fcps.razon_social;
```

---

## Notas importantes

1. **Usuario debe existir**: El nuevo facilitador debe tener cuenta en `auth.users` (haber iniciado sesión o haber sido creado).
2. **RLS**: Las políticas permiten solo lectura en `facilitadores`. Los cambios se hacen con privilegios elevados (SQL Editor usa el service role).
3. **Eliminar facilitador antiguo**: Si el facilitador anterior ya no administra ninguna FCP y quieres quitarle el rol, elimínalo de la tabla `facilitadores`:
   ```sql
   DELETE FROM facilitadores WHERE usuario_id = 'UUID-DEL-FACILITADOR-ANTERIOR';
   ```
