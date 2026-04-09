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

      // 1. PRIMERO: Obtener rol desde el servidor (cookies). Es la fuente de verdad que usa Dashboard.
      // Las cookies se envían automáticamente en la petición same-origin.
      try {
        const res = await fetch('/api/get-selected-role', { credentials: 'include' })
        if (res.ok) {
          const { role } = await res.json()
          if (role) {
            const roleToSet = {
              roleId: role.roleId,
              role: role.role as RolType,
              fcpId: role.fcpId ?? null,
              fcp: role.fcp
            }
            setSelectedRoleState(roleToSet)
            // Sincronizar a localStorage para consistencia
            localStorage.setItem('selectedRoleId', role.roleId)
            localStorage.setItem('selectedRole', role.role)
            if (role.fcpId) localStorage.setItem('selectedFcpId', role.fcpId)
            else localStorage.removeItem('selectedFcpId')
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.warn('SelectedRoleContext: fallback a localStorage tras error en API:', e)
      }

      // 2. FALLBACK: localStorage (por si la API falla o no hay cookies)
      let savedRoleId = typeof window !== 'undefined' ? localStorage.getItem('selectedRoleId') : null
      let savedRole = (typeof window !== 'undefined' ? localStorage.getItem('selectedRole') : null) as RolType | null
      let savedFcpId = typeof window !== 'undefined' ? localStorage.getItem('selectedFcpId') : null

      if (savedRoleId && savedRole) {
        // Facilitador unificado (facilitador-sistema, fcpId null): validar solo en facilitadores
        if (savedRole === 'facilitador' && (savedRoleId === 'facilitador-sistema' || !savedFcpId)) {
          const { data: facRow } = await supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle()
          if (facRow) {
            const roleToSet = {
              roleId: 'facilitador-sistema',
              role: 'facilitador' as RolType,
              fcpId: null as string | null,
              fcp: { id: '', razon_social: 'Facilitador', numero_identificacion: undefined }
            }
            setSelectedRoleState(roleToSet)
            setLoading(false)
            return
          }
        }
        // Facilitador por FCP (legacy): validar vía facilitadores + fcps (paralelo)
        if (savedRole === 'facilitador' && savedFcpId) {
          const [facRes, fcpRes] = await Promise.all([
            supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle(),
            supabase.from('fcps').select('id, razon_social, numero_identificacion').eq('id', savedFcpId).eq('facilitador_id', user.id).eq('activa', true).maybeSingle()
          ])
          const facRow = facRes.data
          const fcpRow = fcpRes.data
          if (facRow && fcpRow) {
            const roleToSet = {
              roleId: savedRoleId,
              role: 'facilitador' as RolType,
              fcpId: savedFcpId,
              fcp: { id: fcpRow.id, razon_social: fcpRow.razon_social, numero_identificacion: fcpRow.numero_identificacion }
            }
            setSelectedRoleState(roleToSet)
            setLoading(false)
            return
          }
        }

        // Otros roles: validar en fcp_miembros
        const { data: roleData, error } = await supabase
          .from('fcp_miembros')
          .select('id, rol, fcp_id, activo, fcp:fcps(id, razon_social, numero_identificacion)')
          .eq('id', savedRoleId)
          .eq('usuario_id', user.id)
          .eq('activo', true)
          .maybeSingle()

        if (!error && roleData && roleData.activo) {
          const roleToSet = {
            roleId: roleData.id,
            role: roleData.rol as RolType,
            fcpId: roleData.fcp_id,
            fcp: (roleData as any).fcp || undefined
          }
          setSelectedRoleState(roleToSet)
          setLoading(false)
          return
        }
      }

      // Rol guardado no válido o no hay uno guardado; cargar todos y elegir el de mayor jerarquía

      // Obtener todos los roles: facilitador + fcp_miembros en paralelo
      const allRoles: { id: string; rol: RolType; fcp_id: string | null; fcp?: { id: string; razon_social: string; numero_identificacion?: string } }[] = []
      const [facRes, miembrosRes] = await Promise.all([
        supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle(),
        supabase.from('fcp_miembros').select('id, rol, fcp_id, fcp:fcps(id, razon_social, numero_identificacion)').eq('usuario_id', user.id).eq('activo', true).not('fcp_id', 'is', null)
      ])
      const facRow = facRes.data
      const miembrosData = miembrosRes.data
      if (facRow) {
        allRoles.push({
          id: 'facilitador-sistema',
          rol: 'facilitador',
          fcp_id: null,
          fcp: { id: '', razon_social: 'Facilitador', numero_identificacion: undefined }
        })
      }
      for (const m of miembrosData || []) {
        allRoles.push({
          id: m.id,
          rol: m.rol as RolType,
          fcp_id: m.fcp_id,
          fcp: (m as any).fcp || undefined
        })
      }

      if (allRoles.length === 0) {
        setSelectedRoleState(null)
        setLoading(false)
        return
      }
      if (allRoles.length === 1) {
        const r = allRoles[0]
        const roleToSet = { roleId: r.id, role: r.rol, fcpId: r.fcp_id, fcp: r.fcp }
        setSelectedRoleState(roleToSet)
        localStorage.setItem('selectedRoleId', r.id)
        localStorage.setItem('selectedRole', r.rol)
        if (r.fcp_id) localStorage.setItem('selectedFcpId', r.fcp_id)
        setLoading(false)
        return
      }

      // Múltiples roles: NO auto-seleccionar uno de mayor jerarquía.
      // El usuario debe elegir explícitamente en /seleccionar-rol.
      console.log('🔍 SelectedRoleProvider - Usuario con múltiples roles, no se auto-selecciona rol por defecto.', {
        roles: allRoles.map(r => ({
          id: r.id,
          rol: r.rol,
          fcpId: r.fcp_id,
          fcpNombre: r.fcp?.razon_social ?? 'N/A'
        }))
      })

      setSelectedRoleState(null)
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

