'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type RolType = 'facilitador' | 'secretario' | 'tutor' | null

interface UseUserRoleResult {
  role: RolType
  loading: boolean
  error: Error | null
  isFacilitador: boolean
  isSecretario: boolean
  isTutor: boolean
  canEdit: boolean // Facilitador o Secretario
  canViewReports: boolean // Facilitador o Secretario
}

/**
 * Hook para obtener el rol del usuario actual en una ONG específica
 * 
 * @param ongId - ID de la ONG
 * @returns Objeto con el rol del usuario y helpers de permisos
 * 
 * @example
 * const { role, canEdit, loading } = useUserRole(ongId)
 * 
 * if (canEdit) {
 *   // Mostrar botones de edición
 * }
 */
export function useUserRole(ongId: string | null): UseUserRoleResult {
  const [role, setRole] = useState<RolType>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!ongId) {
      setRole(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchRole = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (cancelled) return

        if (!user) {
          if (!cancelled) {
            setRole(null)
            setLoading(false)
          }
          return
        }

        // Obtener el rol del usuario usando la función RPC
        const { data: rolData, error: rpcError } = await supabase.rpc(
          'obtener_rol_ong',
          {
            p_ong_id: ongId,
            p_usuario_id: user.id,
          }
        )

        if (cancelled) return

        if (rpcError) {
          // Ignorar errores de aborto (son esperados cuando cambian las dependencias)
          if (rpcError.message?.includes('AbortError') || rpcError.message?.includes('aborted')) {
            return
          }

          // Si falla la RPC, intentar consulta directa
          const { data: usuarioOngData, error: queryError } = await supabase
            .from('usuario_ong')
            .select('rol')
            .eq('usuario_id', user.id)
            .eq('ong_id', ongId)
            .eq('activo', true)
            .single()

          if (cancelled) return

          if (queryError) {
            // Ignorar errores de aborto
            if (queryError.message?.includes('AbortError') || queryError.message?.includes('aborted')) {
              return
            }
            console.error('Error fetching user role:', queryError)
            if (!cancelled) {
              setError(new Error('No se pudo obtener el rol del usuario'))
              setRole(null)
            }
            return
          }

          if (!cancelled) {
            setRole(usuarioOngData?.rol || null)
          }
        } else {
          if (!cancelled) {
            setRole(rolData || null)
          }
        }
      } catch (err) {
        // Ignorar errores de aborto (son esperados)
        if (err instanceof Error && (err.message.includes('AbortError') || err.message.includes('aborted'))) {
          return
        }
        if (!cancelled) {
          console.error('Error in useUserRole:', err)
          setError(err instanceof Error ? err : new Error('Error desconocido'))
          setRole(null)
          setLoading(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRole()

    return () => {
      cancelled = true
    }
  }, [ongId])

  const isFacilitador = role === 'facilitador'
  const isSecretario = role === 'secretario'
  const isTutor = role === 'tutor'
  const canEdit = isFacilitador || isSecretario
  const canViewReports = isFacilitador || isSecretario

  return {
    role,
    loading,
    error,
    isFacilitador,
    isSecretario,
    isTutor,
    canEdit,
    canViewReports,
  }
}

