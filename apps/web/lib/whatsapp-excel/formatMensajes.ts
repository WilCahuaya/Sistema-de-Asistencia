import type { FilaCarta, FilaFoto } from './parser'
import { normalizarCodigo } from './parser'
import {
  elegirEstudianteYAdvertencia,
  GRUPO_NO_EN_SISTEMA,
  GRUPO_SIN_TUTOR,
  tutorNombreParaEstudiante,
  type EstudianteMin,
} from './resolverTutorPorIdLocal'
import {
  SUB_REPORTES_ORDEN,
  TITULO_SUB_REPORTE,
  type TipoSubReporte,
} from './tiposReporte'

export type ItemAgrupado =
  | { tipo: 'foto'; fila: FilaFoto }
  | { tipo: 'carta'; fila: FilaCarta }

export type TipoGrupoMensaje = 'tutor' | 'sin_tutor' | 'no_en_sistema'

export type FilasPorSubReporte = Record<TipoSubReporte, { fotos: FilaFoto[]; cartas: FilaCarta[] }>

export type MensajePorTutor = {
  tutorNombre: string
  tutorKey: string
  mensaje: string
  fotos: number
  cartasBlp: number
  cartasPresentacion: number
  tipoGrupo: TipoGrupoMensaje
}

function bucketVacio(): FilasPorSubReporte {
  return {
    actualizaciones: { fotos: [], cartas: [] },
    relacionales: { fotos: [], cartas: [] },
    blp: { fotos: [], cartas: [] },
    rehacer: { fotos: [], cartas: [] },
    presentacion: { fotos: [], cartas: [] },
  }
}

/** Une solo los campos con valor; omite celdas vacías. */
function unirCampos(sep: string, partes: string[]): string {
  return partes.map((p) => p.trim()).filter(Boolean).join(sep)
}

function lineaFoto(f: FilaFoto): string {
  const cuerpo = unirCampos(' – ', [f.nombreCuenta, f.idLocal, f.fechaUltimaFoto, f.estadoActualizacion])
  return cuerpo ? `📸  ${cuerpo}` : ''
}

function lineaCarta(f: FilaCarta): string {
  const cabecera = unirCampos(' – ', [f.nombreCuenta, f.idLocal])
  const resto = unirCampos(' - ', [
    f.tipoComunicacion,
    f.idComunicacionGlobal,
    f.comentarios,
    f.indicador,
  ])
  const cuerpo = resto ? (cabecera ? `${cabecera} - ${resto}` : resto) : cabecera
  return cuerpo ? `📝 ${cuerpo}` : ''
}

function lineasSubReporte(sub: TipoSubReporte, fotos: FilaFoto[], cartas: FilaCarta[]): string[] {
  if (sub === 'actualizaciones') return fotos.map(lineaFoto)
  return cartas.map(lineaCarta)
}

function encabezadoGrupo(tutorNombre: string): string {
  if (tutorNombre === GRUPO_SIN_TUTOR) return `${GRUPO_SIN_TUTOR} (están en la FCP pero sin tutor en salón):\n`
  if (tutorNombre === GRUPO_NO_EN_SISTEMA) {
    return `${GRUPO_NO_EN_SISTEMA} (el ID local del Excel no está cargado en Estudiantes de esta FCP):\n`
  }
  return `Para ${tutorNombre}:\n`
}

function tipoGrupoDesdeNombre(nombre: string): TipoGrupoMensaje {
  if (nombre === GRUPO_SIN_TUTOR) return 'sin_tutor'
  if (nombre === GRUPO_NO_EN_SISTEMA) return 'no_en_sistema'
  return 'tutor'
}

export function construirMensajeTutor(tutorNombre: string, porSub: FilasPorSubReporte): string {
  const partes: string[] = [encabezadoGrupo(tutorNombre)]

  for (const sub of SUB_REPORTES_ORDEN) {
    const { fotos, cartas } = porSub[sub]
    const lineas = lineasSubReporte(sub, fotos, cartas).filter(Boolean)
    if (lineas.length === 0) continue
    partes.push(`${TITULO_SUB_REPORTE[sub]}\n\n${lineas.join('\n')}\n\n`)
  }

  return partes.join('').trimEnd()
}

