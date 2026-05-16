import * as XLSX from 'xlsx'
import {
  COLUMNA_ID_LOCAL_POR_SUB_REPORTE,
  SUB_REPORTES_ORDEN,
  type TipoSubReporte,
  subReporteDesdeNombreArchivo,
  subReporteDesdeTextoDash,
} from './tiposReporte'

/** Solo dos formatos de fila: fotos de actualización o cartas. */
export type FormatoReporte = 'cartas' | 'fotos'

/** @deprecated Usar subReporte en la fila */
export type CartaSeccion = 'blp' | 'presentacion'

export type FilaFoto = {
  idLocal: string
  nombreCuenta: string
  fechaUltimaFoto: string
  estadoActualizacion: string
  subReporte: TipoSubReporte
}

export type FilaCarta = {
  idLocal: string
  nombreCuenta: string
  tipoComunicacion: string
  idComunicacionGlobal: string
  comentarios: string
  indicador: string
  seccion: CartaSeccion
  subReporte: TipoSubReporte
}

export type ParseoArchivo = {
  nombreArchivo: string
  fotos: FilaFoto[]
  cartas: FilaCarta[]
  advertencias: string[]
  filaEncabezado?: number
  columnasDetectadas?: Record<string, number>
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Repara texto exportado en ISO-8859-1 mal interpretado como UTF-8. */
function repararTextoExcel(s: string): string {
  if (!s || !/[ÃÂ]/.test(s)) return s
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff)
    return new TextDecoder('iso-8859-1').decode(bytes)
  } catch {
    return s
  }
}

export function cellStr(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    const d = v.getDate().toString().padStart(2, '0')
    const m = (v.getMonth() + 1).toString().padStart(2, '0')
    const y = v.getFullYear()
    return `${d}/${m}/${y}`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(Math.trunc(v))
    const t = String(v).trim()
    if (/^\d+\.0+$/.test(t)) return String(Math.trunc(v))
    if (!t.includes('e') && !t.includes('E')) return t
    try {
      return BigInt(Math.trunc(v)).toString()
    } catch {
      return t
    }
  }
  return repararTextoExcel(String(v).trim())
}

function valorFechaExcel(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    const d = v.getDate().toString().padStart(2, '0')
    const m = (v.getMonth() + 1).toString().padStart(2, '0')
    const y = v.getFullYear()
    return `${d}/${m}/${y}`
  }
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const epoch = Date.UTC(1899, 11, 30)
    const ms = epoch + Math.round(v) * 86400000
    const dt = new Date(ms)
    const d = dt.getUTCDate().toString().padStart(2, '0')
    const m = (dt.getUTCMonth() + 1).toString().padStart(2, '0')
    const y = dt.getUTCFullYear()
    return `${d}/${m}/${y}`
  }
  return cellStr(v)
}

function densify(matrix: unknown[][]): unknown[][] {
  let max = 0
  for (const r of matrix) max = Math.max(max, r?.length ?? 0)
  if (max === 0) return matrix
  return matrix.map((r) => {
    const row = [...(r || [])]
    while (row.length < max) row.push('')
    return row
  })
}

function mergeHeaderRows(a: unknown[], b: unknown[]): unknown[] {
  const len = Math.max(a?.length ?? 0, b?.length ?? 0)
  const out: unknown[] = []
  for (let i = 0; i < len; i++) {
    const x = String(a?.[i] ?? '').trim()
    const y = String(b?.[i] ?? '').trim()
    if (x && y && x !== y) out.push(`${x} ${y}`)
    else out.push(x || y || '')
  }
  return out
}

function matrixFromSheet(sheet: XLSX.WorkSheet): unknown[][] {
  return densify(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][])
}

function textoFila(row: unknown[]): string {
  return row.map((c) => norm(c)).join(' | ')
}

/** Fila «DASH: …» define el sub-apartado (tipo de Excel / bloque). */
export function dashDesdeFila(row: unknown[]): TipoSubReporte | null {
  return subReporteDesdeTextoDash(textoFila(row))
}

