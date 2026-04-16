/**
 * PDF estilo "Registro de asistencia mensual por aula":
 * columnas de fechas = solo días con al menos un registro de asistencia en el mes.
 */

import {
  getAvailableTableWidth,
  getFontSizeForColumns,
  getLandscapePageDimensions,
} from '@/lib/utils/pdfTableUtils'
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
  const margin = 10
  const mesNombre = MONTHS[monthIndex0] ?? ''
  const metaLine = 2.35

  let y = 9

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`REGISTRO DE ASISTENCIA MENSUAL POR AULA ${year}`, margin, y)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  const rightX = pageWidth - margin
  let ry = y
  doc.text(`N.º proyecto: ${fcpNumero || '—'}`, rightX, ry, { align: 'right' })
  ry += metaLine
  doc.text(`Año: ${year}  ·  Mes: ${mesNombre}`, rightX, ry, { align: 'right' })
  ry += metaLine
  const nombreProyecto = (fcpNombre || '—').trim()
  doc.text(
    nombreProyecto.length > 52
      ? `Proyecto: ${nombreProyecto.slice(0, 49)}…`
      : `Proyecto: ${nombreProyecto}`,
    rightX,
    ry,
    { align: 'right', maxWidth: pageWidth - margin * 2 - 40 }
  )
  ry += metaLine
  doc.text(`Nivel: ${nivel?.trim() || '—'}`, rightX, ry, { align: 'right' })
  ry += metaLine
  doc.text(`Tutor: ${(tutorNombre?.trim() || '—').slice(0, 55)}`, rightX, ry, { align: 'right', maxWidth: pageWidth - margin * 2 - 40 })

  y = Math.max(y + 5, ry + 3)

  doc.setFontSize(6.5)
  doc.setTextColor(75, 75, 75)
  doc.text('P = Presente · F = Faltó · M = Permiso · vacío = sin registro', margin, y)
  doc.setTextColor(0, 0, 0)
  y += 4

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
  const availableWidth = getAvailableTableWidth(doc, margin)
  const fontSize = Math.min(6.5, getFontSizeForColumns(numCols))

  const lastCol = numCols - 1
  const idxFinFechas = 3 + fechasAtendidas.length
  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {}
  const weights: number[] = []
  for (let c = 0; c < numCols; c++) {
    if (c === 0) weights.push(0.28)
    else if (c === 1) weights.push(2.15)
    else if (c === 2) weights.push(0.38)
    else if (c >= 3 && c < idxFinFechas) weights.push(0.18)
    else if (c === lastCol) weights.push(1.55)
    else weights.push(0.2)
  }
  const tw = weights.reduce((a, b) => a + b, 0)
  weights.forEach((w, c) => {
    columnStyles[c] = {
      cellWidth: (w / tw) * availableWidth,
      halign: c === 1 || c === lastCol ? 'left' : 'center',
    }
  })

  const tableOptions = {
    startY: y,
    head: [head1],
    body,
    theme: 'grid' as const,
    tableWidth: availableWidth,
    margin: { left: margin, right: margin },
    headStyles: {
      fontSize: Math.min(fontSize, 6),
      fontStyle: 'bold' as const,
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      cellPadding: 0.45,
    },
    bodyStyles: {
      fontSize: Math.max(4.5, fontSize - 1),
      cellPadding: 0.45,
    },
    styles: {
      fontSize: Math.max(4.5, fontSize - 1),
      cellPadding: 0.45,
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
