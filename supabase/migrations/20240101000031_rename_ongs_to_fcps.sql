-- ============================================
-- MIGRACIÓN: Renombrar ongs a fcps y usuario_ong a fcp_miembros
-- También renombrar todas las columnas ong_id a fcp_id
-- ============================================

-- Paso 0: Eliminar políticas que dependen de funciones que vamos a renombrar/eliminar
-- Esto debe hacerse ANTES de renombrar las tablas para evitar errores de dependencias
-- Intentar eliminar en ambas tablas (por si acaso ya se renombró o no)
DO $$
BEGIN
    -- Intentar eliminar políticas de usuario_ong (nombre antiguo)
    BEGIN
        DROP POLICY IF EXISTS "Facilitators can view all members of their ONGs" ON public.usuario_ong;
        DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.usuario_ong;
    EXCEPTION WHEN undefined_table THEN
        -- La tabla ya fue renombrada, continuar
        NULL;
    END;
    
    -- Intentar eliminar políticas de fcp_miembros (nombre nuevo)
    BEGIN
        DROP POLICY IF EXISTS "Facilitators can view all members of their ONGs" ON public.fcp_miembros;
        DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.fcp_miembros;
    EXCEPTION WHEN undefined_table THEN
        -- La tabla aún no existe, continuar
        NULL;
    END;
END $$;

-- Paso 1: Renombrar tabla ongs a fcps
ALTER TABLE public.ongs RENAME TO fcps;

-- Paso 2: Renombrar tabla usuario_ong a fcp_miembros
ALTER TABLE public.usuario_ong RENAME TO fcp_miembros;

-- Paso 2.5: Eliminar políticas que usan funciones antiguas (después del renombrado)
-- Ahora que la tabla se llama fcp_miembros, podemos eliminar las políticas que usan funciones antiguas
DROP POLICY IF EXISTS "Facilitators can view all members of their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.fcp_miembros;

-- Paso 3: Renombrar columna ong_id a fcp_id en fcp_miembros
ALTER TABLE public.fcp_miembros RENAME COLUMN ong_id TO fcp_id;

-- Paso 4: Renombrar foreign key constraint en fcp_miembros
ALTER TABLE public.fcp_miembros 
DROP CONSTRAINT IF EXISTS usuario_ong_ong_id_fkey,
ADD CONSTRAINT fcp_miembros_fcp_id_fkey 
FOREIGN KEY (fcp_id) REFERENCES public.fcps(id) ON DELETE CASCADE;

-- Paso 5: Renombrar índices en fcp_miembros
DROP INDEX IF EXISTS idx_usuario_ong_ong_id;
CREATE INDEX IF NOT EXISTS idx_fcp_miembros_fcp_id ON public.fcp_miembros(fcp_id);

DROP INDEX IF EXISTS idx_usuario_ong_usuario_id;
CREATE INDEX IF NOT EXISTS idx_fcp_miembros_usuario_id ON public.fcp_miembros(usuario_id);

DROP INDEX IF EXISTS idx_usuario_ong_activo;
CREATE INDEX IF NOT EXISTS idx_fcp_miembros_activo ON public.fcp_miembros(activo);

DROP INDEX IF EXISTS idx_usuario_ong_rol;
CREATE INDEX IF NOT EXISTS idx_fcp_miembros_rol ON public.fcp_miembros(rol);

-- Paso 6: Renombrar constraint UNIQUE en fcp_miembros
ALTER TABLE public.fcp_miembros 
DROP CONSTRAINT IF EXISTS usuario_ong_usuario_id_ong_id_key,
ADD CONSTRAINT fcp_miembros_usuario_id_fcp_id_key UNIQUE(usuario_id, fcp_id);

-- Paso 7: Renombrar columna ong_id a fcp_id en aulas
ALTER TABLE public.aulas RENAME COLUMN ong_id TO fcp_id;

-- Paso 8: Renombrar foreign key constraint en aulas
ALTER TABLE public.aulas 
DROP CONSTRAINT IF EXISTS aulas_ong_id_fkey,
ADD CONSTRAINT aulas_fcp_id_fkey 
FOREIGN KEY (fcp_id) REFERENCES public.fcps(id) ON DELETE CASCADE;

-- Paso 9: Renombrar índices en aulas
DROP INDEX IF EXISTS idx_aulas_ong_id;
CREATE INDEX IF NOT EXISTS idx_aulas_fcp_id ON public.aulas(fcp_id);

DROP INDEX IF EXISTS idx_aulas_ong_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aulas_fcp_nombre ON public.aulas(fcp_id, nombre) WHERE activa = true;

-- Paso 10: Renombrar columna ong_id a fcp_id en estudiantes
ALTER TABLE public.estudiantes RENAME COLUMN ong_id TO fcp_id;

