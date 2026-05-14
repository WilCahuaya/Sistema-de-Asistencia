import { normalizarCodigo } from './parser'

export type EstudianteMin = { codigo: string; aula_id: string | null }

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

/**
 * Variantes del ID local numérico: valor tal cual, sin ceros a la izquierda,
 * y sufijos de 1…9 dígitos (p. ej. 01059 → 1059, 059, …).
 */
function variantesSufijoExcel(digits: string): string[] {
  const d = digits.length > 12 ? digits.slice(-12) : digits
  if (!d) return []
  const seen = new Set<string>()
  const push = (s: string) => {
    if (s.length > 0 && s.length <= 12) seen.add(s)
  }
  push(d)
  const stripped = d.replace(/^0+/, '') || '0'
  if (stripped !== d) push(stripped)
  for (let k = 1; k <= Math.min(9, d.length); k++) push(d.slice(-k))
  if (stripped !== d) {
    for (let k = 1; k <= Math.min(9, stripped.length); k++) push(stripped.slice(-k))
  }
  return [...seen].sort((a, b) => b.length - a.length)
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
 * - o todos los dígitos del código en sistema terminan en alguna variante del ID local (p. ej. 059, 1059, PE053001059).
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
    const byAlnum = estudiantes.filter((e) => {
      const a = alfanumericoCompacto(e.codigo)
      return a === aExcel || a.endsWith(aExcel) || aExcel.endsWith(a)
    })
    if (byAlnum.length > 0) return byAlnum
  }

  if (/^PE[A-Z0-9]{4,}$/i.test(normFull.replace(/\s/g, ''))) {
    const compact = normFull.replace(/\s/g, '')
    const byPe = estudiantes.filter((e) => {
      const c = normalizarCodigo(e.codigo).replace(/\s/g, '')
      return c === compact || c.endsWith(compact) || compact.endsWith(c)
    })
    if (byPe.length > 0) return byPe
  }

  const digits = soloDigitos(normFull)
  if (digits.length === 0) return []

  const variantes = variantesSufijoExcel(digits)

  const igualdadDigitos = estudiantes.filter((e) => soloDigitos(normalizarCodigo(e.codigo)) === digits)
  if (igualdadDigitos.length > 0) return igualdadDigitos

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
  if (!est.aula_id) return 'Sin tutor asignado en salón'
  return aulaToTutor.get(est.aula_id) ?? 'Sin tutor asignado en salón'
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
