'use client'

import { useState, useEffect } from 'react'
import { ReporteList } from '@/components/features/reportes/ReporteList'
import { ReporteAsistenciaPorNivel } from '@/components/features/reportes/ReporteAsistenciaPorNivel'
import { ReporteMensual } from '@/components/features/reportes/ReporteMensual'
import { ReporteParticipantesPorMes } from '@/components/features/reportes/ReporteParticipantesPorMes'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUserRole } from '@/hooks/useUserRole'
import { useSearchParams } from 'next/navigation'
import { useFCP } from '@/contexts/FCPContext'
import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function ReportesPage() {
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const { selectedFCP, userFCPs, setSelectedFCP } = useFCP()
  
  const [viewType, setViewType] = useState<'general' | 'por-nivel' | 'mensual' | 'participantes-mes'>(
    (viewParam === 'participantes-mes' || viewParam === 'fcps-por-mes' || viewParam === 'ongs-por-mes') ? 'participantes-mes' :
    viewParam === 'por-nivel' ? 'por-nivel' :
    viewParam === 'mensual' ? 'mensual' :
    'general'
  )
  
  const { isFacilitador, isDirector, isSecretario, isTutor } = useUserRole(selectedFCP)
  
  // Verificar si es facilitador independientemente de selectedFCP
  const [isFacilitadorGlobal, setIsFacilitadorGlobal] = useState(false)
  
  useEffect(() => {
    const checkFacilitador = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Verificar si el usuario es facilitador en cualquier FCP
        const { data: facilitadorData, error } = await supabase
          .from('fcp_miembros')
          .select('rol')
          .eq('usuario_id', user.id)
          .eq('rol', 'facilitador')
          .eq('activo', true)
          .limit(1)
          .maybeSingle()

        if (!error && facilitadorData) {
          setIsFacilitadorGlobal(true)
        } else {
          setIsFacilitadorGlobal(false)
        }
      } catch (error) {
        console.error('Error checking facilitador:', error)
        setIsFacilitadorGlobal(false)
      }
    }
    
    checkFacilitador()
  }, [])

  // Si es tutor, mostrar mensaje de acceso denegado
  if (isTutor) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              No tienes permisos para ver reportes. Solo los facilitadores, directores y secretarios pueden acceder a esta funcionalidad.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
      </div>
      
      <div className="mb-6 flex gap-2">
        <Button
          variant={viewType === 'general' ? 'default' : 'outline'}
          onClick={() => setViewType('general')}
        >
          Reporte General
        </Button>
        <Button
          variant={viewType === 'por-nivel' ? 'default' : 'outline'}
          onClick={() => setViewType('por-nivel')}
        >
          Reporte por Nivel
        </Button>
        <Button
          variant={viewType === 'mensual' ? 'default' : 'outline'}
          onClick={() => setViewType('mensual')}
        >
          Reporte Mensual
        </Button>
        {(isFacilitador || isFacilitadorGlobal) && (
          <Button
            variant={viewType === 'participantes-mes' ? 'default' : 'outline'}
            onClick={() => setViewType('participantes-mes')}
          >
            FCPs por Meses
          </Button>
        )}
      </div>

      {/* Selector de FCP - Se muestra para facilitadores, cuando no hay FCP seleccionada, o cuando hay múltiples FCPs */}
      {userFCPs.length > 0 && viewType !== 'participantes-mes' && 
       ((isFacilitador || isFacilitadorGlobal) || !selectedFCP || userFCPs.length > 1) && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label htmlFor="fcp-select" className="text-sm font-medium">
                Seleccionar FCP:
              </Label>
              <Select
                value={selectedFCP || ''}
                onValueChange={(value) => setSelectedFCP(value)}
              >
                <SelectTrigger id="fcp-select" className="w-[300px]">
                  <SelectValue placeholder="Selecciona una FCP">
                    {selectedFCP ? (() => {
                      const fcp = userFCPs.find(f => f.id === selectedFCP)
                      return fcp ? `${fcp.numero_identificacion || ''} ${fcp.razon_social || fcp.nombre}`.trim() : 'Selecciona una FCP'
                    })() : 'Selecciona una FCP'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {userFCPs.map((fcp) => (
                    <SelectItem key={fcp.id} value={fcp.id}>
                      {fcp.numero_identificacion || ''} {fcp.razon_social || fcp.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mostrar información de FCP para directores y secretarios */}
      {(isDirector || isSecretario) && selectedFCP && userFCPs.length > 0 && (() => {
        const fcp = userFCPs.find(fcp => fcp.id === selectedFCP)
        return (
          <div className="mb-4 p-3 bg-muted border border-border rounded-md">
            <p className="text-sm font-medium text-foreground">
              <strong>PROYECTO:</strong> {fcp?.numero_identificacion || ''} {fcp?.razon_social || 'FCP'}
            </p>
          </div>
        )
      })()}

      {viewType === 'general' ? (
        <ReporteList />
      ) : viewType === 'por-nivel' ? (
        <ReporteAsistenciaPorNivel fcpId={selectedFCP} />
      ) : viewType === 'mensual' ? (
        <ReporteMensual fcpId={selectedFCP} />
      ) : (
        <ReporteParticipantesPorMes fcpId={selectedFCP} />
      )}
    </div>
  )
}

