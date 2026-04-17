/**
 * PDF estilo "Registro de asistencia mensual por aula":
 * columnas de fechas = solo días con al menos un registro de asistencia en el mes.
 * Encabezado alineado a los demás reportes; anchos de columna según contenido.
 */

import {
  getAvailableTableWidth,
  getLandscapePageDimensions,
} from '@/lib/utils/pdfTableUtils'
import {
  getPDFHeaderStyles,
  getPDFBodyStyles,
  getPDFAlternateRowStyles,
} from '@/lib/utils/exportStyles'
import { sortByNombreCompleto } from '@/lib/utils/sortEstudiantes'

/** Extrae fechas YYYY-MM-DD únicas del mes a partir de claves `estudianteId_fecha`. */
export function collectFechasAtendidasMes(
  asistenciasKeys: Iterable<string>,
  year: number,
  monthIndex0: number
): string[] {
  const ym = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
  const set = new Set<string>()
  for (const key of asistenciasKeys) {
    const m = key.match(/_(\d{4}-\d{2}-\d{2})$/)
    if (!m) continue
    const fecha = m[1]
    if (fecha.startsWith(`${ym}-`)) set.add(fecha)
  }
  return [...set].sort()
}

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

export interface RegistroAsistenciaMensualPdfParams {
  fcpNumero: string
  fcpNombre: string
  year: number
  /** 0-11 */
  monthIndex0: number
  /** Solo para nombre de archivo al guardar */
  aulaNombre: string
  tutorNombre: string | null
  /** Si no hay en BD, se muestra "—" */
  nivel?: string | null
  estudiantes: Array<{ id: string; codigo: string; nombre_completo: string }>
  /** YYYY-MM-DD ordenadas (solo días con ≥1 asistencia registrada) */
  fechasAtendidas: string[]
  getEstado: (estudianteId: string, fecha: string) => 'presente' | 'falto' | 'permiso' | null | undefined
}

function nombreParaFormulario(nombre: string): string {
  const t = nombre.trim()
  if (!t) return ''
  if (t.includes(',')) return t.toUpperCase()
  return t.toUpperCase()
}

function estadoCelda(e: 'presente' | 'falto' | 'permiso' | null | undefined): string {
  if (!e) return ''
  if (e === 'presente') return 'P'
  if (e === 'falto') return 'F'
  return 'M'
}

function dayFromFecha(fecha: string): string {
  const parts = fecha.split('-')
  if (parts.length !== 3) return fecha
  return String(parseInt(parts[2], 10))
}

function safeFileSegment(s: string): string {
  return s.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'aula'
}

type JsPdfLike = {
  setFont: (face: string, style: string) => void
  setFontSize: (size: number) => void
  getTextWidth: (text: string) => number
  splitTextToSize: (text: string, maxWidth: number) => string[]
}

/** Ancho máximo en mm de un conjunto de textos con la fuente indicada. */
function maxTextWidthMm(
  doc: JsPdfLike,
  texts: string[],
  fontSize: number,
  fontStyle: 'normal' | 'bold'
): number {
  doc.setFont('helvetica', fontStyle)
  doc.setFontSize(fontSize)
  let m = 0
  for (const t of texts) {
    const s = t ?? ''
    if (!s) continue
    const w = doc.getTextWidth(s)
    if (w > m) m = w
  }
  return m + 3.5
}

