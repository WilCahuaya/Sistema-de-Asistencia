import * as XLSX from 'xlsx'

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
  /** Fila 1-based usada como encabezado (si se detectó). */
  filaEncabezado?: number
  /** Resumen de columnas detectadas (índice 0-based → clave lógica). */
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

/** Igual que Excel visual: números enteros sin notación científica; códigos alfanuméricos como texto. */
function cellStr(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    const d = v.getDate().toString().padStart(2, '0')
    const m = (v.getMonth() + 1).toString().padStart(2, '0')
    const y = v.getFullYear()
    return `${d}/${m}/${y}`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) {
      return String(Math.trunc(v))
    }
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

function mergeThreeHeaderRows(a: unknown[], b: unknown[], c: unknown[]): unknown[] {
  return mergeHeaderRows(mergeHeaderRows(a, b), c)
}

function pareceIdBeneficiario(val: unknown): boolean {
  const t = cellStr(val).trim()
  if (!t || t.length > 36) return false
  if (/^PE\d{6,14}$/i.test(t.replace(/\s/g, ''))) return true
  if (/^[A-Z]{2,4}\d{6,16}$/i.test(t.replace(/\s/g, ''))) return true
  if (/^\d{1,12}$/.test(t)) return true
  return false
}

function pareceNombreCuenta(val: unknown): boolean {
  const t = cellStr(val).trim()
  if (t.length < 4 || t.length > 150) return false
  if (/^\d+$/.test(t)) return false
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(t)) return false
  const letters = (t.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length
  return letters >= 3 && letters >= t.replace(/\s/g, '').length * 0.2
}

/**
 * Si el encabezado no coincide con ningún patrón conocido, infiere columnas
 * mirando las primeras filas de datos (misma lógica para distintos layouts).
 */
function inferirColumnasPorMuestra(
  matrix: unknown[][],
  dataStart: number,
  col: Record<string, number>,
  nombreArchivo: string,
  advertencias: string[]
): void {
  const sampleEnd = Math.min(matrix.length, dataStart + 55)
  let width = 0
  for (let r = dataStart; r < sampleEnd; r++) {
    const rw = matrix[r]
    if (rw) width = Math.max(width, rw.length)
  }
  if (width === 0) return

  const scoreId = new Array(width).fill(0)
  const scoreNombre = new Array(width).fill(0)
  let rowsUsed = 0

  for (let r = dataStart; r < sampleEnd; r++) {
    const row = matrix[r]
    if (!row) continue
    const line = textoFila(row)
    if (line.includes('total general')) continue
    if (line.includes('dash') && line.length < 100) continue
    if (!row.some((c) => String(c ?? '').trim() !== '')) continue
    rowsUsed++
    for (let j = 0; j < width; j++) {
      const v = row[j]
      if (pareceIdBeneficiario(v)) scoreId[j]++
      if (pareceNombreCuenta(v)) scoreNombre[j]++
    }
  }

  const thr = Math.max(4, Math.ceil(rowsUsed * 0.22))

  if (col['id_local'] === undefined) {
    let bestJ = -1
    let bestS = 0
    for (let j = 0; j < width; j++) {
      if (scoreId[j] > bestS) {
        bestS = scoreId[j]
        bestJ = j
      }
    }
    if (bestJ >= 0 && bestS >= thr) {
      col['id_local'] = bestJ
      advertencias.push(
        `${nombreArchivo}: encabezado de ID local no reconocido; se eligió la columna ${bestJ + 1} según el aspecto de los datos (${bestS} de ${rowsUsed} filas de muestra).`
      )
    }
  }

  if (col['nombre_cuenta'] === undefined) {
    let bestJ = -1
    let bestS = 0
    const avoid = col['id_local']
    for (let j = 0; j < width; j++) {
      if (j === avoid) continue
      if (scoreNombre[j] > bestS) {
        bestS = scoreNombre[j]
        bestJ = j
      }
    }
    if (bestJ >= 0 && bestS >= thr) {
      col['nombre_cuenta'] = bestJ
      advertencias.push(
        `${nombreArchivo}: encabezado de nombre de cuenta no reconocido; se eligió la columna ${bestJ + 1} según el aspecto de los datos (${bestS} de ${rowsUsed} filas de muestra).`
      )
    }
  }
}

