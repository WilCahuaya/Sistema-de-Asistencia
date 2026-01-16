-- ============================================
-- MIGRACIÓN INICIAL: Esquema Base de Datos
-- Sistema de Gestión de Asistencias para ONG
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABLA: ongs (Organizaciones No Gubernamentales)
-- ============================================
CREATE TABLE public.ongs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    logo_url TEXT,
    direccion VARCHAR(300),
    telefono VARCHAR(20),
    email VARCHAR(255),
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Índices para ongs
CREATE INDEX idx_ongs_activa ON public.ongs(activa);
CREATE INDEX idx_ongs_created_at ON public.ongs(created_at);

-- ============================================
-- 2. TABLA: usuarios (Extensión de auth.users)
-- ============================================
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre_completo VARCHAR(200),
    telefono VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. TABLA: usuario_ong (Relación Usuario-ONG con Rol)
-- ============================================
CREATE TYPE rol_type AS ENUM ('director', 'secretario', 'tutor');

CREATE TABLE public.usuario_ong (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    ong_id UUID NOT NULL REFERENCES public.ongs(id) ON DELETE CASCADE,
    rol rol_type NOT NULL DEFAULT 'tutor',
    activo BOOLEAN DEFAULT true,
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, ong_id)
);

-- Índices para usuario_ong
CREATE INDEX idx_usuario_ong_usuario_id ON public.usuario_ong(usuario_id);
CREATE INDEX idx_usuario_ong_ong_id ON public.usuario_ong(ong_id);
CREATE INDEX idx_usuario_ong_activo ON public.usuario_ong(activo);
CREATE INDEX idx_usuario_ong_rol ON public.usuario_ong(rol);

-- ============================================
-- 4. TABLA: aulas
-- ============================================
CREATE TABLE public.aulas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ong_id UUID NOT NULL REFERENCES public.ongs(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Índices para aulas
CREATE INDEX idx_aulas_ong_id ON public.aulas(ong_id);
CREATE INDEX idx_aulas_activa ON public.aulas(activa);
CREATE UNIQUE INDEX idx_aulas_ong_nombre ON public.aulas(ong_id, nombre) WHERE activa = true;

-- ============================================
-- 5. TABLA: estudiantes
-- ============================================
CREATE TABLE public.estudiantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ong_id UUID NOT NULL REFERENCES public.ongs(id) ON DELETE CASCADE,
    aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE RESTRICT,
    codigo VARCHAR(50) NOT NULL,
    nombre_completo VARCHAR(200) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Índices para estudiantes
CREATE INDEX idx_estudiantes_ong_id ON public.estudiantes(ong_id);
CREATE INDEX idx_estudiantes_aula_id ON public.estudiantes(aula_id);
CREATE INDEX idx_estudiantes_codigo ON public.estudiantes(codigo);
CREATE INDEX idx_estudiantes_activo ON public.estudiantes(activo);
CREATE UNIQUE INDEX idx_estudiantes_ong_codigo ON public.estudiantes(ong_id, codigo) WHERE activo = true;

-- ============================================
-- 6. TABLA: asistencias
-- ============================================
CREATE TYPE estado_asistencia AS ENUM ('presente', 'falto', 'permiso');

CREATE TABLE public.asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ong_id UUID NOT NULL REFERENCES public.ongs(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    estado estado_asistencia NOT NULL DEFAULT 'presente',
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(estudiante_id, fecha)
);

-- Índices para asistencias
CREATE INDEX idx_asistencias_ong_id ON public.asistencias(ong_id);
CREATE INDEX idx_asistencias_estudiante_id ON public.asistencias(estudiante_id);
CREATE INDEX idx_asistencias_fecha ON public.asistencias(fecha);
CREATE INDEX idx_asistencias_estado ON public.asistencias(estado);
CREATE INDEX idx_asistencias_estudiante_fecha ON public.asistencias(estudiante_id, fecha DESC);

-- ============================================
-- 7. TABLA: historial_movimientos (Auditoría de cambios de aula)
-- ============================================
CREATE TABLE public.historial_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    aula_anterior_id UUID REFERENCES public.aulas(id) ON DELETE SET NULL,
    aula_nueva_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE RESTRICT,
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para historial_movimientos
CREATE INDEX idx_historial_estudiante_id ON public.historial_movimientos(estudiante_id);
CREATE INDEX idx_historial_created_at ON public.historial_movimientos(created_at DESC);

-- ============================================
-- 8. FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_ongs_updated_at BEFORE UPDATE ON public.ongs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuario_ong_updated_at BEFORE UPDATE ON public.usuario_ong
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aulas_updated_at BEFORE UPDATE ON public.aulas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estudiantes_updated_at BEFORE UPDATE ON public.estudiantes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_asistencias_updated_at BEFORE UPDATE ON public.asistencias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. FUNCIÓN HELPER: Verificar membresía en ONG
-- ============================================
CREATE OR REPLACE FUNCTION public.es_miembro_ong(p_ong_id UUID, p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.usuario_ong 
        WHERE usuario_id = p_usuario_id 
        AND ong_id = p_ong_id 
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCIÓN HELPER: Obtener rol del usuario en ONG
-- ============================================
CREATE OR REPLACE FUNCTION public.obtener_rol_ong(p_ong_id UUID, p_usuario_id UUID)
RETURNS rol_type AS $$
DECLARE
    v_rol rol_type;
BEGIN
    SELECT rol INTO v_rol
    FROM public.usuario_ong 
    WHERE usuario_id = p_usuario_id 
    AND ong_id = p_ong_id 
    AND activo = true
    LIMIT 1;
    
    RETURN v_rol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. COMENTARIOS EN TABLAS
-- ============================================
COMMENT ON TABLE public.ongs IS 'Organizaciones No Gubernamentales';
COMMENT ON TABLE public.usuarios IS 'Usuarios del sistema (extensión de auth.users)';
COMMENT ON TABLE public.usuario_ong IS 'Relación entre usuarios y ONGs con roles';
COMMENT ON TABLE public.aulas IS 'Aulas de cada ONG';
COMMENT ON TABLE public.estudiantes IS 'Estudiantes pertenecientes a aulas';
COMMENT ON TABLE public.asistencias IS 'Registro diario de asistencias';
COMMENT ON TABLE public.historial_movimientos IS 'Historial de cambios de aula de estudiantes';

