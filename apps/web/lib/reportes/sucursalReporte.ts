import type { SupabaseClient } from '@supabase/supabase-js'
import type { AulaTipo } from '@/lib/utils/aulaIntervencion'
import { extraerSucursal } from '@/lib/utils/aulaSucursal'

export const SUCURSAL_TODAS = '__todas__'

export type SucursalReporte = {
  id: string
  nombre: string
  es_predeterminada: boolean
  orden: number
}

export type AulaSucursalMeta = {
  sucursalId: string | null
  sucursalNombre?: string
  esPrincipal?: boolean
}

export async function fetchSucursalesReporte(
  supabase: SupabaseClient,
  fcpId: string
): Promise<SucursalReporte[]> {
  const { data, error } = await supabase
    .from('sucursales')
    .select('id, nombre, es_predeterminada, orden')
    .eq('fcp_id', fcpId)
    .order('es_predeterminada', { ascending: false })
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw error
  return (data || []) as SucursalReporte[]
}

export async function fetchAulaSucursalMetaMap(
  supabase: SupabaseClient,
  fcpId: string,
  tipo?: AulaTipo
): Promise<Map<string, AulaSucursalMeta>> {
  let query = supabase
    .from('aulas')
    .select('id, sucursal_id, tipo, sucursal:sucursales(nombre, es_predeterminada)')
    .eq('fcp_id', fcpId)
    .eq('activa', true)

  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, AulaSucursalMeta>()
  for (const row of data || []) {
    const { sucursalNombre, esPrincipal } = extraerSucursal(row)
    map.set(row.id, {
      sucursalId: row.sucursal_id ?? null,
      sucursalNombre,
      esPrincipal,
    })
  }
  return map
}

/** true si conviene mostrar el selector (hay más de una sucursal o alguna distinta de Principal). */
export function haySelectorSucursal(sucursales: SucursalReporte[]): boolean {
  if (sucursales.length === 0) return false
  return sucursales.length > 1 || sucursales.some((s) => !s.es_predeterminada)
}

export function filtrarAulasPorSucursal<T extends { id: string }>(
  aulas: T[],
  sucursalId: string,
  metaMap: Map<string, AulaSucursalMeta>
): T[] {
  if (sucursalId === SUCURSAL_TODAS) return aulas
  return aulas.filter((a) => metaMap.get(a.id)?.sucursalId === sucursalId)
}

export function filtrarIdsPorSucursal(
  aulaIds: string[],
  sucursalId: string,
  metaMap: Map<string, AulaSucursalMeta>
): string[] {
  if (sucursalId === SUCURSAL_TODAS) return aulaIds
  return aulaIds.filter((id) => metaMap.get(id)?.sucursalId === sucursalId)
}

export function etiquetaAulaConSucursal(
  nombreAula: string,
  aulaId: string,
  metaMap: Map<string, AulaSucursalMeta>,
  mostrarSucursal: boolean
): string {
  if (!mostrarSucursal) return nombreAula
  const meta = metaMap.get(aulaId)
  if (!meta || meta.esPrincipal || !meta.sucursalNombre) return nombreAula
  return `${nombreAula} · ${meta.sucursalNombre}`
}

export function nombreSucursalSeleccionada(
  sucursalId: string,
  sucursales: SucursalReporte[]
): string | null {
  if (sucursalId === SUCURSAL_TODAS) return null
  return sucursales.find((s) => s.id === sucursalId)?.nombre ?? null
}

export function etiquetaSucursalSelect(s: SucursalReporte): string {
  return s.es_predeterminada ? `${s.nombre} (Principal)` : s.nombre
}
