'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { getRolPriority } from '@/lib/utils/roles'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'

export interface FCPInfo {
  id: string
  nombre: string
  razon_social?: string
  numero_identificacion?: string
  rol?: string
}

interface FCPContextType {
  selectedFCP: string | null
  userFCPs: FCPInfo[]
  loading: boolean
  setSelectedFCP: (fcpId: string | null) => void
  loadUserFCPs: () => Promise<void>
  isFacilitador: boolean
}

const FCPContext = createContext<FCPContextType | undefined>(undefined)

export function FCPProvider({ children }: { children: React.ReactNode }) {
  const [selectedFCP, setSelectedFCPState] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<FCPInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [isFacilitador, setIsFacilitador] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { selectedRole } = useSelectedRole()

  const loadUserFCPs = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setUserFCPs([])
        setLoading(false)
        return
      }

      // Facilitador: tabla facilitadores. Puede tener además director/secretario/tutor en fcp_miembros.
      const { data: facilitadorRow } = await supabase
        .from('facilitadores')
        .select('usuario_id')
        .eq('usuario_id', user.id)
        .maybeSingle()

      const isFacilitadorUser = !!facilitadorRow
      setIsFacilitador(isFacilitadorUser)

      const fcpMap = new Map<string, FCPInfo>()

      // FCPs como facilitador (fcps.facilitador_id)
      if (isFacilitadorUser) {
        const { data: fcpsData, error: fcpsErr } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('facilitador_id', user.id)
          .order('razon_social', { ascending: true })
        if (!fcpsErr && fcpsData) {
          for (const f of fcpsData) {
            fcpMap.set(f.id, {
              id: f.id,
              nombre: f.razon_social || f.numero_identificacion || f.id,
              razon_social: f.razon_social,
              numero_identificacion: f.numero_identificacion,
              rol: 'facilitador',
            })
          }
        }
      }

      // FCPs como miembro (director, secretario, tutor). Se unen; si la FCP ya existe, se conserva el rol de mayor prioridad.
      const { data: fcpMiembrosData, error } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          rol,
          fcp:fcps(id, razon_social, numero_identificacion)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .not('fcp_id', 'is', null)
        .order('created_at', { ascending: true })

      if (!error && fcpMiembrosData) {
        for (const miembro of fcpMiembrosData) {
          if (!miembro.fcp) continue
          const fcpId = miembro.fcp.id
          const existing = fcpMap.get(fcpId)
          const useNew = !existing || getRolPriority(miembro.rol) > getRolPriority(existing.rol || null)
          if (useNew) {
            fcpMap.set(fcpId, {
              id: fcpId,
              nombre: miembro.fcp.razon_social || miembro.fcp.numero_identificacion || fcpId,
              razon_social: miembro.fcp.razon_social,
              numero_identificacion: miembro.fcp.numero_identificacion,
              rol: miembro.rol,
            })
          }
        }
      }

      let fcps = Array.from(fcpMap.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))

      // Filtrar por rol seleccionado: toda la app se enfoca en ese rol
      if (selectedRole) {
        if (selectedRole.role === 'facilitador') {
          fcps = fcps.filter(f => f.rol === 'facilitador')
        } else if (selectedRole.fcpId) {
          const sole = fcps.find(f => f.id === selectedRole.fcpId)
          fcps = sole ? [sole] : []
        }
      }

      setUserFCPs(fcps)

      const fcpParam = searchParams.get('fcp') || searchParams.get('ong')
      if (fcpParam && fcps.some(fcp => fcp.id === fcpParam)) {
        setSelectedFCPState(fcpParam)
      } else if (selectedRole?.fcpId && fcps.some(f => f.id === selectedRole.fcpId)) {
        setSelectedFCPState(selectedRole.fcpId)
      } else if (fcps.length > 0) {
        setSelectedFCPState(fcps[0].id)
      } else {
        setSelectedFCPState(null)
      }
    } catch (error) {
      console.error('Error loading user FCPs:', error)
      setUserFCPs([])
    } finally {
      setLoading(false)
    }
  }, [searchParams, selectedRole])

  const setSelectedFCP = useCallback((fcpId: string | null) => {
    setSelectedFCPState(fcpId)
    
    // Actualizar URL si estamos en una página que soporta el parámetro fcp
    const currentFcp = searchParams.get('fcp') || searchParams.get('ong')
    if (fcpId !== currentFcp) {
      const params = new URLSearchParams(searchParams.toString())
      if (fcpId) {
        params.set('fcp', fcpId)
      } else {
        params.delete('fcp')
        params.delete('ong')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [searchParams, router, pathname])

  useEffect(() => {
    loadUserFCPs()
  }, [loadUserFCPs])

  // Re-filtrar y actualizar selección cuando cambia el rol seleccionado
  useEffect(() => {
    if (loading || userFCPs.length === 0) return
    if (selectedRole?.fcpId && userFCPs.some(f => f.id === selectedRole.fcpId) && selectedFCP !== selectedRole.fcpId) {
      setSelectedFCPState(selectedRole.fcpId)
    }
  }, [selectedRole?.role, selectedRole?.fcpId, userFCPs, selectedFCP, loading])

  // Sincronizar con parámetro de URL cuando cambia
  useEffect(() => {
    const fcpParam = searchParams.get('fcp') || searchParams.get('ong')
    if (fcpParam && fcpParam !== selectedFCP && userFCPs.some(fcp => fcp.id === fcpParam)) {
      setSelectedFCPState(fcpParam)
    }
  }, [searchParams, selectedFCP, userFCPs])

  return (
    <FCPContext.Provider
      value={{
        selectedFCP,
        userFCPs,
        loading,
        setSelectedFCP,
        loadUserFCPs,
        isFacilitador,
      }}
    >
      {children}
    </FCPContext.Provider>
  )
}

export function useFCP() {
  const context = useContext(FCPContext)
  if (context === undefined) {
    throw new Error('useFCP must be used within a FCPProvider')
  }
  return context
}

