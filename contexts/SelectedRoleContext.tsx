'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHighestPriorityRole, type RolType } from '@/lib/utils/roles'

interface SelectedRole {
  roleId: string
  role: RolType
  fcpId: string | null
  fcp?: {
    id: string
    razon_social: string
    numero_identificacion?: string
  }
}

interface SelectedRoleContextType {
  selectedRole: SelectedRole | null
  loading: boolean
  setSelectedRole: (role: SelectedRole | null) => void
  refreshSelectedRole: () => Promise<void>
}

const SelectedRoleContext = createContext<SelectedRoleContextType | undefined>(undefined)

export function SelectedRoleProvider({ children }: { children: ReactNode }) {
  const [selectedRole, setSelectedRoleState] = useState<SelectedRole | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSelectedRole = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setSelectedRoleState(null)
        setLoading(false)
        return
      }

      // Verificar si hay un rol seleccionado en localStorage
      const savedRoleId = localStorage.getItem('selectedRoleId')
      const savedRole = localStorage.getItem('selectedRole') as RolType | null
      const savedFcpId = localStorage.getItem('selectedFcpId')

      if (savedRoleId && savedRole) {
        // Verificar que el rol seleccionado todavía existe y está activo
        const { data: roleData, error } = await supabase
          .from('fcp_miembros')
          .select(`
            id,
            rol,
            fcp_id,
            activo,
            fcp:fcps(
              id,
              razon_social,
              numero_identificacion
            )
          `)
          .eq('id', savedRoleId)
          .eq('usuario_id', user.id)
          .eq('activo', true)
          .maybeSingle()

        if (!error && roleData && roleData.activo) {
          const roleToSet = {
            roleId: roleData.id,
            role: roleData.rol as RolType,
            fcpId: roleData.fcp_id,
            fcp: roleData.fcp || undefined
          }
          console.log('👤 [SelectedRoleContext] Rol cargado desde localStorage:', {
            roleId: roleToSet.roleId,
            role: roleToSet.role,
            fcpId: roleToSet.fcpId,
            fcpNombre: roleToSet.fcp?.razon_social || 'N/A',
            usuario: user.email
          })
          setSelectedRoleState(roleToSet)
          setLoading(false)
          return
        }
      }

      // Si no hay rol seleccionado o el rol seleccionado ya no es válido,
      // obtener todos los roles y seleccionar el de mayor jerarquía
      const { data: allRolesData, error: allRolesError } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          rol,
          fcp_id,
          fcp:fcps(
            id,
            razon_social,
            numero_identificacion
          )
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (allRolesError || !allRolesData || allRolesData.length === 0) {
        setSelectedRoleState(null)
        setLoading(false)
        return
      }

      // Si solo tiene un rol, seleccionarlo automáticamente
      if (allRolesData.length === 1) {
        const singleRole = allRolesData[0]
        const roleToSet = {
          roleId: singleRole.id,
          role: singleRole.rol as RolType,
          fcpId: singleRole.fcp_id,
          fcp: singleRole.fcp || undefined
        }
        console.log('👤 [SelectedRoleContext] Usuario con un solo rol, seleccionado automáticamente:', {
          roleId: roleToSet.roleId,
          role: roleToSet.role,
          fcpId: roleToSet.fcpId,
          fcpNombre: roleToSet.fcp?.razon_social || 'N/A',
          usuario: user.email
        })
        setSelectedRoleState(roleToSet)
        // Guardar en localStorage
        localStorage.setItem('selectedRoleId', singleRole.id)
        localStorage.setItem('selectedRole', singleRole.rol)
        if (singleRole.fcp_id) {
          localStorage.setItem('selectedFcpId', singleRole.fcp_id)
        }
        setLoading(false)
        return
      }

      // Si tiene múltiples roles, usar el de mayor jerarquía como predeterminado
      const roles = allRolesData.map(r => r.rol) as RolType[]
      const highestRole = getHighestPriorityRole(roles)
      const highestRoleData = allRolesData.find(r => r.rol === highestRole)

      if (highestRoleData) {
        const roleToSet = {
          roleId: highestRoleData.id,
          role: highestRoleData.rol as RolType,
          fcpId: highestRoleData.fcp_id,
          fcp: highestRoleData.fcp || undefined
        }
        console.log('👤 [SelectedRoleContext] Usuario con múltiples roles, usando el de mayor jerarquía:', {
          roleId: roleToSet.roleId,
          role: roleToSet.role,
          fcpId: roleToSet.fcpId,
          fcpNombre: roleToSet.fcp?.razon_social || 'N/A',
          todosLosRoles: roles,
          rolSeleccionado: highestRole,
          usuario: user.email
        })
        setSelectedRoleState(roleToSet)
        // Guardar en localStorage
        localStorage.setItem('selectedRoleId', highestRoleData.id)
        localStorage.setItem('selectedRole', highestRoleData.rol)
        if (highestRoleData.fcp_id) {
          localStorage.setItem('selectedFcpId', highestRoleData.fcp_id)
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading selected role:', err)
      setSelectedRoleState(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSelectedRole()
  }, [])

  const setSelectedRole = async (role: SelectedRole | null) => {
    console.log('👤 [SelectedRoleContext] Cambiando rol seleccionado:', {
      roleId: role?.roleId || null,
      role: role?.role || null,
      fcpId: role?.fcpId || null,
      fcpNombre: role?.fcp?.razon_social || 'N/A'
    })
    setSelectedRoleState(role)
    if (role) {
      localStorage.setItem('selectedRoleId', role.roleId)
      localStorage.setItem('selectedRole', role.role)
      if (role.fcpId) {
        localStorage.setItem('selectedFcpId', role.fcpId)
      } else {
        localStorage.removeItem('selectedFcpId')
      }

      // También establecer en cookies para que el servidor pueda leerlo
      try {
        await fetch('/api/set-selected-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roleId: role.roleId,
            role: role.role,
            fcpId: role.fcpId
          })
        })
        console.log('✅ [SelectedRoleContext] Rol guardado en cookies correctamente')
      } catch (err) {
        console.error('❌ [SelectedRoleContext] Error setting selected role cookie:', err)
      }
    } else {
      console.log('👤 [SelectedRoleContext] Rol eliminado (null)')
      localStorage.removeItem('selectedRoleId')
      localStorage.removeItem('selectedRole')
      localStorage.removeItem('selectedFcpId')
    }
  }

  return (
    <SelectedRoleContext.Provider
      value={{
        selectedRole,
        loading,
        setSelectedRole,
        refreshSelectedRole: loadSelectedRole
      }}
    >
      {children}
    </SelectedRoleContext.Provider>
  )
}

export function useSelectedRole() {
  const context = useContext(SelectedRoleContext)
  if (context === undefined) {
    throw new Error('useSelectedRole must be used within a SelectedRoleProvider')
  }
  return context
}

