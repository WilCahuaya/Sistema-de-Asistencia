/**
 * PDF estilo "Registro de asistencia mensual por aula":
 * columnas de fechas = solo días con al menos un registro de asistencia en el mes.
 */

import {
  getAvailableTableWidth,
  getFontSizeForColumns,
  getLandscapePageDimensions,
} from '@/lib/utils/pdfTableUtils'

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
  aulaNombre: string
  aulaCodigo?: string | null
  tutorNombre: string | null
  /** Si no hay en BD, se muestra "—" */
  nivel?: string | null
  turno?: string | null
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
    aulaCodigo,
    tutorNombre,
    nivel,
    turno,
    estudiantes,
    fechasAtendidas,
    getEstado,
  } = params

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
  const margin = 12
  const mesNombre = MONTHS[monthIndex0] ?? ''

  let y = 10

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`REGISTRO DE ASISTENCIA MENSUAL POR AULA ${year}`, margin, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const rightX = pageWidth - margin
  let ry = y
  doc.text(`Número del proyecto: ${fcpNumero || '—'}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(`Año: ${year}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(`Mes: ${mesNombre}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(`Nombre del proyecto: ${fcpNombre || '—'}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(`Nivel: ${nivel?.trim() || '—'}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(`Tutor: ${tutorNombre?.trim() || '—'}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(`Turno: ${turno?.trim() || '—'}`, rightX, ry, { align: 'right' })
  ry += 3.5
  doc.text(
    `Aula: ${aulaCodigo ? `${aulaNombre} (${aulaCodigo})` : aulaNombre}`,
    rightX,
    ry,
    { align: 'right' }
  )

  y = Math.max(y + 6, ry + 4)

  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('P = Presente   F = Faltó   M = Permiso   (vacío = sin registro)', margin, y)
  doc.setTextColor(0, 0, 0)
  y += 5

  const head1: string[] = [
    'N°',
    'APELLIDOS Y NOMBRES DEL NIÑO',
    'CÓDIGO',
    ...fechasAtendidas.map(dayFromFecha),
    'Serv. transporte',
    'Currículo',
    'Visita hogar',
    'Control salud',
  ]

  const body: string[][] = estudiantes.map((est, i) => {
    const row: string[] = [
      String(i + 1),
      nombreParaFormulario(est.nombre_completo),
      est.codigo,
      ...fechasAtendidas.map((f) => estadoCelda(getEstado(est.id, f))),
      '',
      '',
      '',
      '',
    ]
    return row
  })

  const numCols = head1.length
  const availableWidth = getAvailableTableWidth(doc, margin)
  const fontSize = getFontSizeForColumns(numCols)

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {}
  const weights: number[] = []
  for (let c = 0; c < numCols; c++) {
    if (c === 0) weights.push(0.35)
    else if (c === 1) weights.push(2.2)
    else if (c === 2) weights.push(0.45)
    else if (c >= 3 && c < 3 + fechasAtendidas.length) weights.push(0.28)
    else weights.push(0.5)
  }
  const tw = weights.reduce((a, b) => a + b, 0)
  weights.forEach((w, c) => {
    columnStyles[c] = {
      cellWidth: (w / tw) * availableWidth,
      halign: c === 1 ? 'left' : 'center',
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
      fontSize: Math.min(fontSize, 7),
      fontStyle: 'bold' as const,
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      cellPadding: 1,
    },
    bodyStyles: {
      fontSize: Math.max(5, fontSize - 0.5),
      cellPadding: 1,
    },
    styles: {
      fontSize: Math.max(5, fontSize - 0.5),
      cellPadding: 1,
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
