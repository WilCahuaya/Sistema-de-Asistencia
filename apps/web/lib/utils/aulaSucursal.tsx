import { Building2 } from 'lucide-react'

/** Columnas a pedir en las consultas de aulas para mostrar el diferenciador de sucursal. */
export const SUCURSAL_SELECT = 'sucursal:sucursales(nombre, es_predeterminada)'

export interface AulaSucursalInfo {
  /** Nombre de la sucursal del aula. */
  sucursalNombre?: string
  /** true si el aula pertenece a la sucursal predeterminada ("Principal"). */
  esPrincipal?: boolean
}

/**
 * Extrae el nombre de la sucursal y si es la predeterminada desde una fila de aula
 * que incluya el join `sucursal:sucursales(nombre, es_predeterminada)`.
 */
export function extraerSucursal(aulaRow: any): AulaSucursalInfo {
  const suc = Array.isArray(aulaRow?.sucursal) ? aulaRow.sucursal[0] : aulaRow?.sucursal
  return {
    sucursalNombre: suc?.nombre,
    esPrincipal: !!suc?.es_predeterminada,
  }
}

/**
 * Etiqueta visual de sucursal para los selectores de aula.
 * Solo se muestra cuando el aula pertenece a una sucursal distinta de "Principal",
 * de modo que sirve como diferenciador de qué sucursal es el salón.
 */
export function SucursalTag({
  sucursalNombre,
  esPrincipal,
  className,
}: AulaSucursalInfo & { className?: string }) {
  if (esPrincipal || !sucursalNombre) return null
  return (
    <span
      className={`ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary ${className ?? ''}`}
    >
      <Building2 className="h-2.5 w-2.5" />
      {sucursalNombre}
    </span>
  )
}
