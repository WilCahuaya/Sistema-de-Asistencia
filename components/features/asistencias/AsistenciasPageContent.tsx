'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AsistenciaCalendarView } from '@/components/features/asistencias/AsistenciaCalendarView'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AsistenciasPageContent() {
  const searchParams = useSearchParams()
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [loadingFCPs, setLoadingFCPs] = useState(true)
  const { selectedRole } = useSelectedRole()
  const router = useRouter()

  const isDirector = selectedRole?.role === 'director'
  const isSecretario = selectedRole?.role === 'secretario'
  const isFacilitador = selectedRole?.role === 'facilitador'

  useEffect(() => {
    loadUserFCPs()
  }, [selectedRole])

  const fcpIdFromUrl = searchParams.get('fcpId')
  useEffect(() => {
    if (userFCPs.length === 0) return
    const fcpValidaEnUrl = fcpIdFromUrl && userFCPs.some(f => f.id === fcpIdFromUrl) ? fcpIdFromUrl : null
    if (fcpValidaEnUrl) {
      setSelectedFCP(fcpValidaEnUrl)
    } else if (!selectedFCP) {
      setSelectedFCP(userFCPs[0].id)
    }
  }, [userFCPs, fcpIdFromUrl])

  useEffect(() => {
    const aulaIdParam = searchParams.get('aulaId') || searchParams.get('aulald')
    if (aulaIdParam) {
      setSelectedAula(aulaIdParam)
    }
  }, [searchParams])

  const loadUserFCPs = async () => {
    setLoadingFCPs(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingFCPs(false)
        return
      }

      const esFacilitador = selectedRole?.role === 'facilitador'
      let fcps: Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }> = []

      if (selectedRole?.fcpId) {
        const { data: fcpData, error: fcpError } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('id', selectedRole.fcpId)
          .eq('activa', true)
          .maybeSingle()

        if (!fcpError && fcpData) {
          fcps = [{
            id: fcpData.id,
            nombre: fcpData.razon_social || 'FCP',
            numero_identificacion: fcpData.numero_identificacion,
            razon_social: fcpData.razon_social,
          }]
        }
      } else {
        const fcpMap = new Map<string, { id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>()
        if (esFacilitador) {
          const { data: fcpsData } = await supabase.from('fcps').select('id, razon_social, numero_identificacion').eq('facilitador_id', user.id).eq('activa', true)
          if (fcpsData) for (const f of fcpsData) fcpMap.set(f.id, { id: f.id, nombre: f.razon_social || 'FCP', numero_identificacion: f.numero_identificacion, razon_social: f.razon_social })
        } else {
          const { data: memData, error } = await supabase.from('fcp_miembros').select('fcp_id, fcp:fcps(id, razon_social, numero_identificacion)').eq('usuario_id', user.id).eq('activo', true).not('fcp_id', 'is', null)
          if (!error && memData) for (const m of memData) {
            const fcp = Array.isArray((m as any).fcp) ? (m as any).fcp[0] : (m as any).fcp
            if (!fcp?.id) continue
            fcpMap.set(fcp.id, { id: fcp.id, nombre: fcp.razon_social || 'FCP', numero_identificacion: fcp.numero_identificacion, razon_social: fcp.razon_social })
          }
        }
        fcps = Array.from(fcpMap.values())
      }

      setUserFCPs(fcps)
      if (selectedRole?.fcpId && !selectedFCP) {
        setSelectedFCP(selectedRole.fcpId)
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
    } finally {
      setLoadingFCPs(false)
    }
  }

  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')
  const aulaIdFromUrl = searchParams.get('aulaId') || searchParams.get('aulald')
  const monthNum = monthParam != null && monthParam !== '' ? parseInt(monthParam, 10) : NaN
  const yearNum = yearParam != null && yearParam !== '' ? parseInt(yearParam, 10) : NaN
  const initialMonth = !Number.isNaN(monthNum) && monthNum >= 0 && monthNum <= 11 ? monthNum : null
  const initialYear = !Number.isNaN(yearNum) && yearNum >= 2000 && yearNum <= 2100 ? yearNum : null

  if (loadingFCPs) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencias</h1>
        </div>
        <div className="text-center py-8">Cargando asistencia...</div>
      </div>
    )
  }

  if (userFCPs.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencias</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No tienes FCPs asociadas. Primero crea o únete a una FCP.
            </p>
            <Button onClick={() => router.push('/fcps')}>
              Ir a FCPs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-6 sm:px-6 sm:py-8 lg:px-8 overflow-x-auto">
      <div className="mb-4 sm:mb-8 mx-auto max-w-7xl">
        {!isDirector && !isSecretario && userFCPs.length > 1 && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">FCP:</label>
            <Select
              value={selectedFCP || ''}
              onValueChange={(value) => {
                setSelectedFCP(value)
                setSelectedAula(null)
              }}
            >
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Seleccionar FCP">
                  {selectedFCP ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span className="truncate">{userFCPs.find(fcp => fcp.id === selectedFCP)?.nombre || 'Seleccionar FCP'}</span>
                    </div>
                  ) : (
                    'Seleccionar FCP'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {userFCPs.map((fcp) => (
                  <SelectItem key={fcp.id} value={fcp.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{fcp.nombre}</span>
                      {fcp.numero_identificacion && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">({fcp.numero_identificacion})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencias</h1>
      </div>

      {(isDirector || isSecretario) && selectedFCP && userFCPs.length > 0 && (() => {
        const fcp = userFCPs.find(fcp => fcp.id === selectedFCP)
        return (
          <div className="mb-4 p-3 bg-muted border border-border rounded-md mx-auto max-w-7xl">
            <p className="text-sm font-medium text-foreground">
              <strong>PROYECTO:</strong> {fcp?.numero_identificacion || ''} {fcp?.razon_social || 'FCP'}
            </p>
          </div>
        )
      })()}

      {selectedFCP && (
        <AsistenciaCalendarView
          fcpId={selectedFCP}
          aulaId={selectedAula || aulaIdFromUrl}
          initialMonth={initialMonth}
          initialYear={initialYear}
        />
      )}
    </div>
  )
}