function matrixFromSheet(sheet: XLSX.WorkSheet): unknown[][] {
  return densify(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][])
}

function textoFila(row: unknown[]): string {
  return row.map((c) => norm(c)).join(' | ')
}

/** Heurística inicial si no hay filas DASH antes de los datos. */
function detectarSeccionCarta(matrix: unknown[][], headerRow: number): CartaSeccion {
  const tail = matrix.slice(Math.max(headerRow + 1, matrix.length - 35))
  for (let i = tail.length - 1; i >= 0; i--) {
    const text = textoFila(tail[i])
    if (!text.trim()) continue
    if (text.includes('presentacion') || text.includes('presentación')) return 'presentacion'
    if (text.includes('blp') || text.includes('mycon')) return 'blp'
    if (text.includes('dash')) {
      if (text.includes('present')) return 'presentacion'
      return 'blp'
    }
  }
  return 'blp'
}

/** Fila separadora DASH del reporte (cambia bloque BLP vs presentación). */
function filaDashSeccionCarta(row: unknown[]): CartaSeccion | null {
  const text = textoFila(row)
  if (!text.includes('dash')) return null
  if (text.includes('blp') || text.includes('mycon')) return 'blp'
  if (text.includes('cartas') && text.includes('presentacion')) return 'presentacion'
  if (text.includes('cartas') && text.includes('presentación')) return 'presentacion'
  return null
}

function esFormatoFotos(col: Record<string, number>): boolean {
  if (col['tipo_com'] !== undefined || col['id_global'] !== undefined) return false
  return col['fecha_ultima'] !== undefined && col['estado_act'] !== undefined
}

/**
 * Fragmentos de texto que pueden describir una misma columna cuando el Excel
 * parte el encabezado en celdas adyacentes o en filas distintas (cada archivo en otra posición).
 */