-- Paso 11: Renombrar foreign key constraint en estudiantes
ALTER TABLE public.estudiantes 
DROP CONSTRAINT IF EXISTS estudiantes_ong_id_fkey,
ADD CONSTRAINT estudiantes_fcp_id_fkey 
FOREIGN KEY (fcp_id) REFERENCES public.fcps(id) ON DELETE CASCADE;

-- Paso 12: Renombrar índices en estudiantes
DROP INDEX IF EXISTS idx_estudiantes_ong_id;
CREATE INDEX IF NOT EXISTS idx_estudiantes_fcp_id ON public.estudiantes(fcp_id);

DROP INDEX IF EXISTS idx_estudiantes_ong_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estudiantes_fcp_codigo ON public.estudiantes(fcp_id, codigo) WHERE activo = true;

-- Paso 13: Renombrar columna ong_id a fcp_id en asistencias
ALTER TABLE public.asistencias RENAME COLUMN ong_id TO fcp_id;

-- Paso 14: Renombrar foreign key constraint en asistencias
ALTER TABLE public.asistencias 
DROP CONSTRAINT IF EXISTS asistencias_ong_id_fkey,
ADD CONSTRAINT asistencias_fcp_id_fkey 
FOREIGN KEY (fcp_id) REFERENCES public.fcps(id) ON DELETE CASCADE;

-- Paso 15: Renombrar índices en asistencias
DROP INDEX IF EXISTS idx_asistencias_ong_id;
CREATE INDEX IF NOT EXISTS idx_asistencias_fcp_id ON public.asistencias(fcp_id);

-- Paso 16: Renombrar índices en fcps
DROP INDEX IF EXISTS idx_ongs_activa;
CREATE INDEX IF NOT EXISTS idx_fcps_activa ON public.fcps(activa);

DROP INDEX IF EXISTS idx_ongs_created_at;
CREATE INDEX IF NOT EXISTS idx_fcps_created_at ON public.fcps(created_at);

-- Paso 17: Renombrar triggers
DROP TRIGGER IF EXISTS update_ongs_updated_at ON public.fcps;
CREATE TRIGGER update_fcps_updated_at BEFORE UPDATE ON public.fcps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuario_ong_updated_at ON public.fcp_miembros;
CREATE TRIGGER update_fcp_miembros_updated_at BEFORE UPDATE ON public.fcp_miembros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Paso 18: Actualizar comentarios
COMMENT ON TABLE public.fcps IS 'Fundaciones de Cooperación Popular (FCP)';
COMMENT ON TABLE public.fcp_miembros IS 'Relación entre usuarios y FCPs con roles';
COMMENT ON COLUMN public.fcp_miembros.fcp_id IS 'ID de la FCP a la que pertenece el usuario';

