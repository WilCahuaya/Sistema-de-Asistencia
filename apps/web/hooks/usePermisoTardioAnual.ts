'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePermisoTardioAnual(fcpId: string | null) {
  const [activo, setActivo] = useState(false)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!fcpId) {
      setActivo(false)
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
      setActivo(Boolean(data))
    } catch {
      setActivo(false)
    } finally {
      setLoading(false)
    }
  }, [fcpId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { activo, loading, refetch }
}