function ventanasCabecera(cells: string[], i: number): string[] {
  const seen = new Set<string>()
  const push = (s: string) => {
    const t = s.trim().replace(/\s+/g, ' ')
    if (t.length > 0 && t.length < 220) seen.add(t)
  }
  const lo = Math.max(0, i - 4)
  const hi = Math.min(cells.length - 1, i + 4)
  for (let a = lo; a <= i; a++) {
    for (let b = i; b <= hi; b++) {
      push(cells.slice(a, b + 1).join(' '))
    }
  }
  return [...seen]
}

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
    /** Código del beneficiario en el reporte (p. ej. «ID Local del Beneficiario»); es el valor que se cruza con `estudiantes.codigo`. */
    setCol('id_local', idx, (s) => {
      if (s.includes('nombre') && s.includes('cuenta')) return false
      if (s.includes('global') && !s.includes('local')) return false
      return (
        (s.includes('id local') && (s.includes('benef') || s.includes('identif'))) ||
        (s.includes('identificador') && s.includes('local') && s.includes('benef')) ||
        (s.includes('codigo') && s.includes('local') && s.includes('benef')) ||
        (s.includes('id') && s.includes('local') && s.includes('benef')) ||
        (s.includes('beneficiary') && s.includes('local') && (s.includes('id') || s.includes('identifier'))) ||
        (s.includes('local') && s.includes('beneficiary') && s.includes('id')) ||
        (s.includes('student') && s.includes('code')) ||
        (s.includes('alumno') && s.includes('codigo')) ||
        (s.includes('member') && s.includes('id') && s.includes('local')) ||
        (s.includes('local') && s.includes('id') && s.includes('benef') && s.length < 120)
      )
    })
    setCol('nombre_cuenta', idx, (s) => {
      if (s.includes('id local') && s.includes('benef')) return false
      if (s.includes('tutor')) return false
      return (
        (s.includes('nombre') && s.includes('cuenta')) ||
        (s.includes('nombre') && (s.includes('beneficiario') || s.includes('estudiante') || s.includes('alumno'))) ||
        (s.includes('account') && s.includes('name')) ||
        (s.includes('display') && s.includes('name')) ||
        (s.includes('nombre') && s.includes('completo')) ||
        (s.includes('full') && s.includes('name'))
      )
    })
    setCol('tipo_com', idx, (s) => {
      if (s.includes('global') && !s.includes('tipo')) return false
      return (
        (s.includes('tipo') && s.includes('comunic')) ||
        (s.includes('tipo') && s.includes('carta')) ||
        (s.includes('tipo') && s.includes('mensaje')) ||
        (s.includes('type') && s.includes('communication')) ||
        (s.includes('communication') && s.includes('type')) ||
        (s.includes('category') && s.includes('communication')) ||
        (s.includes('tipo') && s.includes('letter')) ||
        (s.includes('tipo') && s.includes('registro')) ||
        (s.includes('record') && s.includes('type') && s.includes('comunic')) ||
        (s.includes('tipo') && s.includes('solicitud')) ||
        (s.includes('tipo') && s.includes('documento'))
      )
    })
    setCol('id_global', idx, (s) => {
      return (
        (s.includes('comunicacion') && s.includes('global')) ||
        (s.includes('communication') && s.includes('global')) ||
        (s.includes('id') && s.includes('global') && (s.includes('comunic') || s.length < 60)) ||
        (s.includes('referencia') && s.includes('global')) ||
        (s.includes('global') && s.includes('reference')) ||
        (s.includes('external') && s.includes('id') && s.includes('comunic')) ||
        (s.includes('record') && s.includes('id') && s.includes('comunic')) ||
        (s.includes('communication') && s.includes('id') && s.includes('number')) ||
        (s.includes('numero') && s.includes('comunic') && s.includes('global'))
      )
    })
    setCol('comentarios', idx, (s) => {
      return (
        s === 'comentarios' ||
        (s.includes('comentario') && !s.includes('global') && !s.includes('indicador'))
      )
    })
    setCol('indicador', idx, (s) => s === 'indicador' || (s.includes('indicador') && s.length < 90))
    setCol('fecha_ultima', idx, (s) => {
      return (
        (s.includes('fecha') && s.includes('ultima') && s.includes('foto')) ||
        (s.includes('fecha') && s.includes('foto') && s.includes('ultim')) ||
        (s.includes('last') && s.includes('photo') && s.includes('date'))
      )
    })
    /** Solo columnas de estado de la foto (no «estado de actualización» genérico de cartas/comunicaciones). */
    setCol('estado_act', idx, (s) => {
      return (
        (s.includes('foto') && s.includes('estado') && s.includes('actualiz')) ||
        (s.includes('photo') && s.includes('status') && s.includes('updat')) ||
        (s.includes('foto') && s.includes('estado') && s.includes('subida'))
      )
    })
  }

  if (map['id_local'] === undefined) {
    for (let idx = 0; idx < cells.length; idx++) {
      const s = cells[idx] ?? ''
      if (s.includes('id local') && !s.includes('nombre')) {
        map['id_local'] = idx
        break
      }
      if (s.includes('codigo') && s.includes('local') && !s.includes('nombre')) {
        map['id_local'] = idx
        break
      }
      if (s.includes('beneficiary') && s.includes('local') && !s.includes('nombre')) {
        map['id_local'] = idx
        break
      }
    }
  }

  if (map['nombre_cuenta'] === undefined) {
    for (let idx = 0; idx < cells.length; idx++) {
      const s = cells[idx] ?? ''
      if (s.includes('nombre') && !s.includes('cuenta') && !s.includes('tutor')) {
        map['nombre_cuenta'] = idx
        break
      }
    }
  }

  return map
}

