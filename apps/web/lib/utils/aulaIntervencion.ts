/** Tipos y helpers compartidos para aulas regulares e intervenciones. */

export type AulaTipo = 'REGULAR' | 'INTERVENTION'
export type EstadoIntervencion = 'ACTIVA' | 'FINALIZADA' | 'SUSPENDIDA'

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

/** Campos extra a incluir en selects de aulas. */
export const AULA_TIPO_SELECT = 'tipo, fecha_inicio, fecha_fin, estado_intervencion'
