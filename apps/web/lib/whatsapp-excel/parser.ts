import * as XLSX from 'xlsx'

/** Solo dos formatos de reporte: cartas (varios Excel de comunicaciones) y fotos de actualización. */
export type FormatoReporte = 'cartas' | 'fotos'

/** Dentro del formato cartas, el DASH indica el bloque BLP o de presentación. */
export type CartaSeccion = 'blp' | 'presentacion'

export type FilaFoto = {
  idLocal: string
  nombreCuenta: string
  fechaUltimaFoto: string
  estadoActualizacion: string
}

export type FilaCarta = {
  idLocal: string
  nombreCuenta: string
  tipoComunicacion: string
  idComunicacionGlobal: string
  comentarios: string
  indicador: string
  seccion: CartaSeccion
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
  return String(v).trim()
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

/**
 * Fila «DASH: …»:
 * - fotos → formato fotos de actualización (un tipo de Excel)
 * - cartas → formato cartas; la sección BLP o presentación viene en el mismo DASH
 */
export function dashDesdeFila(row: unknown[]): { formato: FormatoReporte; seccion?: CartaSeccion } | null {
  const t = textoFila(row)
  if (!t.includes('dash')) return null
  if (t.includes('foto')) return { formato: 'fotos' }
  const seccion: CartaSeccion =
    t.includes('presentacion') || t.includes('presentación') || (t.includes('cartas') && t.includes('present'))
      ? 'presentacion'
      : 'blp'
  return { formato: 'cartas', seccion }
}

function ventanasCabecera(cells: string[], i: number): string[] {
  const seen = new Set<string>()
  const push = (s: string) => {
    const t = s.trim().replace(/\s+/g, ' ')
    if (t.length > 0 && t.length < 220) seen.add(t)
  }
  const lo = Math.max(0, i - 4)
  const hi = Math.min(cells.length - 1, i + 4)
  for (let a = lo; a <= i; a++) {
    for (let b = i; b <= hi; b++) push(cells.slice(a, b + 1).join(' '))
  }
  return [...seen]
}

/** Mapeo de columnas (los distintos Excel de cartas pueden traerlas en otra posición). */
function mapearIndicesCabecera(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  const cells = headerRow.map((cell) => norm(cell))

  const setCol = (key: string, idx: number, pred: (s: string) => boolean) => {
    if (map[key] !== undefined) return
    for (const w of ventanasCabecera(cells, idx)) {
      if (pred(w)) {
        map[key] = idx
        return
      }
    }
  }

  for (let idx = 0; idx < headerRow.length; idx++) {
    setCol('id_local', idx, (s) => {
      if (s.includes('nombre') && s.includes('cuenta')) return false
      if (s.includes('global') && !s.includes('local')) return false
      return (
        (s.includes('id local') && (s.includes('benef') || s.includes('identif'))) ||
        (s.includes('id') && s.includes('local') && s.includes('benef')) ||
        (s.includes('codigo') && s.includes('local') && s.includes('benef')) ||
        (s.includes('beneficiary') && s.includes('local'))
      )
    })
    setCol('nombre_cuenta', idx, (s) => {
      if (s.includes('id local') && s.includes('benef')) return false
      if (s.includes('tutor')) return false
      return (
        (s.includes('nombre') && s.includes('cuenta')) ||
        (s.includes('nombre') && (s.includes('beneficiario') || s.includes('estudiante'))) ||
        (s.includes('account') && s.includes('name'))
      )
    })
    setCol('tipo_com', idx, (s) => {
      if (s.includes('global') && !s.includes('tipo')) return false
      return (s.includes('tipo') && s.includes('comunic')) || (s.includes('tipo') && s.includes('carta'))
    })
    setCol('id_global', idx, (s) => {
      return (
        (s.includes('comunicacion') && s.includes('global')) ||
        (s.includes('id') && s.includes('global') && s.includes('comunic'))
      )
    })
    setCol('comentarios', idx, (s) => s.includes('comentario') && !s.includes('global'))
    setCol('indicador', idx, (s) => s.includes('indicador') && s.length < 90)
    setCol('fecha_ultima', idx, (s) => s.includes('fecha') && s.includes('foto'))
    setCol('estado_act', idx, (s) => s.includes('foto') && s.includes('estado') && s.includes('actualiz'))
  }

  if (map['id_local'] === undefined) {
    for (let idx = 0; idx < cells.length; idx++) {
      const s = cells[idx] ?? ''
      if (s.includes('id local') && !s.includes('nombre')) {
        map['id_local'] = idx
        break
      }
    }
  }
  if (map['nombre_cuenta'] === undefined) {
    for (let idx = 0; idx < cells.length; idx++) {
      const s = cells[idx] ?? ''
      if (s.includes('nombre') && !s.includes('tutor') && !s.includes('id local')) {
        map['nombre_cuenta'] = idx
        break
      }
    }
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
  return puntajeFilaEncabezado(row) >= 8
}

function celda(row: unknown[], col: Record<string, number>, key: string): string {
  const i = col[key]
  if (i === undefined) return ''
  return cellStr(row[i])
}

/** Sin DASH previo: fotos si el encabezado es de actualización de foto; si no, cartas. */
function inferirFormatoDesdeColumnas(col: Record<string, number>): FormatoReporte {
  if (col['fecha_ultima'] !== undefined && col['estado_act'] !== undefined) return 'fotos'
  if (col['tipo_com'] !== undefined || col['id_global'] !== undefined) return 'cartas'
  if (col['fecha_ultima'] !== undefined || col['estado_act'] !== undefined) return 'fotos'
  return 'cartas'
}

function parseFilaFoto(row: unknown[], col: Record<string, number>): FilaFoto | null {
  const idLocal = celda(row, col, 'id_local')
  if (!idLocal) return null
  return {
    idLocal,
    nombreCuenta: celda(row, col, 'nombre_cuenta'),
    fechaUltimaFoto:
      col['fecha_ultima'] !== undefined ? valorFechaExcel(row[col['fecha_ultima']]) : '',
    estadoActualizacion: celda(row, col, 'estado_act'),
  }
}

function parseFilaCarta(row: unknown[], col: Record<string, number>, seccion: CartaSeccion): FilaCarta | null {
  const idLocal = celda(row, col, 'id_local')
  if (!idLocal) return null
  return {
    idLocal,
    nombreCuenta: celda(row, col, 'nombre_cuenta'),
    tipoComunicacion: celda(row, col, 'tipo_com'),
    idComunicacionGlobal: celda(row, col, 'id_global'),
    comentarios: celda(row, col, 'comentarios'),
    indicador: celda(row, col, 'indicador'),
    seccion,
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
  let formato: FormatoReporte | null = null
  let seccionCarta: CartaSeccion = 'blp'
  let col: Record<string, number> = {}
  let filaEncabezado: number | undefined
  let columnasDetectadas: Record<string, number> | undefined

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue

    const dash = dashDesdeFila(row)
    if (dash !== null) {
      formato = dash.formato
      if (dash.seccion) seccionCarta = dash.seccion
      continue
    }

    if (esFilaEncabezado(row)) {
      col = mapearIndicesCabecera(row)
      if (col['id_local'] === undefined && r + 1 < matrix.length) {
        const merged = mergeHeaderRows(row, matrix[r + 1])
        const col2 = mapearIndicesCabecera(merged)
        if (col2['id_local'] !== undefined) {
          col = col2
          r += 1
        }
      }
      if (col['id_local'] !== undefined) {
        filaEncabezado = r + 1
        columnasDetectadas = { ...col }
        if (formato === null) formato = inferirFormatoDesdeColumnas(col)
      }
      continue
    }

    if (col['id_local'] === undefined) continue
    if (formato === null) formato = inferirFormatoDesdeColumnas(col)

    const line = textoFila(row)
    if (line.includes('total general')) continue

    if (formato === 'fotos') {
      const f = parseFilaFoto(row, col)
      if (f) fotos.push(f)
    } else {
      const c = parseFilaCarta(row, col, seccionCarta)
      if (c) cartas.push(c)
    }
  }

  if (col['id_local'] === undefined) {
    advertencias.push(
      `${nombreArchivo}: no se encontró encabezado con «ID Local del Beneficiario».`
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
    advertencias.push(`${nombreArchivo}: no se leyeron filas con ID Local del Beneficiario.`)
  }

  return { nombreArchivo, fotos, cartas, advertencias, filaEncabezado, columnasDetectadas }
}

export function normalizarCodigo(codigo: string): string {
  return String(codigo)
    .trim()
    .replace(/\u00a0/g, ' ')
    .toUpperCase()
}
