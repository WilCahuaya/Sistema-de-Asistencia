# Cómo Asignar Rol de Facilitador

Este documento explica cómo asignar el rol de facilitador a un usuario directamente desde la base de datos.

## Requisitos

- Acceso a la base de datos de Supabase (SQL Editor)
- Conocer el email del usuario al que se le asignará el rol

## Pasos

### 1. Obtener el ID del Usuario

Primero, necesitas obtener el `id` del usuario desde la tabla `auth.users`:

```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'email@ejemplo.com';
```

Anota el `id` que aparece en los resultados.

### 2. Asignar el Rol de Facilitador

Una vez que tengas el `id` del usuario, ejecuta el siguiente SQL para asignarle el rol de facilitador del sistema:

```sql
INSERT INTO public.fcp_miembros (
    usuario_id, 
    fcp_id, 
    rol, 
    activo, 
    fecha_asignacion
)
VALUES (
    '<user_id_aqui>',  -- Reemplazar con el ID obtenido en el paso 1
    NULL,              -- NULL indica facilitador del sistema (puede gestionar todas las FCPs)
    'facilitador',
    true,
    NOW()
);
```

**Ejemplo completo:**

```sql
-- Paso 1: Buscar el usuario
SELECT id, email FROM auth.users WHERE email = 'wcahuayaquispe@gmail.com';

-- Paso 2: Asignar rol de facilitador (usar el id obtenido)
INSERT INTO public.fcp_miembros (
    usuario_id, 
    fcp_id, 
    rol, 
    activo, 
    fecha_asignacion
)
VALUES (
    'fd0dc4e8-bf7a-4aa3-b43d-20512a876238',  -- ID del usuario
    NULL,                                    -- Facilitador del sistema
    'facilitador',
    true,
    NOW()
);
```

### 3. Verificar la Asignación

Para verificar que el rol se asignó correctamente:

```sql
SELECT 
    fm.id,
    fm.usuario_id,
    u.email,
    fm.rol,
    fm.fcp_id,
    fm.activo,
    fm.fecha_asignacion
FROM public.fcp_miembros fm
JOIN auth.users u ON u.id = fm.usuario_id
WHERE u.email = 'email@ejemplo.com'
AND fm.activo = true;
```

Deberías ver un registro con:
- `rol = 'facilitador'`
- `fcp_id = NULL` (facilitador del sistema)
- `activo = true`

## ¿Qué Puede Hacer un Facilitador?

Una vez asignado el rol de facilitador, el usuario puede:

1. **Crear nuevas FCPs** desde la interfaz
2. **Ver todas las FCPs** del sistema
3. **Gestionar miembros** de cualquier FCP
4. **Ver reportes** de todas las FCPs
5. **Exportar reportes** en Excel y PDF

## Notas Importantes

- Un facilitador con `fcp_id = NULL` es un **facilitador del sistema** y puede gestionar todas las FCPs
- Un facilitador también puede tener registros con `fcp_id` específico si necesita estar vinculado a una FCP particular
- El campo `activo = true` es necesario para que el rol sea reconocido por el sistema
- Si un usuario no tiene ningún rol activo, verá la página `/pendiente` con instrucciones para contactar al administrador

## Solución de Problemas

### El usuario sigue viendo la página pendiente

1. Verifica que el registro existe:
   ```sql
   SELECT * FROM public.fcp_miembros 
   WHERE usuario_id = '<user_id>' AND activo = true;
   ```

2. Verifica que el `usuario_id` es correcto (debe coincidir con `auth.users.id`)

3. Asegúrate de que `activo = true`

4. Si el problema persiste, verifica las políticas RLS en `fcp_miembros`

### Error al insertar

Si obtienes un error de permisos, asegúrate de estar ejecutando el SQL como superusuario o con permisos suficientes en Supabase.

