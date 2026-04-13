'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePermisoTardioAnual(fcpId: string | null) {
  const [activo, setActivo] = useState(false)
  /** Fecha inclusive hasta la que aplica el permiso anual (solo si activo) */
  const [fechaLimite, setFechaLimite] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!fcpId) {
      setActivo(false)
      setFechaLimite(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('permiso_tardio_anual_activo', {
        p_fcp_id: fcpId,
      })
      if (error) throw error
      const ok = Boolean(data)
      setActivo(ok)
      if (ok) {
        const { data: fl, error: e2 } = await supabase.rpc('permiso_tardio_anual_fecha_limite', {
          p_fcp_id: fcpId,
        })
        if (!e2 && fl) setFechaLimite(String(fl))
        else setFechaLimite(null)
      } else {
        setFechaLimite(null)
      }
    } catch {
      setActivo(false)
      setFechaLimite(null)
    } finally {
      setLoading(false)
    }
  }, [fcpId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { activo, fechaLimite, loading, refetch }
}

