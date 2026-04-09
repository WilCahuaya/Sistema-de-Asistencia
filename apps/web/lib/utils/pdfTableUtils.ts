/**
 * Utilidades para generar tablas PDF que caben en una sola hoja en orientación horizontal.
 * - Orientación landscape automática
 * - Ancho disponible calculado dinámicamente
 * - Distribución proporcional de columnas sin desbordes
 * - Tamaño de fuente ajustado según cantidad de columnas
 * - Salto de línea en texto, columnas numéricas compactas
 * - Evita división horizontal de la tabla
 */

export type ColumnType = 'text' | 'numeric' | 'compact'

export interface PDFTableColumnConfig {
  type: ColumnType
  /** Peso relativo (1 = estándar, 0.5 = compacto, 1.5 = más ancho) */
  weight?: number
  /** Alineación */
  halign?: 'left' | 'center' | 'right'
}

/**
 * Obtiene las dimensiones de página en landscape (A4: 297mm x 210mm)
 */
export function getLandscapePageDimensions(doc: { internal: { pageSize: { getWidth: () => number; getHeight: () => number } } }) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  return { pageWidth: w, pageHeight: h }
}

/**
 * Calcula el ancho disponible para la tabla (pageWidth - márgenes)
 */
export function getAvailableTableWidth(doc: { internal: { pageSize: { getWidth: () => number } } }, marginMm = 15) {
  const pageWidth = doc.internal.pageSize.getWidth()
  return pageWidth - marginMm * 2
}

/**
 * Calcula el tamaño de fuente según cantidad de columnas.
 * Mínimo 5 para legibilidad.
 */
export function getFontSizeForColumns(numCols: number): number {
  if (numCols <= 10) return 8
  if (numCols <= 15) return 7
  if (numCols <= 25) return 6
  return Math.max(5, 7 - Math.floor(numCols / 8))
}

/**
 * Genera columnStyles para jsPDF-autotable con distribución proporcional.
 * Las anchuras suman exactamente availableWidth para evitar desbordes.
 */
export function getProportionalColumnStyles(
  numCols: number,
  availableWidth: number,
  columnConfigs?: PDFTableColumnConfig[]
): Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right'; overflow?: 'linebreak' | 'ellipsize' | 'hidden' }> {
  const configs: PDFTableColumnConfig[] = columnConfigs || Array(numCols).fill(null).map((_, i) => ({
    type: i < 3 ? 'text' : 'compact',
    weight: i < 3 ? 1.2 : 0.6,
    halign: i < 3 ? 'left' as const : 'center' as const,
  }))

  const weights = configs.map((c) => {
    const type = c.type || 'compact'
    return c.weight ?? (type === 'text' ? 1.2 : type === 'numeric' ? 0.8 : 0.6)
  })
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  let widths: number[] = weights.map((w) => (w / totalWeight) * availableWidth)

  const minWidths = configs.map((c) => {
    const t = c.type || 'compact'
    return t === 'compact' ? 6 : t === 'numeric' ? 8 : 12
  })
  widths = widths.map((w, i) => Math.max(minWidths[i], w))
  let total = widths.reduce((a, b) => a + b, 0)
  if (total > availableWidth) {
    const factor = availableWidth / total
    widths = widths.map((w, i) => Math.round(Math.max(minWidths[i], w * factor) * 100) / 100)
    total = widths.reduce((a, b) => a + b, 0)
    widths[0] += Math.round((availableWidth - total) * 100) / 100
  }

  const styles: Record<number, any> = {}
  for (let i = 0; i < numCols; i++) {
    const config = configs[i] || { type: 'compact' as ColumnType }
    styles[i] = {
      cellWidth: Math.round(widths[i] * 100) / 100,
      halign: config.halign ?? (config.type === 'compact' || config.type === 'numeric' ? 'center' : 'left'),
      overflow: config.type === 'text' ? 'linebreak' as const : undefined,
    }
  }
  return styles
}

/**
 * Opciones base para autoTable que garantizan tabla en una sola hoja horizontal
 */
export function getPDFTableBaseOptions(doc: any, startY: number, options: {
  head: string[][]
  body: any[][]
  columnConfigs?: PDFTableColumnConfig[]
  marginMm?: number
  theme?: 'grid' | 'striped' | 'plain'
}) {
  const { head, body, columnConfigs, marginMm = 15, theme = 'grid' } = options
  const numCols = head[0]?.length ?? 0
  const availableWidth = getAvailableTableWidth(doc, marginMm)
  const fontSize = getFontSizeForColumns(numCols)
  const columnStyles = getProportionalColumnStyles(numCols, availableWidth, columnConfigs)

  return {
    startY,
    head,
    body,
    theme,
    tableWidth: availableWidth,
    margin: { left: marginMm, right: marginMm },
    headStyles: {
      fontSize,
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: Math.max(5, fontSize - 0.5),
      cellPadding: 1.5,
    },
    styles: {
      fontSize: Math.max(5, fontSize - 0.5),
      cellPadding: 1.5,
      overflow: 'linebreak',
    },
    columnStyles,
  }
}