function scoreHeaderRow(row: unknown[]): number {
  if (!row?.length) return 0
  const cells = row.map((c) => norm(c))
  const joined = cells.join('|')
  let score = 0
  const nonEmpty = cells.filter(Boolean).length
  if (nonEmpty < 3) return 0

  const idLocalStrong =
    (joined.includes('id') && joined.includes('local') && joined.includes('benef')) ||
    (joined.includes('identificador') && joined.includes('local')) ||
    (joined.includes('codigo') && joined.includes('local') && joined.includes('benef')) ||
    (joined.includes('beneficiary') && joined.includes('local'))

  const idLocalWeak = joined.includes('id') && joined.includes('local')

  if (idLocalStrong) score += 8
  else if (idLocalWeak) score += 4

  if (cells.some((s) => s.includes('nombre') && s.includes('cuenta'))) score += 4
  if (
    cells.some((s) => s.includes('tipo') && s.includes('comunic')) ||
    cells.some((s) => s.includes('tipo') && s.includes('carta')) ||
    cells.some((s) => s.includes('type') && s.includes('communication'))
  )
    score += 4
  if (cells.some((s) => s.includes('fecha') && s.includes('foto'))) score += 4
  if (cells.some((s) => s.includes('estado') && s.includes('actualiz'))) score += 2

  if (
    (joined.includes('student') && joined.includes('code')) ||
    (joined.includes('alumno') && joined.includes('codigo'))
  )
    score += 5
  if (joined.includes('account') && joined.includes('name')) score += 3

  if (nonEmpty >= 6) score += 1
  return score
}

/** Mejor fila de encabezado en las primeras filas; admite 1–3 filas consecutivas (celdas combinadas o títulos partidos). */
function findBestHeader(matrix: unknown[][]): { rowIndex: number; headerCells: unknown[]; dataStart: number } {
  const limit = Math.min(matrix.length, 280)
  let bestI = -1
  let bestScore = 0
  let bestMerged: unknown[] | null = null
  let bestHeaderRows = 1

  for (let i = 0; i < limit; i++) {
    const row = matrix[i]
    if (!row) continue
    const s1 = scoreHeaderRow(row)
    if (s1 > bestScore) {
      bestScore = s1
      bestI = i
      bestMerged = null
      bestHeaderRows = 1
    }
    if (i + 1 < matrix.length) {
      const merged = mergeHeaderRows(row, matrix[i + 1])
      const s2 = scoreHeaderRow(merged)
      if (s2 > bestScore) {
        bestScore = s2
        bestI = i
        bestMerged = merged
        bestHeaderRows = 2
      }
    }
    if (i + 2 < matrix.length) {
      const merged3 = mergeThreeHeaderRows(row, matrix[i + 1], matrix[i + 2])
      const s3 = scoreHeaderRow(merged3)
      if (s3 > bestScore) {
        bestScore = s3
        bestI = i
        bestMerged = merged3
        bestHeaderRows = 3
      }
    }
  }

  if (bestI < 0 || bestScore < 8) {
    return { rowIndex: -1, headerCells: [], dataStart: -1 }
  }

  const headerCells = bestMerged ?? matrix[bestI]
  const joined = headerCells.map((c) => norm(c)).join('|')
  const tieneIdBenef =
    (joined.includes('local') && (joined.includes('benef') || joined.includes('identif'))) ||
    (joined.includes('codigo') && joined.includes('local') && joined.includes('benef')) ||
    (joined.includes('local') && joined.includes('beneficiary')) ||
    (joined.includes('student') && joined.includes('code')) ||
    (joined.includes('alumno') && joined.includes('codigo'))
  const tieneNombreYCarta =
    ((joined.includes('nombre') && joined.includes('cuenta')) ||
      (joined.includes('account') && joined.includes('name'))) &&
    ((joined.includes('tipo') &&
      (joined.includes('comunic') || joined.includes('carta') || joined.includes('mensaje'))) ||
      (joined.includes('communication') && joined.includes('type')))
  const tieneNombreYFoto =
    joined.includes('nombre') && joined.includes('cuenta') && joined.includes('fecha') && joined.includes('foto')

  if (!tieneIdBenef && !tieneNombreYCarta && !tieneNombreYFoto) {
    return { rowIndex: -1, headerCells: [], dataStart: -1 }
  }

  const dataStart = bestI + bestHeaderRows
  return { rowIndex: bestI, headerCells, dataStart }
}

function esFilaBasuraFooter(row: unknown[], colId: number): boolean {
  const id = norm(row[colId])
  const joined = row.map((c) => norm(c)).join(' ')
  if (!id && joined.length < 3) return true
  // Fila DASH sin ID: separador de bloque (no es fila de datos); la sección se actualiza aparte.
  if (joined.includes('dash') && joined.length < 120 && !id) return true
  if (joined.includes('total general')) return true
  return false
}

