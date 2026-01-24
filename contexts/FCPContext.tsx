'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { getRolPriority } from '@/lib/utils/roles'

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

      // Verificar si el usuario es facilitador en alguna FCP (excluyendo facilitadores del sistema)
      const { data: facilitadorData } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .not('fcp_id', 'is', null)  // Excluir facilitadores del sistema
        .limit(1)
        .maybeSingle()

      const isFacilitadorUser = !!facilitadorData
      setIsFacilitador(isFacilitadorUser)

      let fcps: FCPInfo[] = []

      // Todos los usuarios (incluidos facilitadores) solo ven las FCPs donde tienen roles asignados
      // Excluir facilitadores del sistema (fcp_id = null)
      const { data: fcpMiembrosData, error } = await supabase
          .from('fcp_miembros')
          .select(`
            id,
            rol,
            fcp:fcps(
              id,
              razon_social,
              numero_identificacion
            )
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)
          .not('fcp_id', 'is', null)  // Excluir facilitadores del sistema
          .order('created_at', { ascending: true })

      if (error) throw error

      // Mapear y deduplicar FCPs (si un usuario tiene múltiples roles en la misma FCP, solo mostrar una entrada)
      const fcpMap = new Map<string, FCPInfo>()
      
      for (const miembro of fcpMiembrosData || []) {
        if (!miembro.fcp) continue // Filtrar FCPs eliminadas
        
        const fcpId = miembro.fcp.id
        
        // Si la FCP ya existe en el mapa, usar el rol de mayor jerarquía
        if (fcpMap.has(fcpId)) {
          const existingFCP = fcpMap.get(fcpId)!
          const existingRolPriority = getRolPriority(existingFCP.rol || null)
          const newRolPriority = getRolPriority(miembro.rol)
          
          // Si el nuevo rol tiene mayor jerarquía, actualizar
          if (newRolPriority > existingRolPriority) {
            fcpMap.set(fcpId, {
              id: fcpId,
              nombre: miembro.fcp.razon_social || miembro.fcp.numero_identificacion || fcpId,
              razon_social: miembro.fcp.razon_social,
              numero_identificacion: miembro.fcp.numero_identificacion,
              rol: miembro.rol
            })
          }
        } else {
          // Primera vez que vemos esta FCP
          fcpMap.set(fcpId, {
            id: fcpId,
            nombre: miembro.fcp.razon_social || miembro.fcp.numero_identificacion || fcpId,
            razon_social: miembro.fcp.razon_social,
            numero_identificacion: miembro.fcp.numero_identificacion,
            rol: miembro.rol
          })
        }
      }
      
      fcps = Array.from(fcpMap.values())

      setUserFCPs(fcps)

      // Si hay un parámetro fcp en la URL, usarlo
      const fcpParam = searchParams.get('fcp') || searchParams.get('ong')
      if (fcpParam && fcps.some(fcp => fcp.id === fcpParam)) {
        setSelectedFCPState(fcpParam)
      } else if (fcps.length > 0 && !selectedFCP) {
        // Si no hay FCP seleccionada y hay FCPs disponibles, seleccionar la primera
        setSelectedFCPState(fcps[0].id)
      }
    } catch (error) {
      console.error('Error loading user FCPs:', error)
      setUserFCPs([])
    } finally {
      setLoading(false)
    }
  }, [searchParams, selectedFCP])

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

