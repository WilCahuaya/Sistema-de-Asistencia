'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook para verificar si el usuario actual (como tutor) puede registrar asistencia
 * en un aula específica. Solo aplica cuando el usuario tiene rol tutor.
 *
 * @param fcpId - ID de la FCP
 * @param aulaId - ID del aula
 * @returns true si el tutor está habilitado para registrar asistencia en ese aula
 */
export function useTutorPuedeRegistrarAula(
  fcpId: string | null | undefined,
  aulaId: string | null | undefined
): { puedeRegistrar: boolean; loading: boolean } {
  const [puedeRegistrar, setPuedeRegistrar] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (!fcpId || !aulaId) {
        setPuedeRegistrar(false)
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (cancelled || !user) {
          setPuedeRegistrar(false)
          setLoading(false)
          return
        }

        const { data, error } = await supabase.rpc('tutor_puede_registrar_asistencia_aula', {
          p_usuario_id: user.id,
          p_fcp_id: fcpId,
          p_aula_id: aulaId,
        })

        if (cancelled) return

        if (error) {
          console.error('Error en tutor_puede_registrar_asistencia_aula:', error)
          setPuedeRegistrar(false)
        } else {
          setPuedeRegistrar(data === true)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error en useTutorPuedeRegistrarAula:', err)
          setPuedeRegistrar(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    check()
    return () => { cancelled = true }
  }, [fcpId, aulaId])

  return { puedeRegistrar, loading }
}