function parseSheet(
  matrix: unknown[][],
  headerCells: unknown[],
  dataStart: number,
  nombreArchivo: string,
  advertencias: string[]
): { fotos: FilaFoto[]; cartas: FilaCarta[]; columnasDetectadas: Record<string, number> } {
  const col = mapearIndicesCabecera(headerCells)
  inferirColumnasPorMuestra(matrix, dataStart, col, nombreArchivo, advertencias)
  const columnasDetectadas = { ...col }

  if (col['id_local'] === undefined || col['nombre_cuenta'] === undefined) {
    advertencias.push(`${nombreArchivo}: no se mapearon columnas ID Local / Nombre de cuenta. Revisa el encabezado.`)
    return { fotos: [], cartas: [], columnasDetectadas }
  }

  const modoFoto = esFormatoFotos(col)
  const headerIdxForDash = dataStart > 0 ? dataStart - 1 : 0
  let seccionCarta: CartaSeccion = modoFoto ? 'blp' : detectarSeccionCarta(matrix, headerIdxForDash)

  if (!modoFoto && col['tipo_com'] === undefined && col['id_global'] === undefined) {
    advertencias.push(
      `${nombreArchivo}: no se detectaron columnas «Tipo de Comunicación» ni «ID… Global»; se importarán filas como cartas con esos campos vacíos (sirve para agrupar por tutor).`
    )
  }
  if (!modoFoto && col['tipo_com'] === undefined) {
    advertencias.push(
      `${nombreArchivo}: no se detectó columna «Tipo de Comunicación»; se leerán cartas con ese campo vacío.`
    )
  }
  if (!modoFoto && col['id_global'] === undefined) {
    advertencias.push(
      `${nombreArchivo}: no se detectó columna de ID global de comunicación; se leerán cartas con ese campo vacío.`
    )
  }

  const fotos: FilaFoto[] = []
  const cartas: FilaCarta[] = []

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || row.length === 0) continue

    if (!modoFoto) {
      const dashSec = filaDashSeccionCarta(row)
      if (dashSec !== null) {
        seccionCarta = dashSec
        continue
      }
    }

    if (esFilaBasuraFooter(row, col['id_local'])) continue

    const idLocal = cellStr(row[col['id_local']])
    if (!idLocal) continue
    const nombreCuenta = cellStr(row[col['nombre_cuenta']])

    if (modoFoto) {
      fotos.push({
        idLocal,
        nombreCuenta,
        fechaUltimaFoto:
          col['fecha_ultima'] !== undefined ? valorFechaExcel(row[col['fecha_ultima']]) : '',
        estadoActualizacion: cellStr(row[col['estado_act']]),
      })
    } else {
      cartas.push({
        idLocal,
        nombreCuenta,
        tipoComunicacion:
          col['tipo_com'] !== undefined ? cellStr(row[col['tipo_com']]) : '',
        idComunicacionGlobal:
          col['id_global'] !== undefined ? cellStr(row[col['id_global']]) : '',
        comentarios: col['comentarios'] !== undefined ? cellStr(row[col['comentarios']]) : '',
        indicador: col['indicador'] !== undefined ? cellStr(row[col['indicador']]) : '',
        seccion: seccionCarta,
      })
    }
  }

  return { fotos, cartas, columnasDetectadas }
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
    const { rowIndex, headerCells, dataStart } = findBestHeader(matrix)
    if (rowIndex < 0 || dataStart < 0) {
      advertencias.push(
        `${nombreArchivo} [${sheetName}]: no se detectó fila de encabezado (busca columnas tipo «ID Local…Beneficiario», «Nombre de la cuenta», etc.).`
      )
      continue
    }
    const part = parseSheet(matrix, headerCells, dataStart, `${nombreArchivo} [${sheetName}]`, advertencias)
    fotos = fotos.concat(part.fotos)
    cartas = cartas.concat(part.cartas)
    filaEncabezado = rowIndex + 1
    columnasDetectadas = part.columnasDetectadas
  }

  if (fotos.length === 0 && cartas.length === 0) {
    advertencias.push(
      `${nombreArchivo}: no se leyeron filas de datos. Comprueba que la primera hoja tenga encabezados reconocibles y filas debajo.`
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
