-- ============================================
-- Reestructurar tabla ongs (FCP) con solo los campos necesarios
-- Elimina campos antiguos y prepara para nueva estructura
-- ============================================

-- Paso 1: Agregar nuevos campos a la tabla ongs (si no existen)
ALTER TABLE public.ongs
ADD COLUMN IF NOT EXISTS numero_identificacion VARCHAR(50),
ADD COLUMN IF NOT EXISTS razon_social VARCHAR(200),
ADD COLUMN IF NOT EXISTS nombre_completo_contacto VARCHAR(200),
ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(200),
ADD COLUMN IF NOT EXISTS rol_contacto VARCHAR(50);

-- Paso 2: Establecer valores por defecto temporales para campos vacíos
-- Esto permite hacer los campos NOT NULL sin errores
-- Solo actualiza si los campos están NULL o vacíos
DO $$
BEGIN
  -- Verificar si la columna nombre existe antes de usarla
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ongs' 
    AND column_name = 'nombre'
  ) THEN
    -- Si existe nombre, migrar a razon_social
    UPDATE public.ongs
    SET razon_social = COALESCE(NULLIF(razon_social, ''), nombre)
    WHERE (razon_social IS NULL OR razon_social = '') AND nombre IS NOT NULL;
  END IF;

  -- Verificar si la columna direccion existe antes de usarla
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ongs' 
    AND column_name = 'direccion'
  ) THEN
    -- Si existe direccion, migrar a ubicacion
    UPDATE public.ongs
    SET ubicacion = COALESCE(NULLIF(ubicacion, ''), direccion)
    WHERE (ubicacion IS NULL OR ubicacion = '') AND direccion IS NOT NULL;
  END IF;
END $$;

-- Establecer valores por defecto para todos los campos nuevos
UPDATE public.ongs
SET 
  numero_identificacion = COALESCE(NULLIF(numero_identificacion, ''), UPPER(SUBSTRING(id::text, 1, 6))),
  razon_social = COALESCE(NULLIF(razon_social, ''), 'FCP Sin Nombre'),
  nombre_completo_contacto = COALESCE(NULLIF(nombre_completo_contacto, ''), ''),
  telefono = COALESCE(NULLIF(telefono, ''), ''),
  email = COALESCE(NULLIF(email, ''), ''),
  ubicacion = COALESCE(NULLIF(ubicacion, ''), ''),
  rol_contacto = COALESCE(NULLIF(rol_contacto, ''), 'Director');

-- Paso 3: Hacer los nuevos campos NOT NULL
ALTER TABLE public.ongs
ALTER COLUMN numero_identificacion SET NOT NULL,
ALTER COLUMN razon_social SET NOT NULL,
ALTER COLUMN nombre_completo_contacto SET NOT NULL,
ALTER COLUMN telefono SET NOT NULL,
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN ubicacion SET NOT NULL,
ALTER COLUMN rol_contacto SET NOT NULL;

-- Paso 4: Eliminar campos antiguos que ya no se necesitan
ALTER TABLE public.ongs
DROP COLUMN IF EXISTS nombre,
DROP COLUMN IF EXISTS descripcion,
DROP COLUMN IF EXISTS logo_url,
DROP COLUMN IF EXISTS direccion;

-- Comentarios para documentación
COMMENT ON COLUMN public.ongs.numero_identificacion IS 'Número de identificación de la FCP (ej: PE0530)';
COMMENT ON COLUMN public.ongs.razon_social IS 'Razón social de la FCP (ej: RESCATANDO VALORES)';
COMMENT ON COLUMN public.ongs.nombre_completo_contacto IS 'Nombre completo del contacto (ej: Juan Pérez Camacho)';
COMMENT ON COLUMN public.ongs.telefono IS 'Teléfono de contacto (ej: +51 987654321)';
COMMENT ON COLUMN public.ongs.email IS 'Correo electrónico de contacto (ej: juan.perez@ci.org)';
COMMENT ON COLUMN public.ongs.ubicacion IS 'Ubicación de la FCP (ej: Lima, Perú)';
COMMENT ON COLUMN public.ongs.rol_contacto IS 'Rol del contacto (ej: Director)';