-- Paso 19: Actualizar función es_miembro_ong a es_miembro_fcp
CREATE OR REPLACE FUNCTION public.es_miembro_fcp(p_fcp_id UUID, p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.fcp_miembros 
        WHERE usuario_id = p_usuario_id 
        AND fcp_id = p_fcp_id 
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar función antigua
DROP FUNCTION IF EXISTS public.es_miembro_ong(UUID, UUID);

-- Paso 20: Actualizar función obtener_rol_ong a obtener_rol_fcp
CREATE OR REPLACE FUNCTION public.obtener_rol_fcp(p_fcp_id UUID, p_usuario_id UUID)
RETURNS rol_type AS $$
DECLARE
    v_rol rol_type;
BEGIN
    SELECT rol INTO v_rol
    FROM public.fcp_miembros 
    WHERE usuario_id = p_usuario_id 
    AND fcp_id = p_fcp_id 
    AND activo = true
    LIMIT 1;
    
    RETURN v_rol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar función antigua
DROP FUNCTION IF EXISTS public.obtener_rol_ong(UUID, UUID);

-- Paso 21: Actualizar función is_user_facilitador_of_ong a is_user_facilitador_of_fcp
-- PRIMERO asegurarse de eliminar todas las políticas que usan la función antigua
-- (por si acaso alguna se creó después del paso 2.5)
-- NOTA: usuario_ong ya fue renombrada a fcp_miembros en el Paso 2, así que solo intentamos en fcp_miembros
DROP POLICY IF EXISTS "Facilitators can view all members of their ONGs" ON public.fcp_miembros;
DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.fcp_miembros;

-- Crear nueva función
CREATE OR REPLACE FUNCTION public.is_user_facilitador_of_fcp(
    p_usuario_id uuid,
    p_fcp_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.fcp_miembros
        WHERE usuario_id = p_usuario_id
        AND fcp_id = p_fcp_id
        AND rol = 'facilitador'
        AND activo = true
    );
$$;

-- Eliminar función antigua
-- Usar CASCADE para eliminar automáticamente cualquier dependencia restante
DROP FUNCTION IF EXISTS public.is_user_facilitador_of_ong(uuid, uuid) CASCADE;

COMMENT ON FUNCTION public.es_miembro_fcp IS 'Verifica si un usuario es miembro de una FCP';
COMMENT ON FUNCTION public.obtener_rol_fcp IS 'Obtiene el rol de un usuario en una FCP';
COMMENT ON FUNCTION public.is_user_facilitador_of_fcp IS 'Verifica si un usuario es facilitador de una FCP';

-- Paso 22: Actualizar tabla tutor_aula
-- Renombrar columna ong_id a fcp_id en tutor_aula
ALTER TABLE public.tutor_aula RENAME COLUMN ong_id TO fcp_id;

-- Renombrar foreign key constraint en tutor_aula
ALTER TABLE public.tutor_aula 
DROP CONSTRAINT IF EXISTS tutor_aula_ong_id_fkey,
ADD CONSTRAINT tutor_aula_fcp_id_fkey 
FOREIGN KEY (fcp_id) REFERENCES public.fcps(id) ON DELETE CASCADE;

-- Renombrar índices en tutor_aula
DROP INDEX IF EXISTS idx_tutor_aula_ong_id;
CREATE INDEX IF NOT EXISTS idx_tutor_aula_fcp_id ON public.tutor_aula(fcp_id);

-- Renombrar columna usuario_ong_id a fcp_miembro_id en tutor_aula
ALTER TABLE public.tutor_aula RENAME COLUMN usuario_ong_id TO fcp_miembro_id;

-- Renombrar foreign key constraint de usuario_ong_id
ALTER TABLE public.tutor_aula 
DROP CONSTRAINT IF EXISTS tutor_aula_usuario_ong_id_fkey,
ADD CONSTRAINT tutor_aula_fcp_miembro_id_fkey 
FOREIGN KEY (fcp_miembro_id) REFERENCES public.fcp_miembros(id) ON DELETE CASCADE;

-- Renombrar índices relacionados con usuario_ong_id
DROP INDEX IF EXISTS idx_tutor_aula_usuario_ong_id;
CREATE INDEX IF NOT EXISTS idx_tutor_aula_fcp_miembro_id ON public.tutor_aula(fcp_miembro_id);

-- Renombrar constraint UNIQUE en tutor_aula
ALTER TABLE public.tutor_aula 
DROP CONSTRAINT IF EXISTS tutor_aula_usuario_ong_id_aula_id_key,
ADD CONSTRAINT tutor_aula_fcp_miembro_id_aula_id_key UNIQUE(fcp_miembro_id, aula_id);

-- Actualizar función sync_tutor_aula_ong_id a sync_tutor_aula_fcp_id
CREATE OR REPLACE FUNCTION public.sync_tutor_aula_fcp_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Si fcp_id no está establecido, obtenerlo desde fcp_miembros
    IF NEW.fcp_id IS NULL THEN
        SELECT fcp_id INTO NEW.fcp_id
        FROM public.fcp_miembros
        WHERE id = NEW.fcp_miembro_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger y función antiguos
DROP TRIGGER IF EXISTS trigger_sync_tutor_aula_ong_id ON public.tutor_aula;
DROP FUNCTION IF EXISTS public.sync_tutor_aula_ong_id();

-- Crear nuevo trigger
CREATE TRIGGER trigger_sync_tutor_aula_fcp_id
    BEFORE INSERT OR UPDATE ON public.tutor_aula
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_tutor_aula_fcp_id();

-- Actualizar función get_tutor_classrooms
-- PRIMERO eliminar la función antigua (porque no podemos cambiar nombres de parámetros con CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_tutor_classrooms(UUID, UUID);

-- Crear nueva función con nuevos nombres de parámetros
CREATE FUNCTION public.get_tutor_classrooms(p_usuario_id UUID, p_fcp_id UUID)
RETURNS TABLE (
    aula_id UUID,
    aula_nombre VARCHAR
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT DISTINCT
        a.id AS aula_id,
        a.nombre AS aula_nombre
    FROM public.tutor_aula ta
    JOIN public.fcp_miembros fm ON fm.id = ta.fcp_miembro_id
    JOIN public.aulas a ON a.id = ta.aula_id
    WHERE fm.usuario_id = p_usuario_id
    AND fm.fcp_id = p_fcp_id
    AND fm.rol = 'tutor'
    AND fm.activo = true
    AND ta.activo = true
    AND a.activa = true;
$$;

COMMENT ON COLUMN public.tutor_aula.fcp_id IS 'FCP a la que pertenece esta asignación (se sincroniza automáticamente desde fcp_miembros)';
COMMENT ON COLUMN public.tutor_aula.fcp_miembro_id IS 'ID del miembro de la FCP (tutor) asignado al aula';
COMMENT ON FUNCTION public.sync_tutor_aula_fcp_id IS 'Mantiene fcp_id sincronizado automáticamente desde fcp_miembros';
COMMENT ON FUNCTION public.get_tutor_classrooms IS 'Obtiene las aulas asignadas a un tutor en una FCP específica';
COMMENT ON TABLE public.tutor_aula IS 'Relación entre tutores (fcp_miembros) y aulas asignadas';

