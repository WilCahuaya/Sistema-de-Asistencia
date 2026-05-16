import type { FilaCarta, FilaFoto } from './parser'
import { normalizarCodigo } from './parser'
import {
  elegirEstudianteYAdvertencia,
  GRUPO_NO_EN_SISTEMA,
  GRUPO_SIN_TUTOR,
  tutorNombreParaEstudiante,
  type EstudianteMin,
} from './resolverTutorPorIdLocal'

export type ItemAgrupado =
  | { tipo: 'foto'; fila: FilaFoto }
  | { tipo: 'carta'; fila: FilaCarta }

export type TipoGrupoMensaje = 'tutor' | 'sin_tutor' | 'no_en_sistema'

export type MensajePorTutor = {
  tutorNombre: string
  tutorKey: string
  mensaje: string
  fotos: number
  cartasBlp: number
  cartasPresentacion: number
  tipoGrupo: TipoGrupoMensaje
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
  const cuerpo = unirCampos(' - ', [
    f.nombreCuenta,
    f.idLocal,
    f.tipoComunicacion,
    f.idComunicacionGlobal,
    f.comentarios,
    f.indicador,
  ])
  return cuerpo ? `📝 ${cuerpo}` : ''
}

function bloque(titulo: string, lineas: string[]): string {
  const validas = lineas.filter(Boolean)
  if (validas.length === 0) return ''
  return `${titulo}\n\n${validas.join('\n')}\n\n`
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

export function construirMensajeTutor(
  tutorNombre: string,
  fotos: FilaFoto[],
  cartasBlp: FilaCarta[],
  cartasPres: FilaCarta[]
): string {
  const partes: string[] = [encabezadoGrupo(tutorNombre)]
  const bFoto = bloque('Fotos para actualizar:', fotos.map(lineaFoto))
  const bBlp = bloque('Cartas Pendientes BLP (Myconnet):', cartasBlp.map(lineaCarta))
  const bPres = bloque('Cartas de Presentación:', cartasPres.map(lineaCarta))
  if (bFoto) partes.push(bFoto)
  if (bBlp) partes.push(bBlp)
  if (bPres) partes.push(bPres)
  return partes.join('').trimEnd()
}

export function agruparPorTutor(
  items: Array<{ codigo: string; items: ItemAgrupado[] }>,
  codigoATutor: Map<string, string>
): Map<string, { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }> {
  const map = new Map<string, { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }>()

  for (const { codigo, items: its } of items) {
    const key = normalizarCodigo(codigo)
    const nombreTutor = codigoATutor.has(key) ? codigoATutor.get(key)! : GRUPO_NO_EN_SISTEMA
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

/**
 * Agrupa por tutor usando ID local del Excel (código completo o sufijo hasta 4 dígitos)
 * contra estudiantes de la FCP.
 */
export function agruparPorTutorConEstudiantes(
  items: Array<{ codigo: string; items: ItemAgrupado[] }>,
  estudiantes: EstudianteMin[],
  aulaToTutor: Map<string, string>
): {
  map: Map<string, { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }>
  advertenciasResolucion: string[]
} {
  const map = new Map<
    string,
    { nombre: string; fotos: FilaFoto[]; blp: FilaCarta[]; pres: FilaCarta[] }
  >()
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
      map.set(nombreTutor, { nombre: nombreTutor, fotos: [], blp: [], pres: [] })
    }
    const bucket = map.get(nombreTutor)!
    for (const it of its) {
      if (it.tipo === 'foto') bucket.fotos.push(it.fila)
      else if (it.fila.seccion === 'blp') bucket.blp.push(it.fila)
      else bucket.pres.push(it.fila)
    }
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
      tipoGrupo: tipoGrupoDesdeNombre(v.nombre),
    }))
    .sort((a, b) => {
      const oa = ordenGrupo(a.tutorNombre)
      const ob = ordenGrupo(b.tutorNombre)
      if (oa !== ob) return oa - ob
      return a.tutorNombre.localeCompare(b.tutorNombre, 'es')
    })
}