function formatoDesdeSubReporte(sub: TipoSubReporte): FormatoReporte {
  return sub === 'actualizaciones' ? 'fotos' : 'cartas'
}

function seccionLegacy(sub: TipoSubReporte): CartaSeccion {
  return sub === 'presentacion' ? 'presentacion' : 'blp'
}

function esColumnaPfBeneficiario(s: string): boolean {
  return s.includes('pf del') || (s.startsWith('pf ') && s.includes('benef'))
}

function esColumnaTutor(s: string): boolean {
  return s.includes('tutor') || s.includes('implementador')
}

/** Mapeo estricto por texto de encabezado (solo las columnas del requerimiento). */
function mapearIndicesCabecera(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  const cells = headerRow.map((cell) => norm(cell))
  const usados = new Set<number>()

  const setCol = (key: string, idx: number, pred: (s: string) => boolean) => {
    if (map[key] !== undefined || usados.has(idx)) return
    const s = cells[idx] ?? ''
    if (!s || !pred(s)) return
    map[key] = idx
    usados.add(idx)
  }

  for (let idx = 0; idx < headerRow.length; idx++) {
    const s = cells[idx] ?? ''

    setCol('id_local', idx, (h) => {
      if (esColumnaPfBeneficiario(h) || h.includes('iglesia')) return false
      return (
        h.includes('id local') &&
        h.includes('benef') &&
        !h.includes('iglesia') &&
        !h.includes('nombre')
      )
    })
    setCol('nombre_cuenta', idx, (h) => {
      if (esColumnaPfBeneficiario(h) || esColumnaTutor(h)) return false
      return (h.includes('nombre') && h.includes('cuenta')) || (h.includes('account') && h.includes('name'))
    })
    setCol('tipo_com', idx, (h) => {
      if (h.includes('estatus') || h.includes('registro') || h.includes('plantilla')) return false
      return h.includes('tipo') && h.includes('comunic')
    })
    setCol('id_global', idx, (h) => h.includes('comunicacion') && h.includes('global'))
    setCol('comentarios', idx, (h) => h.includes('comentario') && !h.includes('global'))
    setCol('indicador', idx, (h) => h === 'indicador')
    setCol('fecha_ultima', idx, (h) => h.includes('fecha') && h.includes('foto') && !h.includes('revision'))
    setCol('estado_act', idx, (h) => h.includes('estado') && h.includes('actualiz') && !h.includes('revision'))
  }

  return map
}

function puntajeFilaEncabezado(row: unknown[]): number {
  const cells = row.map((c) => norm(c))
  const joined = cells.join('|')
  if (cells.filter(Boolean).length < 3) return 0
  let score = 0
  if (joined.includes('id') && joined.includes('local') && joined.includes('benef')) score += 8
  else if (joined.includes('id') && joined.includes('local')) score += 4
  if (cells.some((s) => s.includes('nombre') && s.includes('cuenta'))) score += 4
  if (cells.some((s) => s.includes('tipo') && s.includes('comunic'))) score += 3
  if (cells.some((s) => s.includes('fecha') && s.includes('foto'))) score += 3
  return score
}

function esFilaEncabezado(row: unknown[]): boolean {
  if (puntajeFilaEncabezado(row) >= 8) return true
  const joined = row.map((c) => norm(c)).join('|')
  return joined.includes('id') && joined.includes('local') && joined.includes('benef')
}

function celda(row: unknown[], col: Record<string, number>, key: string): string {
  const i = col[key]
  if (i === undefined) return ''
  return cellStr(row[i])
}

function pareceIdBeneficiario(val: unknown): boolean {
  const t = cellStr(val).trim()
  if (!t || t.length > 40) return false
  const n = norm(t)
  if (n.includes('id local') || n.includes('beneficiario') || n.includes('identificador')) return false
  if (n.includes('nombre') && n.includes('cuenta')) return false
  const compact = t.replace(/\s/g, '')
  if (/^PE[A-Z0-9]+$/i.test(compact)) return compact.length >= 11
  if (/^[A-Z]{2,4}\d{6,}$/i.test(compact)) return true
  if (/^\d{4,12}$/.test(t)) return true
  return false
}

