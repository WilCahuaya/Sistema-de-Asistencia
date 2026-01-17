-- ============================================
-- MIGRACIÓN: Crear nuevo ENUM rol_type con 'facilitador'
-- ============================================

-- Paso 1: Eliminar TODAS las políticas que dependen de la columna 'rol'
-- Esto debe hacerse antes de poder cambiar el tipo de la columna

DROP POLICY IF EXISTS "Directors can update their ONGs" ON public.ongs;
DROP POLICY IF EXISTS "Directors can add members to their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors can update members of their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors can view all members of their ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Users can view their memberships" ON public.usuario_ong;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.usuario_ong;
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propias membresías" ON public.usuario_ong;
DROP POLICY IF EXISTS "Los directores pueden ver todos los miembros de sus ONGs" ON public.usuario_ong;
DROP POLICY IF EXISTS "Directors and Secretaries can create classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can update classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can delete classrooms" ON public.aulas;
DROP POLICY IF EXISTS "Directors and Secretaries can create students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can update students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can delete students" ON public.estudiantes;
DROP POLICY IF EXISTS "Directors and Secretaries can create attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can update attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can delete attendances" ON public.asistencias;
DROP POLICY IF EXISTS "Directors and Secretaries can create movement history" ON public.historial_movimientos;
DROP POLICY IF EXISTS "Users can add members to ONGs" ON public.usuario_ong;

-- Paso 2: Crear nuevo tipo ENUM con los valores correctos
CREATE TYPE rol_type_new AS ENUM ('facilitador', 'secretario', 'tutor');

-- Paso 3: Agregar columna temporal con el nuevo tipo
ALTER TABLE public.usuario_ong 
ADD COLUMN rol_new rol_type_new;

-- Paso 4: Migrar datos: 'director' -> 'facilitador', otros valores igual
UPDATE public.usuario_ong
SET rol_new = CASE 
    WHEN rol::text = 'director' THEN 'facilitador'::rol_type_new
    WHEN rol::text = 'secretario' THEN 'secretario'::rol_type_new
    WHEN rol::text = 'tutor' THEN 'tutor'::rol_type_new
    ELSE 'tutor'::rol_type_new  -- Valor por defecto si hay algún valor inesperado
END;

-- Paso 5: Hacer la nueva columna NOT NULL
ALTER TABLE public.usuario_ong 
ALTER COLUMN rol_new SET NOT NULL;

-- Paso 6: Eliminar la columna antigua (ahora es seguro porque no hay políticas que dependan de ella)
ALTER TABLE public.usuario_ong 
DROP COLUMN rol;

-- Paso 7: Renombrar la nueva columna a 'rol'
ALTER TABLE public.usuario_ong 
RENAME COLUMN rol_new TO rol;

-- Paso 8: Eliminar el tipo ENUM antiguo (solo si no hay más referencias)
DROP TYPE IF EXISTS rol_type CASCADE;

-- Paso 9: Renombrar el nuevo tipo a 'rol_type'
ALTER TYPE rol_type_new RENAME TO rol_type;
