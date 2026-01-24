'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHighestPriorityRole, type RolType as RolTypeUtil } from '@/lib/utils/roles'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'

export type RolType = 'facilitador' | 'director' | 'secretario' | 'tutor' | null

interface UseUserRoleResult {
  role: RolType
  loading: boolean
  error: Error | null
  isFacilitador: boolean
  isDirector: boolean
  isSecretario: boolean
  isTutor: boolean
  canEdit: boolean // Facilitador, Director o Secretario
  canViewReports: boolean // Facilitador, Director o Secretario
}

/**
 * Hook para obtener el rol del usuario actual en una FCP específica
 * 
 * @param fcpId - ID de la FCP
 * @returns Objeto con el rol del usuario y helpers de permisos
 * 
 * @example
 * const { role, canEdit, loading } = useUserRole(fcpId)
 * 
 * if (canEdit) {
 *   // Mostrar botones de edición
 * }
 */
export function useUserRole(fcpId: string | null): UseUserRoleResult {
  const [role, setRole] = useState<RolType>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { selectedRole, loading: roleContextLoading } = useSelectedRole()

  useEffect(() => {
    let cancelled = false

    const fetchRole = async () => {
      try {
        setLoading(true)
        setError(null)

        // Si el contexto de rol seleccionado está cargando, esperar
        if (roleContextLoading) {
          return
        }

        // PRIMERO: Intentar usar el rol seleccionado desde el contexto
        if (selectedRole) {
          // Si hay un rol seleccionado y coincide con la FCP actual (o es facilitador del sistema)
          if (selectedRole.fcpId === fcpId || selectedRole.fcpId === null || !fcpId) {
            console.log('✅ useUserRole - Usando rol seleccionado desde contexto:', {
              selectedRole: selectedRole.role,
              fcpId: selectedRole.fcpId,
              requestedFcpId: fcpId
            })
            if (!cancelled) {
              setRole(selectedRole.role)
              setLoading(false)
            }
            return
          }
        }

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

        // Primero verificar si el usuario es facilitador del sistema (fcp_id = NULL)
        // Los facilitadores pueden gestionar todas las FCPs
        const { data: facilitadorSistemaData, error: facilitadorSistemaError } = await supabase
          .from('fcp_miembros')
          .select('rol')
          .eq('usuario_id', user.id)
          .is('fcp_id', null)
          .eq('rol', 'facilitador')
          .eq('activo', true)
          .maybeSingle()

        if (cancelled) return

        // Si es facilitador del sistema, retornar ese rol
        if (facilitadorSistemaData && !facilitadorSistemaError) {
          if (!cancelled) {
            setRole('facilitador')
            setLoading(false)
          }
          return
        }

        // También verificar si el usuario es facilitador en CUALQUIER FCP
        // Esto es necesario porque los facilitadores pueden estar asociados a FCPs específicas
        const { data: facilitadorCualquierFCPData, error: facilitadorCualquierFCPError } = await supabase
          .from('fcp_miembros')
          .select('rol')
          .eq('usuario_id', user.id)
          .eq('rol', 'facilitador')
          .eq('activo', true)
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        // Si es facilitador en alguna FCP, retornar ese rol
        if (facilitadorCualquierFCPData && !facilitadorCualquierFCPError) {
          if (!cancelled) {
            setRole('facilitador')
            setLoading(false)
          }
          return
        }

        // Si no hay fcpId, no podemos obtener el rol específico
        if (!fcpId) {
          if (!cancelled) {
            setRole(null)
            setLoading(false)
          }
          return
        }

        // Si hay un rol seleccionado pero es para otra FCP, verificar si el usuario tiene roles en esta FCP
        // Si el rol seleccionado es para esta FCP, usarlo directamente
        if (selectedRole && selectedRole.fcpId === fcpId) {
          console.log('✅ useUserRole - Usando rol seleccionado para esta FCP:', {
            selectedRole: selectedRole.role,
            fcpId: selectedRole.fcpId
          })
          if (!cancelled) {
            setRole(selectedRole.role)
            setLoading(false)
          }
          return
        }

        // Si no hay rol seleccionado o es para otra FCP, obtener el rol en la FCP específica
        // Usar el rol seleccionado si está disponible, de lo contrario usar el de mayor jerarquía
        const { data: fcpMiembrosData, error: queryError } = await supabase
          .from('fcp_miembros')
          .select('rol')
          .eq('usuario_id', user.id)
          .eq('fcp_id', fcpId)
          .eq('activo', true)
        
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

        // Si hay múltiples roles, usar el rol seleccionado si está disponible para esta FCP
        // De lo contrario, seleccionar el de mayor jerarquía
        if (fcpMiembrosData && fcpMiembrosData.length > 0) {
          const roles = fcpMiembrosData.map((m: { rol: RolType }) => m.rol) as RolTypeUtil[]
          
          // Si hay un rol seleccionado para esta FCP, usarlo
          if (selectedRole && selectedRole.fcpId === fcpId && roles.includes(selectedRole.role)) {
            console.log('✅ useUserRole - Usando rol seleccionado para esta FCP:', {
              selectedRole: selectedRole.role,
              fcpId: selectedRole.fcpId
            })
            if (!cancelled) {
              setRole(selectedRole.role)
            }
          } else {
            // Usar el de mayor jerarquía como fallback
            const highestRole = getHighestPriorityRole(roles)
            
            if (fcpMiembrosData.length > 1) {
              console.log('⚠️ useUserRole - Usando rol de mayor jerarquía como fallback (no hay rol seleccionado para esta FCP):', {
                roles: roles,
                rolSeleccionado: highestRole,
                selectedRoleFromContext: selectedRole
              })
            }

            if (!cancelled) {
              setRole(highestRole)
            }
          }
        } else {
          if (!cancelled) {
            setRole(null)
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
  }, [fcpId, selectedRole, roleContextLoading])

  const isFacilitador = role === 'facilitador'
  const isDirector = role === 'director'
  const isSecretario = role === 'secretario'
  const isTutor = role === 'tutor'
  // Facilitadores NO pueden editar (solo ver)
  const canEdit = isDirector || isSecretario
  const canViewReports = isFacilitador || isDirector || isSecretario

  return {
    role,
    loading,
    error,
    isFacilitador,
    isDirector,
    isSecretario,
    isTutor,
    canEdit,
    canViewReports,
  }
}

