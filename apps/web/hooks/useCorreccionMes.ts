'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTodayInAppTimezone } from '@/lib/utils/dateUtils'

export type EstadoCorreccionMes = 'cerrado' | 'correccion_habilitada' | 'bloqueado'

export interface CorreccionMesInfo {
  estado: EstadoCorreccionMes
  habilitadoPorNombre: string | null
  fechaLimite: string | null
  diasCorreccion: number | null
  id: string | null
}

export function useCorreccionMes(
  fcpId: string | null,
  anio: number,
  mes: number
): { data: CorreccionMesInfo | null; loading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const [data, setData] = useState<CorreccionMesInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!fcpId) {
      setData(null)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data: rows, error: err } = await supabase
        .from('correccion_mes_fcp')
        .select('id, habilitado_por_nombre, fecha_limite, dias_correccion')
        .eq('fcp_id', fcpId)
        .eq('anio', anio)
        .eq('mes', mes)
        .maybeSingle()

      if (err) throw err

      const hoy = getTodayInAppTimezone()
      let estado: EstadoCorreccionMes = 'cerrado'
      let fechaLimite: string | null = null
      let habilitadoPorNombre: string | null = null
      let diasCorreccion: number | null = null
      let id: string | null = null

      if (rows) {
        fechaLimite = rows.fecha_limite ?? null
        habilitadoPorNombre = rows.habilitado_por_nombre ?? null
        diasCorreccion = rows.dias_correccion ?? null
        id = rows.id ?? null
        const fechaLimiteStr = fechaLimite ? String(fechaLimite).slice(0, 10) : null
        if (fechaLimiteStr && hoy <= fechaLimiteStr) {
          estado = 'correccion_habilitada'
        } else {
          estado = 'bloqueado'
        }
      }

      setData({
        estado,
        habilitadoPorNombre,
        fechaLimite,
        diasCorreccion,
        id,
      })
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Error al cargar estado de corrección'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [fcpId, anio, mes])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return { data, loading, error, refetch: fetchStatus }
}

/**
 * Comprueba si (anio, mes) es el mes inmediatamente anterior al actual.
 */
export function esMesAnterior(anio: number, mes: number): boolean {
  const now = new Date()
  const anioActual = now.getFullYear()
  const mesActual = now.getMonth() + 1
  if (mesActual === 1) {
    return anio === anioActual - 1 && mes === 12
  }
  return anio === anioActual && mes === mesActual - 1
}

/**
 * Comprueba si (anio, mes) es un mes pasado (anterior al actual, cualquier mes).
 */
export function esMesPasado(anio: number, mes: number): boolean {
  const now = new Date()
  const anioActual = now.getFullYear()
  const mesActual = now.getMonth() + 1
  if (anio < anioActual) return true
  if (anio === anioActual && mes < mesActual) return true
  return false
}
