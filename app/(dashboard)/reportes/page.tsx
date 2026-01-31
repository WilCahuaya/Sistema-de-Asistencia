'use client'

import { useState } from 'react'
import { ReporteList } from '@/components/features/reportes/ReporteList'
import { ReporteAsistenciaPorNivel } from '@/components/features/reportes/ReporteAsistenciaPorNivel'
import { ReporteMensual } from '@/components/features/reportes/ReporteMensual'
import { ReporteParticipantesPorMes } from '@/components/features/reportes/ReporteParticipantesPorMes'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUserRole } from '@/hooks/useUserRole'
import { useSearchParams } from 'next/navigation'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { BarChart3 } from 'lucide-react'

export default function ReportesPage() {
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const { selectedRole } = useSelectedRole()
  const fcpIdParaReporte = selectedRole?.fcpId
  
  const [viewType, setViewType] = useState<'general' | 'por-nivel' | 'mensual' | 'participantes-mes'>(
    (viewParam === 'participantes-mes' || viewParam === 'fcps-por-mes' || viewParam === 'ongs-por-mes') ? 'participantes-mes' :
    viewParam === 'por-nivel' ? 'por-nivel' :
    viewParam === 'mensual' ? 'mensual' :
    'general'
  )
  
  const { isFacilitador, isDirector, isSecretario, isTutor } = useUserRole(fcpIdParaReporte || null)

  // Si es tutor, mostrar mensaje de acceso denegado
  if (isTutor) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
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
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes</h1>
      </div>
      
      <div className="mb-4 sm:mb-6 flex flex-wrap gap-2">
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
        {isFacilitador && (
          <Button
            variant={viewType === 'participantes-mes' ? 'default' : 'outline'}
            onClick={() => setViewType('participantes-mes')}
          >
            FCPs por Meses
          </Button>
        )}
      </div>

      {/* Mostrar información de FCP para directores y secretarios */}
      {(isDirector || isSecretario) && selectedRole?.fcp && (
        <div className="mb-4 p-3 bg-muted border border-border rounded-md">
          <p className="text-sm font-medium text-foreground">
            <strong>PROYECTO:</strong> {selectedRole.fcp.numero_identificacion || ''} {selectedRole.fcp.razon_social || 'FCP'}
          </p>
        </div>
      )}

      {viewType === 'general' ? (
        <ReporteList />
      ) : viewType === 'por-nivel' ? (
        <ReporteAsistenciaPorNivel fcpId={fcpIdParaReporte || null} />
      ) : viewType === 'mensual' ? (
        <ReporteMensual fcpId={fcpIdParaReporte || null} />
      ) : (
        <ReporteParticipantesPorMes fcpId={fcpIdParaReporte || null} />
      )}
    </div>
  )
}