function contarFilas(porSub: FilasPorSubReporte): {
  fotos: number
  cartasBlp: number
  cartasPresentacion: number
} {
  let fotos = 0
  let cartasBlp = 0
  let cartasPresentacion = 0
  for (const sub of SUB_REPORTES_ORDEN) {
    const b = porSub[sub]
    fotos += b.fotos.length
    if (sub === 'presentacion') cartasPresentacion += b.cartas.length
    else cartasBlp += b.cartas.length
  }
  return { fotos, cartasBlp, cartasPresentacion }
}

function agregarItem(porSub: FilasPorSubReporte, it: ItemAgrupado): void {
  const sub = it.tipo === 'foto' ? it.fila.subReporte : it.fila.subReporte
  if (it.tipo === 'foto') porSub[sub].fotos.push(it.fila)
  else porSub[sub].cartas.push(it.fila)
}

/**
 * Agrupa por tutor usando ID local del Excel contra estudiantes de la FCP.
 * Dentro de cada tutor, las filas se ordenan por sub-apartado (tipo de Excel / DASH).
 */
export function agruparPorTutorConEstudiantes(
  items: Array<{ codigo: string; items: ItemAgrupado[] }>,
  estudiantes: EstudianteMin[],
  aulaToTutor: Map<string, string>
): {
  map: Map<string, { nombre: string; porSub: FilasPorSubReporte }>
  advertenciasResolucion: string[]
} {
  const map = new Map<string, { nombre: string; porSub: FilasPorSubReporte }>()
  const tutorPorIdExcel = new Map<string, string>()
  const advertenciasResolucion: string[] = []
  const advVistas = new Set<string>()

  function nombreTutorParaIdExcel(idExcel: string): string {
    if (tutorPorIdExcel.has(idExcel)) return tutorPorIdExcel.get(idExcel)!
    const { est, advertencia } = elegirEstudianteYAdvertencia(idExcel, estudiantes)
    if (advertencia && !advVistas.has(advertencia)) {
      advVistas.add(advertencia)
      advertenciasResolucion.push(advertencia)
    }
    const nombre = est ? tutorNombreParaEstudiante(est, aulaToTutor) : GRUPO_NO_EN_SISTEMA
    tutorPorIdExcel.set(idExcel, nombre)
    return nombre
  }

  for (const { codigo, items: its } of items) {
    const keyExcel = normalizarCodigo(codigo)
    const nombreTutor = nombreTutorParaIdExcel(keyExcel)
    if (!map.has(nombreTutor)) {
      map.set(nombreTutor, { nombre: nombreTutor, porSub: bucketVacio() })
    }
    const bucket = map.get(nombreTutor)!
    for (const it of its) agregarItem(bucket.porSub, it)
  }

  return { map, advertenciasResolucion }
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

function ordenGrupo(nombre: string): number {
  if (nombre === GRUPO_SIN_TUTOR) return 1
  if (nombre === GRUPO_NO_EN_SISTEMA) return 2
  return 0
}

export function mapAOrdenados(
  map: Map<string, { nombre: string; porSub: FilasPorSubReporte }>
): MensajePorTutor[] {
  return [...map.values()]
    .map((v, idx) => {
      const counts = contarFilas(v.porSub)
      return {
        tutorNombre: v.nombre,
        tutorKey: `${v.nombre}__${idx}`,
        mensaje: construirMensajeTutor(v.nombre, v.porSub),
        fotos: counts.fotos,
        cartasBlp: counts.cartasBlp,
        cartasPresentacion: counts.cartasPresentacion,
        tipoGrupo: tipoGrupoDesdeNombre(v.nombre),
      }
    })
    .sort((a, b) => {
      const oa = ordenGrupo(a.tutorNombre)
      const ob = ordenGrupo(b.tutorNombre)
      if (oa !== ob) return oa - ob
      return a.tutorNombre.localeCompare(b.tutorNombre, 'es')
    })
}
