import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_PAGE = 5000
const IN_CHUNK = 200

export type AsistenciaFlatRow = {
  estudiante_id: string
  fecha: string
  estado: string
  aula_id: string | null
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
  const selectCols = 'estudiante_id, estado, fecha, aula_id'
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
