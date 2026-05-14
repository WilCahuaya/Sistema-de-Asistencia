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
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function cellStr(v: unknown): string {
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
  return String(v).trim()
}

function matrixFromSheet(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
}

/** Fila “dash” / tipo casi al final: solo para clasificar cartas BLP vs presentación. */
function detectarSeccionCarta(matrix: unknown[][], headerRow: number): CartaSeccion {
  const tail = matrix.slice(Math.max(headerRow + 1, matrix.length - 30))
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

function mapearIndicesCabecera(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((cell, idx) => {
    const n = norm(cell)
    if (n.includes('id local') && n.includes('beneficiario')) map['id_local'] = idx
    else if (n.includes('nombre') && n.includes('cuenta')) map['nombre_cuenta'] = idx
    else if (n.includes('tipo') && n.includes('comunicacion')) map['tipo_com'] = idx
    else if (n.includes('comunicacion') && n.includes('global')) map['id_global'] = idx
    else if (n === 'comentarios' || n.includes('comentario')) map['comentarios'] = idx
    else if (n === 'indicador' || n.includes('indicador')) map['indicador'] = idx
    else if (n.includes('fecha') && n.includes('ultima') && n.includes('foto')) map['fecha_ultima'] = idx
    else if (n.includes('estado') && n.includes('actualiz')) map['estado_act'] = idx
  })
  return map
}

function parseSheet(
  matrix: unknown[][],
  headerIdx: number,
  nombreArchivo: string,
  advertencias: string[]
): { fotos: FilaFoto[]; cartas: FilaCarta[] } {
  const header = matrix[headerIdx] || []
  const col = mapearIndicesCabecera(header)
  if (col['id_local'] === undefined || col['nombre_cuenta'] === undefined) {
    advertencias.push(`${nombreArchivo}: faltan columnas obligatorias (ID Local / Nombre cuenta).`)
    return { fotos: [], cartas: [] }
  }

  const modoFoto = esFormatoFotos(col)
  const seccionCarta: CartaSeccion = modoFoto ? 'blp' : detectarSeccionCarta(matrix, headerIdx)

  const fotos: FilaFoto[] = []
  const cartas: FilaCarta[] = []

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || row.length === 0) continue
    const idLocal = cellStr(row[col['id_local']])
    if (!idLocal) continue
    const nombreCuenta = cellStr(row[col['nombre_cuenta']])

    if (modoFoto) {
      fotos.push({
        idLocal,
        nombreCuenta,
        fechaUltimaFoto: cellStr(row[col['fecha_ultima']]),
        estadoActualizacion: cellStr(row[col['estado_act']]),
      })
    } else {
      if (col['tipo_com'] === undefined || col['id_global'] === undefined) {
        advertencias.push(`${nombreArchivo}: fila ${r + 1} omitida (faltan columnas de carta).`)
        continue
      }
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

  return { fotos, cartas }
}

function findHeaderRow(matrix: unknown[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]
    if (!row) continue
    const joined = row.map((c) => norm(c)).join('|')
    if (joined.includes('id local') && joined.includes('beneficiario')) return i
  }
  return -1
}

export function parsearExcelArchivo(buffer: ArrayBuffer, nombreArchivo: string): ParseoArchivo {
  const advertencias: string[] = []
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  let fotos: FilaFoto[] = []
  let cartas: FilaCarta[] = []

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const matrix = matrixFromSheet(sheet)
    const hi = findHeaderRow(matrix)
    if (hi < 0) continue
    const part = parseSheet(matrix, hi, nombreArchivo, advertencias)
    fotos = fotos.concat(part.fotos)
    cartas = cartas.concat(part.cartas)
  }

  if (fotos.length === 0 && cartas.length === 0) {
    advertencias.push(
      `${nombreArchivo}: no se encontró una fila de encabezado con «ID Local del Beneficiario» en ninguna hoja.`
    )
  }

  return { nombreArchivo, fotos, cartas, advertencias }
}

export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase()
}
