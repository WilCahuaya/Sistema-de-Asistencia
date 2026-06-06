import type { SupabaseClient } from '@supabase/supabase-js'

/** PostgREST/Supabase suele limitar ~1000 filas por petición; usar el mismo tamaño en `.range()`. */
const DEFAULT_PAGE = 1000
const IN_CHUNK = 200

export type AsistenciaFlatRow = {
  estudiante_id: string
  fecha: string
  estado: string
  aula_id: string | null
  registro_tardio?: boolean
}

export type EstudianteReporteRow = {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  created_at: string | null
}

/** Parsea filas devueltas por RPC estudiantes_activos_en_rango (SETOF uuid u objeto). */
export function parseEstudiantesActivosEnRangoIds(data: unknown): string[] {
  return (data || []).flatMap((x: unknown) => {
    if (typeof x === 'string') return [x]
    if (x && typeof x === 'object') {
      const v =
        (x as Record<string, unknown>)['estudiante_id'] ?? Object.values(x as object)[0]
      return typeof v === 'string' ? [v] : []
    }
    return []
  })
}

/** Carga asistencias en rango sin joins (mucho más rápido que anidar aulas/estudiantes por fila). */
export async function fetchAsistenciasRangoFlat(
  supabase: SupabaseClient,
  fcpId: string,
  fechaInicio: string,
  fechaFin: string,
  options?: { pageSize?: number }
): Promise<AsistenciaFlatRow[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE
  const selectCols = 'estudiante_id, estado, fecha, aula_id, registro_tardio'
  let all: AsistenciaFlatRow[] = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data: page, error } = await supabase
      .from('asistencias')
      .select(selectCols)
      .eq('fcp_id', fcpId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    const rows = (page || []) as AsistenciaFlatRow[]
    all = all.concat(rows)
    hasMore = rows.length === pageSize
    offset += pageSize
  }
  return all
}

/** Asistencias de una intervención en rango (misma consulta que el calendario de asistencia). */
export async function fetchAsistenciasIntervencionRango(
  supabase: SupabaseClient,
  fcpId: string,
  aulaId: string,
  fechaInicio: string,
  fechaFin: string,
  options?: { pageSize?: number }
): Promise<AsistenciaFlatRow[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE
  const selectCols = 'estudiante_id, estado, fecha, aula_id, registro_tardio'
  let all: AsistenciaFlatRow[] = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data: page, error } = await supabase
      .from('asistencias')
      .select(selectCols)
      .eq('fcp_id', fcpId)
      .eq('aula_id', aulaId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    const rows = (page || []) as AsistenciaFlatRow[]
    all = all.concat(rows)
    hasMore = rows.length === pageSize
    offset += pageSize
  }
  return all
}

async function fetchInChunks<T extends { id: string }>(
  supabase: SupabaseClient,
  table: 'estudiantes' | 'aulas',
  ids: string[],
  select: string
): Promise<Map<string, T>> {
  const map = new Map<string, T>()
  const unique = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const slice = unique.slice(i, i + IN_CHUNK)
    if (slice.length === 0) continue
    const { data, error } = await supabase.from(table).select(select).in('id', slice)
    if (error) throw error
    ;(data as T[] | null)?.forEach((row) => map.set(row.id, row))
  }
  return map
}

export async function fetchEstudiantesMapByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, EstudianteReporteRow>> {
  return fetchInChunks<EstudianteReporteRow>(
    supabase,
    'estudiantes',
    ids,
    'id, codigo, nombre_completo, aula_id, created_at'
  )
}

export type AulaNombreRow = { id: string; nombre: string }

export async function fetchAulasMapByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, AulaNombreRow>> {
  return fetchInChunks<AulaNombreRow>(supabase, 'aulas', ids, 'id, nombre')
}

/** Forma compatible con el código que esperaba joins de PostgREST. */
export function enrichAsistenciasRows(
  rows: AsistenciaFlatRow[],
  estudiantesMap: Map<string, EstudianteReporteRow>,
  aulasMap: Map<string, AulaNombreRow>
): Array<
  AsistenciaFlatRow & {
    aula: { id: string; nombre: string } | null
    estudiante: EstudianteReporteRow | null
  }
> {
  return rows.map((r) => ({
    ...r,
    aula:
      r.aula_id && aulasMap.has(r.aula_id)
        ? { id: r.aula_id, nombre: aulasMap.get(r.aula_id)!.nombre }
        : null,
    estudiante: estudiantesMap.get(r.estudiante_id) ?? null,
  }))
}

