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

/**
 * Estudiantes que corresponden al «ID Local del Beneficiario» del Excel:
 * - código completo igual (normalizado), o
 * - sufijo de 1 a 3 dígitos: coincide con el final del bloque numérico del código en sistema.
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

  let suf = digits
  if (suf.length > 3) suf = suf.slice(-3)

  return estudiantes.filter((e) => {
    const tail = digitosFinalesCodigoEstudiante(normalizarCodigo(e.codigo))
    return tail.length > 0 && tail.endsWith(suf)
  })
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
