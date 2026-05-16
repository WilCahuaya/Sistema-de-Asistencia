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
