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

function matrixFromSheet(sheet: XLSX.WorkSheet): unknown[][] {
  return densify(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][])
}

function detectarSeccionCarta(matrix: unknown[][], headerRow: number): CartaSeccion {
  const tail = matrix.slice(Math.max(headerRow + 1, matrix.length - 35))
  for (let i = tail.length - 1; i >= 0; i--) {
    const text = tail[i].map((c) => norm(c)).join(' | ')
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

function esFormatoFotos(col: Record<string, number>): boolean {
  return col['fecha_ultima'] !== undefined && col['estado_act'] !== undefined
}

function ventanasCabecera(cells: string[], i: number): string[] {
  const a = cells[i] ?? ''
  const b = cells[i + 1] ?? ''
  const c = cells[i + 2] ?? ''
  const ab = `${a} ${b}`.trim()
  const abc = `${a} ${b} ${c}`.trim()
  return [a, ab, abc].filter((s) => s.length > 0)
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
    setCol('id_local', idx, (s) => {
      if (s.includes('nombre') && s.includes('cuenta')) return false
      return (
        (s.includes('id local') && (s.includes('benef') || s.includes('identif'))) ||
        (s.includes('identificador') && s.includes('local') && s.includes('benef')) ||
        (s.includes('codigo') && s.includes('local') && s.includes('benef')) ||
        (s.includes('id') && s.includes('local') && s.includes('benef'))
      )
    })
    setCol('nombre_cuenta', idx, (s) => {
      if (s.includes('id local') && s.includes('benef')) return false
      if (s.includes('tutor')) return false
      return (
        (s.includes('nombre') && s.includes('cuenta')) ||
        (s.includes('nombre') && (s.includes('beneficiario') || s.includes('estudiante') || s.includes('alumno')))
      )
    })
    setCol('tipo_com', idx, (s) => {
      if (s.includes('global') && !s.includes('tipo')) return false
      return (s.includes('tipo') && s.includes('comunic')) || (s.includes('tipo') && s.includes('carta'))
    })
    setCol('id_global', idx, (s) => {
      return (
        (s.includes('comunicacion') && s.includes('global')) ||
        (s.includes('id') && s.includes('global') && (s.includes('comunic') || s.length < 60)) ||
        (s.includes('referencia') && s.includes('global'))
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
        (s.includes('fecha') && s.includes('foto') && s.includes('ultim'))
      )
    })
    setCol('estado_act', idx, (s) => {
      return (
        (s.includes('estado') && s.includes('actualiz')) ||
        (s.includes('estado') && s.includes('foto') && s.includes('actualiz'))
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
    (joined.includes('codigo') && joined.includes('local') && joined.includes('benef'))

  const idLocalWeak = joined.includes('id') && joined.includes('local')

  if (idLocalStrong) score += 8
  else if (idLocalWeak) score += 4

  if (cells.some((s) => s.includes('nombre') && s.includes('cuenta'))) score += 4
  if (cells.some((s) => s.includes('tipo') && s.includes('comunic'))) score += 4
  if (cells.some((s) => s.includes('fecha') && s.includes('foto'))) score += 4
  if (cells.some((s) => s.includes('estado') && s.includes('actualiz'))) score += 2

  if (nonEmpty >= 6) score += 1
  return score
}

/** Mejor fila de encabezado en las primeras filas; admite encabezado en dos filas consecutivas (celdas combinadas). */
function findBestHeader(matrix: unknown[][]): { rowIndex: number; headerCells: unknown[]; dataStart: number } {
  const limit = Math.min(matrix.length, 150)
  let bestI = -1
  let bestScore = 0
  let bestMerged: unknown[] | null = null

  for (let i = 0; i < limit; i++) {
    const row = matrix[i]
    if (!row) continue
    const s1 = scoreHeaderRow(row)
    if (s1 > bestScore) {
      bestScore = s1
      bestI = i
      bestMerged = null
    }
    if (i + 1 < matrix.length) {
      const merged = mergeHeaderRows(row, matrix[i + 1])
      const s2 = scoreHeaderRow(merged)
      if (s2 > bestScore) {
        bestScore = s2
        bestI = i
        bestMerged = merged
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
    (joined.includes('local') && joined.includes('beneficiary'))
  const tieneNombreYCarta =
    joined.includes('nombre') && joined.includes('cuenta') && joined.includes('tipo') && joined.includes('comunic')
  const tieneNombreYFoto =
    joined.includes('nombre') && joined.includes('cuenta') && joined.includes('fecha') && joined.includes('foto')

  if (!tieneIdBenef && !tieneNombreYCarta && !tieneNombreYFoto) {
    return { rowIndex: -1, headerCells: [], dataStart: -1 }
  }

  const dataStart = bestMerged != null ? bestI + 2 : bestI + 1
  return { rowIndex: bestI, headerCells, dataStart }
}

function esFilaBasuraFooter(row: unknown[], colId: number): boolean {
  const id = norm(row[colId])
  const joined = row.map((c) => norm(c)).join(' ')
  if (!id && joined.length < 3) return true
  if (joined.includes('dash') && joined.length < 80) return true
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
  const columnasDetectadas = { ...col }

  if (col['id_local'] === undefined || col['nombre_cuenta'] === undefined) {
    advertencias.push(`${nombreArchivo}: no se mapearon columnas ID Local / Nombre de cuenta. Revisa el encabezado.`)
    return { fotos: [], cartas: [], columnasDetectadas }
  }

  const modoFoto = esFormatoFotos(col)
  const headerIdxForDash = dataStart > 0 ? dataStart - 1 : 0
  const seccionCarta: CartaSeccion = modoFoto ? 'blp' : detectarSeccionCarta(matrix, headerIdxForDash)

  if (!modoFoto && (col['tipo_com'] === undefined || col['id_global'] === undefined)) {
    advertencias.push(
      `${nombreArchivo}: faltan columnas «Tipo de Comunicación» o «Comunicación: ID… Global» en el encabezado; no se pueden leer filas de cartas.`
    )
    return { fotos: [], cartas: [], columnasDetectadas }
  }

  const fotos: FilaFoto[] = []
  const cartas: FilaCarta[] = []

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || row.length === 0) continue
    if (esFilaBasuraFooter(row, col['id_local'])) continue

    const idLocal = cellStr(row[col['id_local']])
    if (!idLocal) continue
    const nombreCuenta = cellStr(row[col['nombre_cuenta']])

    if (modoFoto) {
      fotos.push({
        idLocal,
        nombreCuenta,
        fechaUltimaFoto: valorFechaExcel(row[col['fecha_ultima']]),
        estadoActualizacion: cellStr(row[col['estado_act']]),
      })
    } else {
      cartas.push({
        idLocal,
        nombreCuenta,
        tipoComunicacion: cellStr(row[col['tipo_com']]),
        idComunicacionGlobal: cellStr(row[col['id_global']]),
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
