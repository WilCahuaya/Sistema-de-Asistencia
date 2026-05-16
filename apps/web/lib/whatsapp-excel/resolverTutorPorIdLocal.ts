import { normalizarCodigo } from './parser'

export type EstudianteMin = { codigo: string; aula_id: string | null }

/** Estudiante en FCP pero sin salón o sin tutor en el salón. */
export const GRUPO_SIN_TUTOR = 'Sin tutor asignado'

/** Beneficiario del Excel sin ningún estudiante con ese ID local en esta FCP. */
export const GRUPO_NO_EN_SISTEMA = 'No están en el sistema'

/** @deprecated Usar GRUPO_NO_EN_SISTEMA */
export const GRUPO_SIN_ESTUDIANTE = GRUPO_NO_EN_SISTEMA

/** Sufijos numéricos del ID local en Excel (ahora hasta 4 dígitos). */
const MAX_SUFIJO_ID_LOCAL = 4

/** Dígitos finales del código del estudiante (p. ej. PE053000222 → 000222). */
export function digitosFinalesCodigoEstudiante(codigoNorm: string): string {
  const m = codigoNorm.match(/(\d+)$/)
  return m ? m[1] : ''
}

function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

/** Solo letras y números, mayúsculas (para comparar PE053001059 con variantes del Excel). */
function alfanumericoCompacto(s: string): string {
  return normalizarCodigo(s).replace(/\s/g, '').replace(/[^A-Z0-9]/g, '')
}

/** Excel trae código PE completo o más de 4 dígitos: no usar sufijos cortos (evita confundir 821 con …221, …321). */
function esIdLocalCompleto(normFull: string, digits: string): boolean {
  const compact = normFull.replace(/\s/g, '')
  if (/^PE[A-Z0-9]{5,}$/i.test(compact)) return true
  return digits.length > MAX_SUFIJO_ID_LOCAL
}

/**
 * ID local corto (1–4 dígitos en Excel) → bloque de 4 dígitos con ceros a la izquierda:
 * 1 → 0001, 120 → 0120, 1120 → 1120, 13 → 0013, 85 → 0085.
 * Se compara con el final del bloque numérico del código en sistema (sin recortar a 2–3 dígitos).
 */
function variantesIdLocalCorto(digits: string): string[] {
  const d = digits.slice(0, MAX_SUFIJO_ID_LOCAL)
  if (!d || d.length > MAX_SUFIJO_ID_LOCAL) return []
  const seen = new Set<string>()
  const nucleo = d.replace(/^0+/, '') || '0'
  seen.add(d.padStart(MAX_SUFIJO_ID_LOCAL, '0'))
  seen.add(nucleo.padStart(MAX_SUFIJO_ID_LOCAL, '0'))
  return [...seen]
}

function scoreSufijo(dEst: string, variantes: string[]): number {
  let m = 0
  for (const v of variantes) {
    if (v.length > 0 && dEst.endsWith(v)) m = Math.max(m, v.length)
  }
  return m
}

/**
 * Estudiantes que corresponden al «ID Local del Beneficiario» del Excel:
 * - código completo igual (normalizado), o
 * - mismo alfanumérico compacto / uno termina en el otro,
 * - ID local corto (1–4 dígitos): se rellena a 4 con ceros (1→0001, 85→0085) y se busca al final del código.
 * - Código PE completo en Excel: solo coincidencia exacta o cola numérica completa, no sufijos ambiguos.
 */
export function candidatosEstudiantesPorIdLocal(
  idLocalExcel: string,
  estudiantes: EstudianteMin[]
): EstudianteMin[] {
  const raw = idLocalExcel.trim().replace(/\u00a0/g, ' ')
  if (!raw) return []

  const normFull = normalizarCodigo(raw)

  const exact = estudiantes.filter((e) => normalizarCodigo(e.codigo) === normFull)
  if (exact.length > 0) return exact

  const aExcel = alfanumericoCompacto(normFull)
  if (aExcel.length > 0) {
    const byAlnum = estudiantes.filter((e) => alfanumericoCompacto(e.codigo) === aExcel)
    if (byAlnum.length > 0) return byAlnum
  }

  const compact = normFull.replace(/\s/g, '')
  if (/^PE[A-Z0-9]{4,}$/i.test(compact)) {
    const byPe = estudiantes.filter((e) => alfanumericoCompacto(e.codigo) === aExcel)
    if (byPe.length > 0) return byPe
  }

  const digits = soloDigitos(normFull)
  if (digits.length === 0) return []

  const igualdadDigitos = estudiantes.filter((e) => soloDigitos(normalizarCodigo(e.codigo)) === digits)
  if (igualdadDigitos.length > 0) return igualdadDigitos

  if (esIdLocalCompleto(normFull, digits)) {
    const porColaCompleta = estudiantes.filter((e) => {
      const dEst = soloDigitos(normalizarCodigo(e.codigo))
      return dEst.length > 0 && dEst.endsWith(digits)
    })
    if (porColaCompleta.length > 0) return porColaCompleta
    return []
  }

  const variantes = variantesIdLocalCorto(digits)

  const porSufijo = estudiantes.filter((e) => {
    const dEst = soloDigitos(normalizarCodigo(e.codigo))
    if (!dEst) return false
    return variantes.some((v) => v.length > 0 && dEst.endsWith(v))
  })
  if (porSufijo.length === 0) return []

  porSufijo.sort((a, b) => {
    const da = soloDigitos(normalizarCodigo(a.codigo))
    const db = soloDigitos(normalizarCodigo(b.codigo))
    const sa = scoreSufijo(da, variantes)
    const sb = scoreSufijo(db, variantes)
    if (sb !== sa) return sb - sa
    return normalizarCodigo(a.codigo).localeCompare(normalizarCodigo(b.codigo), 'es')
  })

  const best = scoreSufijo(soloDigitos(normalizarCodigo(porSufijo[0].codigo)), variantes)
  return porSufijo.filter(
    (e) => scoreSufijo(soloDigitos(normalizarCodigo(e.codigo)), variantes) === best
  )
}

export function tutorNombreParaEstudiante(
  est: EstudianteMin,
  aulaToTutor: Map<string, string>
): string {
  if (!est.aula_id) return GRUPO_SIN_TUTOR
  return aulaToTutor.get(est.aula_id) ?? GRUPO_SIN_TUTOR
}

export function elegirEstudianteYAdvertencia(
  idLocalExcel: string,
  estudiantes: EstudianteMin[]
): { est: EstudianteMin | null; advertencia?: string } {
  const cand = candidatosEstudiantesPorIdLocal(idLocalExcel, estudiantes)
  if (cand.length === 0) return { est: null }
  const sorted = [...cand].sort((a, b) =>
    normalizarCodigo(a.codigo).localeCompare(normalizarCodigo(b.codigo), 'es')
  )
  if (sorted.length > 1) {
    const lista = sorted.map((s) => s.codigo).join(', ')
    return {
      est: sorted[0],
      advertencia: `ID local «${idLocalExcel.trim()}» coincide con ${sorted.length} estudiantes (${lista}); se usó ${sorted[0].codigo}.`,
    }
  }
  return { est: sorted[0] }
}
