'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AulaTipo } from '@/lib/utils/aulaIntervencion'
import {
  SUCURSAL_TODAS,
  fetchAulaSucursalMetaMap,
  fetchSucursalesReporte,
  haySelectorSucursal,
  nombreSucursalSeleccionada,
  type AulaSucursalMeta,
  type SucursalReporte,
} from '@/lib/reportes/sucursalReporte'

export function useSucursalReporteFilter(fcpId: string | null, tipoAula?: AulaTipo) {
  const [sucursales, setSucursales] = useState<SucursalReporte[]>([])
  const [selectedSucursalId, setSelectedSucursalId] = useState(SUCURSAL_TODAS)
  const [aulaMetaMap, setAulaMetaMap] = useState<Map<string, AulaSucursalMeta>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fcpId) {
      setSucursales([])
      setAulaMetaMap(new Map())
      setSelectedSucursalId(SUCURSAL_TODAS)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const [sucursalesData, meta] = await Promise.all([
          fetchSucursalesReporte(supabase, fcpId),
          fetchAulaSucursalMetaMap(supabase, fcpId, tipoAula),
        ])
        if (cancelled) return
        setSucursales(sucursalesData)
        setAulaMetaMap(meta)
        setSelectedSucursalId((prev) => {
          if (prev === SUCURSAL_TODAS) return prev
          return sucursalesData.some((s) => s.id === prev) ? prev : SUCURSAL_TODAS
        })
      } catch (e) {
        console.error('Error cargando sucursales para reporte:', e)
        if (!cancelled) {
          setSucursales([])
          setAulaMetaMap(new Map())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fcpId, tipoAula])

  const mostrarSelector = haySelectorSucursal(sucursales)
  const mostrarEtiquetaSucursal = selectedSucursalId === SUCURSAL_TODAS
  const sucursalNombre = useMemo(
    () => nombreSucursalSeleccionada(selectedSucursalId, sucursales),
    [selectedSucursalId, sucursales]
  )

  return {
    sucursales,
    selectedSucursalId,
    setSelectedSucursalId,
    aulaMetaMap,
    loading,
    mostrarSelector,
    mostrarEtiquetaSucursal,
    sucursalNombre,
    filtrandoSucursal: selectedSucursalId !== SUCURSAL_TODAS,
  }
}
