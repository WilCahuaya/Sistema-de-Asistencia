/** Filas devueltas por RPC estudiantes_activos_en_rango_batch */
export type EstudianteActivoBatchRow = { aula_id: string; estudiante_id: string }

/** Agrupa estudiantes por aula_id a partir del resultado del RPC por lotes. */
export function buildEstudiantesPorAulaMap(
  rows: EstudianteActivoBatchRow[] | null | undefined
): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const r of rows || []) {
    if (!m.has(r.aula_id)) m.set(r.aula_id, [])
    m.get(r.aula_id)!.push(r.estudiante_id)
  }
  return m
}
