/** Sub-apartados dentro del mensaje de cada tutor (un Excel o bloque DASH por tipo). */
export type TipoSubReporte =
  | 'actualizaciones'
  | 'relacionales'
  | 'blp'
  | 'rehacer'
  | 'presentacion'

export const SUB_REPORTES_ORDEN: TipoSubReporte[] = [
  'actualizaciones',
  'relacionales',
  'blp',
  'rehacer',
  'presentacion',
]

export const TITULO_SUB_REPORTE: Record<TipoSubReporte, string> = {
  actualizaciones: 'Reporte de Actualizaciones',
  relacionales: 'Cartas Relacionales',
  blp: 'Cartas Pendientes BLP',
  rehacer: 'Cartas Observadas para Rehacer',
  presentacion: 'Cartas de Presentación',
}

/**
 * Columna fija «ID Local del Beneficiario» por tipo de reporte (índice 0-based en la hoja).
 * Excel: A=1 → 0, B=2 → 1, O=15 → 14.
 */
export const COLUMNA_ID_LOCAL_POR_SUB_REPORTE: Record<TipoSubReporte, number> = {
  actualizaciones: 0,
  relacionales: 1,
  blp: 14,
  rehacer: 0,
  presentacion: 1,
}

/** Etiqueta legible de la columna ID local (para avisos / depuración). */
export const ETIQUETA_COLUMNA_ID_LOCAL: Record<TipoSubReporte, string> = {
  actualizaciones: 'columna A (1)',
  relacionales: 'columna B (2)',
  blp: 'columna O (15)',
  rehacer: 'columna A (1)',
  presentacion: 'columna B (2)',
}

function normTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Detecta el tipo de reporte por nombre de archivo (cuando no hay fila DASH). */
export function subReporteDesdeNombreArchivo(nombreArchivo: string): TipoSubReporte | null {
  const t = normTexto(nombreArchivo)
  if (t.includes('actualiz') || (t.includes('foto') && !t.includes('carta'))) return 'actualizaciones'
  if (t.includes('relacional')) return 'relacionales'
  if (t.includes('rehacer') || t.includes('observad')) return 'rehacer'
  if (t.includes('presentacion') || t.includes('presentación')) return 'presentacion'
  if (t.includes('blp') || t.includes('pendient') || t.includes('mycon')) return 'blp'
  return null
}

/** Detecta el sub-reporte por fila «DASH: …» en la hoja. */
export function subReporteDesdeTextoDash(texto: string): TipoSubReporte | null {
  const t = normTexto(texto)
  if (!t.includes('dash')) return null
  if (t.includes('foto') || t.includes('actualiz')) return 'actualizaciones'
  if (t.includes('relacional')) return 'relacionales'
  if (t.includes('rehacer') || t.includes('observad')) return 'rehacer'
  if (t.includes('presentacion') || t.includes('presentación') || (t.includes('present') && t.includes('carta'))) {
    return 'presentacion'
  }
  if (t.includes('blp') || t.includes('mycon') || t.includes('pendient')) return 'blp'
  if (t.includes('cartas')) return 'blp'
  return null
}
