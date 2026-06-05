/** Tipos y helpers compartidos para aulas regulares e intervenciones. */

export type AulaTipo = 'REGULAR' | 'INTERVENTION'
export type EstadoIntervencion = 'ACTIVA' | 'FINALIZADA' | 'SUSPENDIDA'

export const SEGMENT_AULA_TIPO: { value: AulaTipo; label: string }[] = [
  { value: 'REGULAR', label: 'Regulares' },
  { value: 'INTERVENTION', label: 'Intervenciones' },
]

/** IDs de aulas activas de la FCP filtradas por tipo. */
export async function fetchAulaIdsPorTipo(
  supabase: { from: (t: string) => any },
  fcpId: string,
  tipo: AulaTipo
): Promise<Set<string>> {
  let query = supabase.from('aulas').select('id').eq('fcp_id', fcpId).eq('activa', true)
  if (tipo === 'INTERVENTION') {
    query = query.eq('tipo', 'INTERVENTION')
  } else {
    query = query.or('tipo.eq.REGULAR,tipo.is.null')
  }
  const { data } = await query
  return new Set((data || []).map((a: { id: string }) => a.id))
}

export interface AulaIntervencionMeta {
  tipo?: AulaTipo
  fecha_inicio?: string | null
  fecha_fin?: string | null
  estado_intervencion?: EstadoIntervencion | null
}

export function esIntervencion(aula?: AulaIntervencionMeta | null): boolean {
  return aula?.tipo === 'INTERVENTION'
}

export function esIntervencionActiva(aula?: AulaIntervencionMeta | null): boolean {
  return esIntervencion(aula) && (aula?.estado_intervencion ?? 'ACTIVA') === 'ACTIVA'
}

export function intervencionSoloLectura(aula?: AulaIntervencionMeta | null): boolean {
  if (!esIntervencion(aula)) return false
  const e = aula?.estado_intervencion
  return e === 'SUSPENDIDA' || e === 'FINALIZADA'
}

export function intervencionTemporadaVencida(aula?: AulaIntervencionMeta | null): boolean {
  if (!esIntervencion(aula) || !aula?.fecha_fin) return false
  const hoy = new Date().toISOString().slice(0, 10)
  return aula.fecha_fin < hoy && aula.estado_intervencion === 'ACTIVA'
}

export const ESTADO_INTERVENCION_LABEL: Record<EstadoIntervencion, string> = {
  ACTIVA: 'Activa',
  SUSPENDIDA: 'Suspendida',
  FINALIZADA: 'Finalizada',
}

export const ESTADO_INTERVENCION_CLASS: Record<EstadoIntervencion, string> = {
  ACTIVA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  SUSPENDIDA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  FINALIZADA: 'bg-muted text-muted-foreground',
}

export function formatTemporada(aula?: AulaIntervencionMeta | null): string {
  if (!aula?.fecha_inicio) return '—'
  const fin = aula.fecha_fin ?? 'sin fin'
  return `${aula.fecha_inicio} – ${fin}`
}

/** true si la fecha (YYYY-MM-DD) cae dentro de la temporada de la intervención. */
export function fechaEnTemporadaIntervencion(
  aula: AulaIntervencionMeta | null | undefined,
  fechaStr: string
): boolean {
  if (!esIntervencion(aula)) return true
  if (aula?.fecha_inicio && fechaStr < aula.fecha_inicio) return false
  if (aula?.fecha_fin && fechaStr > aula.fecha_fin) return false
  return true
}

/** true si el mes (1-12) intersecta la temporada de la intervención. */
export function mesEnTemporadaIntervencion(
  aula: AulaIntervencionMeta | null | undefined,
  year: number,
  month0: number
): boolean {
  if (!esIntervencion(aula)) return true
  const firstDay = `${year}-${String(month0 + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month0 + 1, 0)
  const lastDayStr = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  if (aula?.fecha_inicio && lastDayStr < aula.fecha_inicio) return false
  if (aula?.fecha_fin && firstDay > aula.fecha_fin) return false
  return true
}

/** Campos extra a incluir en selects de aulas. */
export const AULA_TIPO_SELECT = 'tipo, fecha_inicio, fecha_fin, estado_intervencion'
