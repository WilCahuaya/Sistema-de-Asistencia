/**
 * Orden alfabético A–Z según reglas del español (incl. ñ y acentos).
 */
export function compareNombreCompleto(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base', numeric: true })
}

export function sortByNombreCompleto<T extends { nombre_completo: string }>(arr: T[]): T[] {
  return [...arr].sort((x, y) => compareNombreCompleto(x.nombre_completo, y.nombre_completo))
}

export function sortByEstudianteNombre<
  T extends { estudiante?: { nombre_completo?: string | null } | null },
>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    compareNombreCompleto(a.estudiante?.nombre_completo, b.estudiante?.nombre_completo),
  )
}