/** Cuenta filas con ID válido en la columna fija de cada tipo (archivos sin DASH ni nombre claro). */
function autodetectarSubReporteDesdeMatrix(matrix: unknown[][]): TipoSubReporte | null {
  const scores = Object.fromEntries(SUB_REPORTES_ORDEN.map((s) => [s, 0])) as Record<
    TipoSubReporte,
    number
  >
  for (const row of matrix) {
    if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue
    const line = textoFila(row)
    if (line.includes('dash') || line.includes('total general')) continue
    if (esFilaEncabezado(row)) continue
    for (const sub of SUB_REPORTES_ORDEN) {
      const idx = COLUMNA_ID_LOCAL_POR_SUB_REPORTE[sub]
      if (pareceIdBeneficiario(row[idx])) scores[sub]++
    }
  }
  let mejor: TipoSubReporte | null = null
  let max = 0
  for (const sub of SUB_REPORTES_ORDEN) {
    if (scores[sub] > max) {
      max = scores[sub]
      mejor = sub
    }
  }
  return max > 0 ? mejor : null
}

/**
 * ID Local: columna fija del tipo de reporte (A/B/O); si está vacía, prueba las otras columnas fijas.
 */
function idLocalDesdeFilaConSub(
  row: unknown[],
  subReportePreferido: TipoSubReporte,
  col: Record<string, number>
): { id: string; sub: TipoSubReporte } | null {
  const idxFijo = COLUMNA_ID_LOCAL_POR_SUB_REPORTE[subReportePreferido]
  if (pareceIdBeneficiario(row[idxFijo])) {
    return { id: cellStr(row[idxFijo]), sub: subReportePreferido }
  }
  for (const sub of SUB_REPORTES_ORDEN) {
    if (sub === subReportePreferido) continue
    const idx = COLUMNA_ID_LOCAL_POR_SUB_REPORTE[sub]
    if (pareceIdBeneficiario(row[idx])) return { id: cellStr(row[idx]), sub }
  }
  const hdr = celda(row, col, 'id_local')
  if (pareceIdBeneficiario(hdr)) return { id: hdr, sub: subReportePreferido }
  return null
}

function aplicarColumnaIdLocalFija(col: Record<string, number>, subReporte: TipoSubReporte): void {
  col['id_local'] = COLUMNA_ID_LOCAL_POR_SUB_REPORTE[subReporte]
}

function parseFilaFoto(
  row: unknown[],
  col: Record<string, number>,
  subReporte: TipoSubReporte
): FilaFoto | null {
  const hit = idLocalDesdeFilaConSub(row, subReporte, col)
  if (!hit) return null
  const sub = hit.sub
  return {
    idLocal: hit.id,
    nombreCuenta: celda(row, col, 'nombre_cuenta'),
    fechaUltimaFoto:
      col['fecha_ultima'] !== undefined ? valorFechaExcel(row[col['fecha_ultima']]) : '',
    estadoActualizacion: celda(row, col, 'estado_act'),
    subReporte: sub,
  }
}

function parseFilaCarta(
  row: unknown[],
  col: Record<string, number>,
  subReporte: TipoSubReporte
): FilaCarta | null {
  const hit = idLocalDesdeFilaConSub(row, subReporte, col)
  if (!hit) return null
  const sub = hit.sub
  return {
    idLocal: hit.id,
    nombreCuenta: celda(row, col, 'nombre_cuenta'),
    tipoComunicacion: celda(row, col, 'tipo_com'),
    idComunicacionGlobal: celda(row, col, 'id_global'),
    comentarios: celda(row, col, 'comentarios'),
    indicador: celda(row, col, 'indicador'),
    seccion: seccionLegacy(sub),
    subReporte: sub,
  }
}