/** Variante mínima de estudiante (ReporteMensual). */
export type EstudianteMinimalRow = { id: string; aula_id: string; created_at: string | null }

export async function fetchEstudiantesMinimalMapByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, EstudianteMinimalRow>> {
  return fetchInChunks<EstudianteMinimalRow>(
    supabase,
    'estudiantes',
    ids,
    'id, aula_id, created_at'
  )
}

export function enrichAsistenciasRowsMinimalEstudiante(
  rows: AsistenciaFlatRow[],
  estudiantesMap: Map<string, EstudianteMinimalRow>,
  aulasMap: Map<string, AulaNombreRow>
): Array<
  AsistenciaFlatRow & {
    aula: { id: string; nombre: string } | null
    estudiante: EstudianteMinimalRow | null
  }
> {
  return rows.map((r) => ({
    ...r,
    aula:
      r.aula_id && aulasMap.has(r.aula_id)
        ? { id: r.aula_id, nombre: aulasMap.get(r.aula_id)!.nombre }
        : null,
    estudiante: estudiantesMap.get(r.estudiante_id) ?? null,
  }))
}

/** Variante participantes (solo aula_id en estudiante). */
export type EstudianteAulaOnly = { id: string; aula_id: string }

export async function fetchEstudiantesAulaOnlyMapByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, EstudianteAulaOnly>> {
  return fetchInChunks<EstudianteAulaOnly>(supabase, 'estudiantes', ids, 'id, aula_id')
}

export function enrichAsistenciasParticipantes(
  rows: AsistenciaFlatRow[],
  estudiantesMap: Map<string, EstudianteAulaOnly>,
  aulasMap: Map<string, AulaNombreRow>
): Array<
  AsistenciaFlatRow & {
    aula: { id: string; nombre: string } | null
    estudiante: EstudianteAulaOnly | null
  }
> {
  return rows.map((r) => ({
    ...r,
    aula:
      r.aula_id && aulasMap.has(r.aula_id)
        ? { id: r.aula_id, nombre: aulasMap.get(r.aula_id)!.nombre }
        : null,
    estudiante: estudiantesMap.get(r.estudiante_id) ?? null,
  }))
}

/** RPC estudiantes_activos_en_rango en paralelo por aula (concurrencia acotada). */
export async function fetchEstudiantesActivosPorAulas(
  supabase: SupabaseClient,
  aulaIds: string[],
  fechaInicio: string,
  fechaFin: string,
  options?: { concurrency?: number }
): Promise<Map<string, string[]>> {
  const unique = [...new Set(aulaIds.filter(Boolean))]
  const concurrency = Math.max(1, options?.concurrency ?? 8)
  const map = new Map<string, string[]>()
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency)
    const pairs = await Promise.all(
      batch.map(async (aulaId) => {
        const { data, error } = await supabase.rpc('estudiantes_activos_en_rango', {
          p_aula_id: aulaId,
          p_fecha_inicio: fechaInicio,
          p_fecha_fin: fechaFin,
        })
        if (error) throw error
        return [aulaId, parseEstudiantesActivosEnRangoIds(data)] as const
      })
    )
    pairs.forEach(([aulaId, ids]) => map.set(aulaId, ids))
  }
  return map
}

export type EstudianteIntervencionRow = {
  id: string
  aula_id: string
  codigo: string
  nombre_completo: string
  created_at: string | null
}

/** Estudiantes inscritos en intervenciones (roster M2M, no estudiantes.aula_id). */
export async function fetchEstudiantesIntervencionPorAulas(
  supabase: SupabaseClient,
  fcpId: string,
  aulaIds: string[]
): Promise<EstudianteIntervencionRow[]> {
  const unique = [...new Set(aulaIds.filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from('intervencion_estudiantes')
    .select(`
      estudiante_id,
      aula_id,
      estudiante:estudiantes(id, codigo, nombre_completo, created_at)
    `)
    .eq('fcp_id', fcpId)
    .eq('activo', true)
    .in('aula_id', unique)

  if (error) throw error

  return (data || []).map((row: { estudiante_id: string; aula_id: string; estudiante: unknown }) => {
    const est = Array.isArray(row.estudiante) ? row.estudiante[0] : row.estudiante
    const e = est as { codigo?: string; nombre_completo?: string; created_at?: string | null } | null
    return {
      id: row.estudiante_id,
      aula_id: row.aula_id,
      codigo: e?.codigo ?? '',
      nombre_completo: e?.nombre_completo ?? '',
      created_at: e?.created_at ?? null,
    }
  })
}