export async function downloadRegistroAsistenciaMensualPdf(
  params: RegistroAsistenciaMensualPdfParams
): Promise<void> {
  const {
    fcpNumero,
    fcpNombre,
    year,
    monthIndex0,
    aulaNombre,
    tutorNombre,
    nivel,
    estudiantes,
    fechasAtendidas,
    getEstado,
  } = params

  const estudiantesOrdenados = sortByNombreCompleto(estudiantes)

  const jsPDF = (await import('jspdf')).default
  const autotableModule = await import('jspdf-autotable')

  let autoTable: (options: any) => void
  if (typeof (autotableModule as any).autoTable === 'function') {
    autoTable = (autotableModule as any).autoTable
  } else if (typeof (autotableModule as any).default === 'function') {
    autoTable = (autotableModule as any).default
  } else {
    throw new Error('jspdf-autotable no disponible')
  }

  if ((autotableModule as any).applyPlugin && typeof (autotableModule as any).applyPlugin === 'function') {
    ;(autotableModule as any).applyPlugin(jsPDF)
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const { pageWidth } = getLandscapePageDimensions(doc)
  const margin = 15
  const mesNombre = MONTHS[monthIndex0] ?? ''
  const col1 = margin
  const col2 = pageWidth / 3 + 10
  const col3 = (pageWidth / 3) * 2 + 10
  const textMaxFull = pageWidth - 2 * margin

  let y = 12

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`REGISTRO DE ASISTENCIA MENSUAL POR AULA ${year}`, pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`N.º PROYECTO: ${fcpNumero || '—'}`, col1, y)
  doc.text(`AÑO: ${year}`, col2, y)
  doc.text(`MES: ${mesNombre}`, col3, y)
  y += 4

  const proyectoFull = `NOMBRE DEL PROYECTO: ${(fcpNombre || '—').trim()}`
  const proyectoLines = doc.splitTextToSize(proyectoFull, textMaxFull)
  proyectoLines.forEach((line) => {
    doc.text(line, col1, y)
    y += 4
  })

  doc.text(`NIVEL: ${nivel?.trim() || '—'}`, col1, y)
  const tutorFull = `TUTOR: ${tutorNombre?.trim() || '—'}`
  const tutorLines = doc.splitTextToSize(tutorFull, pageWidth - col2 - margin)
  let ty = y
  tutorLines.forEach((line) => {
    doc.text(line, col2, ty)
    ty += 4
  })
  y = Math.max(y + 4, ty)

  doc.setFontSize(7)
  doc.setTextColor(85, 85, 85)
  doc.text('Leyenda: P = Presente · F = Faltó · M = Permiso · vacío = sin registro', col1, y)
  doc.setTextColor(0, 0, 0)
  y += 6

  const head1: string[] = [
    'N°',
    'APELLIDOS Y NOMBRES',
    'COD.',
    ...fechasAtendidas.map(dayFromFecha),
    'OBSERVACIONES',
  ]

  const body: string[][] = estudiantesOrdenados.map((est, i) => {
    const row: string[] = [
      String(i + 1),
      nombreParaFormulario(est.nombre_completo),
      est.codigo,
      ...fechasAtendidas.map((f) => estadoCelda(getEstado(est.id, f))),
      '',
    ]
    return row
  })

  const numCols = head1.length
  const lastCol = numCols - 1
  const idxFinFechas = 3 + fechasAtendidas.length
  const headFs = 8
  const bodyFs = 7

  const d = doc as unknown as JsPdfLike
  const rawWidths: number[] = []

  for (let c = 0; c < numCols; c++) {
    const headText = head1[c] ?? ''
    const colBodies = body.map((row) => String(row[c] ?? ''))
    const samples = [headText, ...colBodies]
    const headW = maxTextWidthMm(d, [headText], headFs, 'bold')
    const bodyW = maxTextWidthMm(d, colBodies, bodyFs, 'normal')
    rawWidths.push(Math.max(headW, bodyW))
  }

  for (let c = 0; c < numCols; c++) {
    const minW =
      c === 0
        ? 9
        : c === 1
          ? 34
          : c === 2
            ? 12
            : c >= 3 && c < idxFinFechas
              ? 6
              : c === lastCol
                ? 32
                : 8
    rawWidths[c] = Math.max(rawWidths[c], minW)
  }

  const availableWidth = getAvailableTableWidth(doc, margin)
  let sumW = rawWidths.reduce((a, b) => a + b, 0)
  if (sumW > availableWidth) {
    const scale = availableWidth / sumW
    for (let c = 0; c < numCols; c++) rawWidths[c] *= scale
  } else if (sumW < availableWidth) {
    const extra = availableWidth - sumW
    rawWidths[1] += extra * 0.42
    rawWidths[lastCol] += extra * 0.38
    for (let c = 0; c < numCols; c++) {
      if (c === 1 || c === lastCol) continue
      rawWidths[c] += (extra * 0.2) / Math.max(1, numCols - 2)
    }
  }

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {}
  for (let c = 0; c < numCols; c++) {
    columnStyles[c] = {
      cellWidth: rawWidths[c],
      halign: c === 1 || c === lastCol ? 'left' : 'center',
    }
  }

  const headBase = getPDFHeaderStyles()
  const bodyBase = getPDFBodyStyles()
  const altBase = getPDFAlternateRowStyles()

  const tableOptions = {
    startY: y,
    head: [head1],
    body,
    theme: 'grid' as const,
    tableWidth: rawWidths.reduce((a, b) => a + b, 0),
    margin: { left: margin, right: margin },
    headStyles: {
      ...headBase,
      fontSize: Math.min(8, headBase.fontSize ?? 9),
      cellPadding: 2,
    },
    bodyStyles: {
      ...bodyBase,
      fontSize: Math.min(7.5, bodyBase.fontSize ?? 9),
      cellPadding: 1.8,
    },
    alternateRowStyles: altBase,
    styles: {
      ...bodyBase,
      fontSize: Math.min(7.5, bodyBase.fontSize ?? 9),
      cellPadding: 1.8,
      overflow: 'linebreak' as const,
      valign: 'middle' as const,
    },
    columnStyles,
  }

  if (typeof (doc as any).autoTable === 'function') {
    ;(doc as any).autoTable(tableOptions)
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions)
  } else {
    throw new Error('autoTable no está disponible')
  }

  const fname = `registro-asistencia-${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${safeFileSegment(aulaNombre)}.pdf`
  doc.save(fname)
}
