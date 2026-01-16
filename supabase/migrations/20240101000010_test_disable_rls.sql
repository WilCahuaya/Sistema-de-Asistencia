-- TEST TEMPORAL: Deshabilitar RLS para verificar si el problema es realmente la política
-- ⚠️ SOLO PARA DEBUGGING - NO USAR EN PRODUCCIÓN

-- Primero, deshabilitar RLS temporalmente
ALTER TABLE public.ongs DISABLE ROW LEVEL SECURITY;

-- Comentario: Ejecuta esto y prueba crear una ONG. Si funciona, el problema es la política RLS.
-- Si no funciona, el problema es otro (permisos de tabla, constraints, etc.)

-- Para re-habilitar RLS después del test, ejecuta:
-- ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;

