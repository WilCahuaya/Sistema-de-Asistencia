import type { FilaCarta, FilaFoto } from './parser'
import { normalizarCodigo } from './parser'

export type ItemAgrupado =
  | { tipo: 'foto'; fila: FilaFoto }
  | { tipo: 'carta'; fila: FilaCarta }

export type MensajePorTutor = {
  tutorNombre: string
  tutorKey: string
  mensaje: string
  fotos: number
  cartasBlp: number
  cartasPresentacion: number
}

function lineaFoto(f: FilaFoto): string {
  return `📸  ${f.nombreCuenta} – ${f.idLocal} – ${f.fechaUltimaFoto} – ${f.estadoActualizacion}`
}

function lineaCarta(f: FilaCarta): string {
  return `📝 ${f.nombreCuenta} – ${f.idLocal} - ${f.tipoComunicacion} - ${f.idComunicacionGlobal} - ${f.comentarios} - ${f.indicador}`
}

function bloque(titulo: string, lineas: string[]): string {
  if (lineas.length === 0) return `${titulo}\n\n`
  return `${titulo}\n\n${lineas.join('\n')}\n\n`
}

export function construirMensajeTutor(
  tutorNombre: string,
  fotos: FilaFoto[],
  cartasBlp: FilaCarta[],
  cartasPres: FilaCarta[]
): string {
  const partes: string[] = []
  partes.push(`Para ${tutorNombre}:\n`)
  partes.push(bloque('Fotos para actualizar:', fotos.map(lineaFoto)))
  partes.push(bloque('Cartas Pendientes BLP (Myconnet):', cartasBlp.map(lineaCarta)))
  partes.push(bloque('Cartas de Presentación:', cartasPres.map(lineaCarta)))
  return partes.join('').trimEnd()
}

export function agruparPorTutor(
  items: Array<{ codigo: string; items: ItemAgrupado[] }>,
  codigoATutor: Map<string, string>
): Map<string, { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }> {
  const map = new Map<string, { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }>()

  for (const { codigo, items: its } of items) {
    const key = normalizarCodigo(codigo)
    const nombreTutor = codigoATutor.has(key)
      ? codigoATutor.get(key)!
      : 'Sin asignación en sistema'
    if (!map.has(nombreTutor)) {
      map.set(nombreTutor, { nombre: nombreTutor, fotos: [], blp: [], pres: [] })
    }
    const bucket = map.get(nombreTutor)!
    for (const it of its) {
      if (it.tipo === 'foto') bucket.fotos.push(it.fila)
      else if (it.fila.seccion === 'blp') bucket.blp.push(it.fila)
      else bucket.pres.push(it.fila)
    }
  }

  return map
}

/** Expande filas a pares (código, item) para agrupar. */
export function filasAItemsPorCodigo(
  fotos: FilaFoto[],
  cartas: FilaCarta[]
): Array<{ codigo: string; items: ItemAgrupado[] }> {
  const byCode = new Map<string, ItemAgrupado[]>()
  for (const f of fotos) {
    const k = normalizarCodigo(f.idLocal)
    if (!byCode.has(k)) byCode.set(k, [])
    byCode.get(k)!.push({ tipo: 'foto', fila: f })
  }
  for (const c of cartas) {
    const k = normalizarCodigo(c.idLocal)
    if (!byCode.has(k)) byCode.set(k, [])
    byCode.get(k)!.push({ tipo: 'carta', fila: c })
  }
  return [...byCode.entries()].map(([codigo, items]) => ({ codigo, items }))
}

export function mapAOrdenados(
  map: Map<string, { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }>
): MensajePorTutor[] {
  return [...map.values()]
    .map((v, idx) => ({
      tutorNombre: v.nombre,
      tutorKey: `${v.nombre}__${idx}`,
      mensaje: construirMensajeTutor(v.nombre, v.fotos, v.blp, v.pres),
      fotos: v.fotos.length,
      cartasBlp: v.blp.length,
      cartasPresentacion: v.pres.length,
    }))
    .sort((a, b) => a.tutorNombre.localeCompare(b.tutorNombre, 'es'))
}
