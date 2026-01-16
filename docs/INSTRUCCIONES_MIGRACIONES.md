# Instrucciones para Ejecutar Migraciones SQL

Este documento explica cómo ejecutar las migraciones SQL en tu proyecto Supabase.

## Opción 1: Usando Supabase Dashboard (Recomendado para empezar)

1. **Abre tu proyecto en Supabase Dashboard**
   - Ve a [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Navega al SQL Editor**
   - En el menú lateral, haz clic en **"SQL Editor"**

3. **Ejecuta las migraciones en orden:**
   - **Migración 1**: Abre `supabase/migrations/20240101000000_initial_schema.sql`
     - Copia todo el contenido
     - Pégalo en el SQL Editor
     - Haz clic en **"Run"** (o presiona Ctrl+Enter)
     - Espera a que termine (debería decir "Success. No rows returned")

   - **Migración 2**: Abre `supabase/migrations/20240101000001_rls_policies.sql`
     - Copia todo el contenido
     - Pégalo en el SQL Editor
     - Haz clic en **"Run"**

   - **Migración 3**: Abre `supabase/migrations/20240101000002_trigger_usuario.sql`
     - Copia todo el contenido
     - Pégalo en el SQL Editor
     - Haz clic en **"Run"**

4. **Verifica que las tablas se crearon:**
   - Ve a **"Table Editor"** en el menú lateral
   - Deberías ver las siguientes tablas:
     - `ongs`
     - `usuarios`
     - `usuario_ong`
     - `aulas`
     - `estudiantes`
     - `asistencias`
     - `historial_movimientos`

## Opción 2: Usando Supabase CLI (Opcional, más avanzado)

Si tienes Supabase CLI instalado:

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Iniciar sesión
supabase login

# Vincular tu proyecto
supabase link --project-ref tu-project-ref

# Aplicar migraciones
supabase db push
```

## Verificación

Después de ejecutar las migraciones, verifica:

1. ✅ Todas las tablas existen
2. ✅ Row Level Security está habilitado en todas las tablas
3. ✅ Los tipos ENUM se crearon correctamente (`rol_type`, `estado_asistencia`)
4. ✅ Las funciones helper existen (`es_miembro_ong`, `obtener_rol_ong`)
5. ✅ El trigger `on_auth_user_created` existe

## Notas Importantes

- ⚠️ **Ejecuta las migraciones en orden** (1, 2, 3)
- ⚠️ **No modifiques las migraciones** una vez ejecutadas en producción
- ⚠️ **Haz un backup** de tu base de datos antes de ejecutar migraciones en producción
- ✅ Las migraciones son idempotentes donde es posible (usando `IF NOT EXISTS`, etc.)

## Solución de Problemas

### Error: "relation already exists"
Si obtienes este error, significa que la tabla ya existe. Puedes:
- Ignorar el error si la tabla ya tiene la estructura correcta
- O eliminar la tabla manualmente y volver a ejecutar (solo en desarrollo)

### Error: "permission denied"
Asegúrate de estar usando las credenciales correctas con permisos de administrador.

### Error: "type does not exist"
Asegúrate de ejecutar las migraciones en orden, ya que algunas dependen de otras.

## Siguiente Paso

Una vez que las migraciones estén ejecutadas, puedes continuar con:
- Paso 6: Configurar Google OAuth
- Paso 7: Implementar autenticación

