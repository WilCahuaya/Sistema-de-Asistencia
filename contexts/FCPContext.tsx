'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

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

      // Verificar si el usuario es facilitador del sistema
      const { data: facilitadorData } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .is('fcp_id', null)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .maybeSingle()

      const isFacilitadorUser = !!facilitadorData
      setIsFacilitador(isFacilitadorUser)

      if (isFacilitadorUser) {
        // Facilitadores pueden ver todas las FCPs activas
        const { data: todasLasFCPs, error } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('activa', true)
          .order('razon_social', { ascending: true })

        if (error) throw error

        fcps = (todasLasFCPs || []).map(fcp => ({
          id: fcp.id,
          nombre: fcp.razon_social || fcp.numero_identificacion || fcp.id,
          razon_social: fcp.razon_social,
          numero_identificacion: fcp.numero_identificacion,
          rol: 'facilitador'
        }))
      } else {
        // Usuarios normales solo ven sus FCPs
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
          .order('created_at', { ascending: true })

        if (error) throw error

        fcps = (fcpMiembrosData || [])
          .filter((miembro: any) => miembro.fcp) // Filtrar FCPs eliminadas
          .map((miembro: any) => ({
            id: miembro.fcp.id,
            nombre: miembro.fcp.razon_social || miembro.fcp.numero_identificacion || miembro.fcp.id,
            razon_social: miembro.fcp.razon_social,
            numero_identificacion: miembro.fcp.numero_identificacion,
            rol: miembro.rol
          }))
      }

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