/**
 * Recorre la hoja fila a fila:
 * 1) DASH → formato (cartas o fotos); en cartas, también la sección BLP / presentación
 * 2) Encabezado → columnas (pueden variar entre los distintos Excel de cartas)
 * 3) Datos → filas con ID Local del Beneficiario
 */
function parseSheet(
  matrix: unknown[][],
  nombreArchivo: string,
  advertencias: string[]
): {
  fotos: FilaFoto[]
  cartas: FilaCarta[]
  columnasDetectadas?: Record<string, number>
  filaEncabezado?: number
} {
  const fotos: FilaFoto[] = []
  const cartas: FilaCarta[] = []
  const desdeNombre = subReporteDesdeNombreArchivo(nombreArchivo)
  const desdeDatos = autodetectarSubReporteDesdeMatrix(matrix)
  let subReporte: TipoSubReporte = desdeNombre ?? desdeDatos ?? 'blp'
  let col: Record<string, number> = {}
  let filaEncabezado: number | undefined
  let columnasDetectadas: Record<string, number> | undefined

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue

    const dash = dashDesdeFila(row)
    if (dash !== null) {
      subReporte = dash
      aplicarColumnaIdLocalFija(col, subReporte)
      continue
    }

    if (esFilaEncabezado(row)) {
      col = mapearIndicesCabecera(row)
      if (r + 1 < matrix.length) {
        const merged = mergeHeaderRows(row, matrix[r + 1])
        const col2 = mapearIndicesCabecera(merged)
        if (Object.keys(col2).length > Object.keys(col).length) {
          col = col2
          r += 1
        }
      }
      aplicarColumnaIdLocalFija(col, subReporte)
      filaEncabezado = r + 1
      columnasDetectadas = { ...col }
      continue
    }

    aplicarColumnaIdLocalFija(col, subReporte)

    const line = textoFila(row)
    if (line.includes('total general')) continue
    if (esFilaEncabezado(row)) continue

    const formato = formatoDesdeSubReporte(subReporte)
    if (formato === 'fotos') {
      const f = parseFilaFoto(row, col, subReporte)
      if (f) fotos.push(f)
    } else {
      const c = parseFilaCarta(row, col, subReporte)
      if (c) cartas.push(c)
    }
  }

  if (fotos.length === 0 && cartas.length === 0 && filaEncabezado === undefined) {
    advertencias.push(
      `${nombreArchivo}: no se detectó encabezado de datos; el ID local se lee de la columna fija (A/B/O) según el tipo de reporte.`
    )
  }

  return { fotos, cartas, columnasDetectadas, filaEncabezado }
}

export function parsearExcelArchivo(buffer: ArrayBuffer, nombreArchivo: string): ParseoArchivo {
  const advertencias: string[] = []
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  let fotos: FilaFoto[] = []
  let cartas: FilaCarta[] = []
  let filaEncabezado: number | undefined
  let columnasDetectadas: Record<string, number> | undefined

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const matrix = matrixFromSheet(sheet)
    const part = parseSheet(matrix, `${nombreArchivo} [${sheetName}]`, advertencias)
    fotos = fotos.concat(part.fotos)
    cartas = cartas.concat(part.cartas)
    if (part.filaEncabezado) filaEncabezado = part.filaEncabezado
    if (part.columnasDetectadas) columnasDetectadas = part.columnasDetectadas
  }

  if (fotos.length === 0 && cartas.length === 0) {
    advertencias.push(
      `${nombreArchivo}: no se leyeron filas con ID Local del Beneficiario (revise columnas A, B u O según el tipo de reporte).`
    )
  }

  return { nombreArchivo, fotos, cartas, advertencias, filaEncabezado, columnasDetectadas }
}

export function normalizarCodigo(codigo: string): string {
  return String(codigo)
    .trim()
    .replace(/\u00a0/g, ' ')
    .toUpperCase()
}
