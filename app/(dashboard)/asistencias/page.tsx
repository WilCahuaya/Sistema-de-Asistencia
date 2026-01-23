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

export default function AsistenciasPage() {
  const searchParams = useSearchParams()
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [isDirector, setIsDirector] = useState(false)
  const [isSecretario, setIsSecretario] = useState(false)

  useEffect(() => {
    loadUserFCPs()
  }, [])

  useEffect(() => {
    if (userFCPs.length > 0 && !selectedFCP) {
      setSelectedFCP(userFCPs[0].id)
    }
  }, [userFCPs])

  // Leer parámetros de URL al cargar la página
  useEffect(() => {
    const aulaIdParam = searchParams.get('aulaId')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    
    if (aulaIdParam) {
      setSelectedAula(aulaIdParam)
    }
    
    // Los parámetros month y year se pasarán al componente AsistenciaCalendarView
    // pero no se necesitan aquí, el componente los manejará internamente
  }, [searchParams])

  const loadUserFCPs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el usuario es facilitador
      const { data: facilitadorData, error: facilitadorError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (facilitadorError) throw facilitadorError

      const esFacilitador = facilitadorData && facilitadorData.length > 0

      // Verificar si el usuario es director
      const { data: directorData, error: directorError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'director')
        .eq('activo', true)
        .limit(1)

      if (!directorError && directorData && directorData.length > 0) {
        setIsDirector(true)
      }

      // Verificar si el usuario es secretario
      const { data: secretarioData, error: secretarioError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'secretario')
        .eq('activo', true)
        .limit(1)

      if (!secretarioError && secretarioData && secretarioData.length > 0) {
        setIsSecretario(true)
      }

      let fcps: Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }> = []

      if (esFacilitador) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPs, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        fcps = (todasLasFCPs || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP',
          numero_identificacion: fcp.numero_identificacion,
          razon_social: fcp.razon_social,
        }))
      } else {
        // Usuarios no facilitadores solo ven sus FCPs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social, numero_identificacion)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        fcps = data?.map((item: any) => ({
          id: item.fcp?.id,
          nombre: item.fcp?.razon_social || 'FCP',
          numero_identificacion: item.fcp?.numero_identificacion,
          razon_social: item.fcp?.razon_social,
        })).filter((fcp: any) => fcp.id) || []
      }

      setUserFCPs(fcps)
    } catch (error) {
      console.error('Error loading FCPs:', error)
    }
  }

  if (userFCPs.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Asistencias</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No tienes FCPs asociadas. Primero crea o únete a una FCP.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8 overflow-x-auto">
      <div className="mb-8 mx-auto max-w-7xl">
        {/* El selector de FCP no se muestra para directores ni secretarios, solo ven su FCP asignada */}
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

        <h1 className="text-3xl font-bold text-foreground">Asistencias</h1>
      </div>

      {/* Mostrar información de FCP para directores y secretarios */}
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
          aulaId={selectedAula || searchParams.get('aulaId')}
          initialMonth={searchParams.get('month') ? parseInt(searchParams.get('month')!) : null}
          initialYear={searchParams.get('year') ? parseInt(searchParams.get('year')!) : null}
        />
      )}
    </div>
  )
}

