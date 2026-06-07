-- =============================================================================
-- Ejecutar en Supabase Dashboard → SQL Editor → New query → Run
-- Tutora: orfishr@gmail.com — roster de intervenciones visible en la app
-- =============================================================================

-- ─── PASO 1: Aplicar política RLS (migración 20240605000001) ───────────────

DROP POLICY IF EXISTS "Facilitators can view all students, others view their FCP students" ON public.estudiantes;

CREATE POLICY "Facilitators can view all students, others view their FCP students"
ON public.estudiantes
FOR SELECT
USING (
    public.es_facilitador(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros
        WHERE usuario_id = auth.uid()
        AND fcp_id = estudiantes.fcp_id
        AND rol IN ('director', 'secretario')
        AND activo = true
    )
    OR
    EXISTS (
        SELECT 1 FROM public.fcp_miembros fm
        JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
        JOIN public.aulas a ON a.id = ta.aula_id
        WHERE fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
        AND ta.activo = true
        AND a.id = estudiantes.aula_id
    )
    OR
    EXISTS (
        SELECT 1 FROM public.intervencion_estudiantes ie
        JOIN public.tutor_aula ta ON ta.aula_id = ie.aula_id AND ta.activo = true
        JOIN public.fcp_miembros fm ON fm.id = ta.fcp_miembro_id
        WHERE ie.estudiante_id = estudiantes.id
        AND ie.activo = true
        AND fm.usuario_id = auth.uid()
        AND fm.rol = 'tutor'
        AND fm.activo = true
    )
);

COMMENT ON POLICY "Facilitators can view all students, others view their FCP students" ON public.estudiantes IS
  'Facilitador: todos. Director/secretario: su FCP. Tutor: salón regular o roster de intervenciones asignadas.';

-- ─── PASO 2: Confirmar que la política quedó aplicada ───────────────────────

SELECT
  pol.polname AS policy_name,
  CASE
    WHEN pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%intervencion_estudiantes%' THEN 'OK — incluye intervenciones'
    ELSE 'REVISAR — no menciona intervencion_estudiantes'
  END AS estado_rls
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND cls.relname = 'estudiantes'
  AND pol.polname = 'Facilitators can view all students, others view their FCP students';

-- ─── PASO 3: Datos de la tutora orfishr@gmail.com ───────────────────────────

SELECT
  u.id AS usuario_id,
  u.email,
  fm.id AS miembro_id,
  fm.fcp_id,
  f.razon_social AS fcp,
  fm.rol,
  fm.activo AS miembro_activo
FROM auth.users u
LEFT JOIN public.fcp_miembros fm ON fm.usuario_id = u.id
LEFT JOIN public.fcps f ON f.id = fm.fcp_id
WHERE u.email = 'orfishr@gmail.com'
ORDER BY fm.rol;

-- Aulas asignadas (¿hay INTERVENTION?)
SELECT
  ta.activo AS tutor_aula_activo,
  a.id AS aula_id,
  a.nombre,
  a.tipo,
  a.codigo_aula,
  a.estado_intervencion,
  a.activa AS aula_activa
FROM auth.users u
JOIN public.fcp_miembros fm ON fm.usuario_id = u.id AND fm.rol = 'tutor' AND fm.activo = true
JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id
JOIN public.aulas a ON a.id = ta.aula_id
WHERE u.email = 'orfishr@gmail.com'
ORDER BY a.tipo, a.nombre;

-- Roster de intervenciones de sus aulas
SELECT
  a.nombre AS intervencion,
  a.codigo_aula,
  a.estado_intervencion,
  e.codigo,
  e.nombre_completo,
  ar.nombre AS aula_regular,
  ie.activo AS inscripcion_activa
FROM auth.users u
JOIN public.fcp_miembros fm ON fm.usuario_id = u.id AND fm.rol = 'tutor' AND fm.activo = true
JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id AND ta.activo = true
JOIN public.aulas a ON a.id = ta.aula_id AND a.tipo = 'INTERVENTION'
JOIN public.intervencion_estudiantes ie ON ie.aula_id = a.id
JOIN public.estudiantes e ON e.id = ie.estudiante_id
LEFT JOIN public.aulas ar ON ar.id = e.aula_id
WHERE u.email = 'orfishr@gmail.com'
ORDER BY a.nombre, e.nombre_completo;

-- Conteo por intervención (debe ser > 0 para que la app muestre alumnos)
SELECT
  a.nombre AS intervencion,
  a.codigo_aula,
  COUNT(*) FILTER (WHERE ie.activo = true) AS alumnos_activos,
  COUNT(*) FILTER (WHERE ie.activo = false) AS alumnos_inactivos
FROM auth.users u
JOIN public.fcp_miembros fm ON fm.usuario_id = u.id AND fm.rol = 'tutor' AND fm.activo = true
JOIN public.tutor_aula ta ON ta.fcp_miembro_id = fm.id AND ta.activo = true
JOIN public.aulas a ON a.id = ta.aula_id AND a.tipo = 'INTERVENTION'
LEFT JOIN public.intervencion_estudiantes ie ON ie.aula_id = a.id
WHERE u.email = 'orfishr@gmail.com'
GROUP BY a.id, a.nombre, a.codigo_aula
ORDER BY a.nombre;
