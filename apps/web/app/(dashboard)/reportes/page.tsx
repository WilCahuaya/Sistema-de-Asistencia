'use client'

import { Suspense, useEffect, useState } from 'react'
import { ReporteList } from '@/components/features/reportes/ReporteList'
import { ReporteAsistenciaPorNivel } from '@/components/features/reportes/ReporteAsistenciaPorNivel'
import { ReporteMensual } from '@/components/features/reportes/ReporteMensual'
import { ReporteParticipantesPorMes } from '@/components/features/reportes/ReporteParticipantesPorMes'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useUserRole } from '@/hooks/useUserRole'
import { useSearchParams } from 'next/navigation'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AulaTipo } from '@/lib/utils/aulaIntervencion'
import { SEGMENT_AULA_TIPO } from '@/lib/utils/aulaIntervencion'

function ReportesPageContent() {
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
  const [tipoAula, setTipoAula] = useState<AulaTipo>('REGULAR')
  
  const { isFacilitador, isDirector, isSecretario, isTutor } = useUserRole(fcpIdParaReporte || null)
  const [tutorAulaIds, setTutorAulaIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!isTutor || !fcpIdParaReporte) {
      setTutorAulaIds(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: miembros } = await supabase
        .from('fcp_miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('fcp_id', fcpIdParaReporte)
        .eq('rol', 'tutor')
        .eq('activo', true)
      const mids = miembros?.map((m) => m.id) ?? []
      if (mids.length === 0) {
        if (!cancelled) setTutorAulaIds([])
        return
      }
      const { data: ta } = await supabase
        .from('tutor_aula')
        .select('aula_id')
        .in('fcp_miembro_id', mids)
        .eq('activo', true)
      if (cancelled) return
      const ids = [...new Set((ta ?? []).map((t) => t.aula_id).filter(Boolean) as string[])]
      setTutorAulaIds(ids)
    })()
    return () => {
      cancelled = true
    }
  }, [isTutor, fcpIdParaReporte])

  if (isTutor) {
    if (tutorAulaIds === null) {
      return (
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="text-center py-12 text-muted-foreground">Cargando reportes de tu salón…</div>
        </div>
      )
    }
    if (tutorAulaIds.length === 0) {
      return (
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center max-w-md">
                No tienes un salón asignado como tutor en este proyecto, o la asignación está inactiva. Cuando te asignen un salón, aquí verás el reporte de asistencia de ese salón.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes de mi salón</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Asistencia del o los salones donde eres tutor en esta FCP (reporte mensual).
          </p>
        </div>
        {selectedRole?.fcp && (
          <div className="mb-4 p-3 bg-muted border border-border rounded-md">
            <p className="text-sm font-medium text-foreground">
              <strong>PROYECTO:</strong> {selectedRole.fcp.numero_identificacion || ''} {selectedRole.fcp.razon_social || 'FCP'}
            </p>
          </div>
        )}
        <ReporteMensual fcpId={fcpIdParaReporte ?? null} soloAulasIds={tutorAulaIds} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes</h1>
      </div>
      
      <div className="mb-4 sm:mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
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
        {viewType !== 'participantes-mes' && (
          <SegmentedControl
            value={tipoAula}
            onChange={setTipoAula}
            options={SEGMENT_AULA_TIPO}
          />
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
        <ReporteList tipoAula={tipoAula} />
      ) : viewType === 'por-nivel' ? (
        <ReporteAsistenciaPorNivel fcpId={fcpIdParaReporte || null} tipoAula={tipoAula} />
      ) : viewType === 'mensual' ? (
        <ReporteMensual fcpId={fcpIdParaReporte || null} tipoAula={tipoAula} />
      ) : (
        <ReporteParticipantesPorMes fcpId={fcpIdParaReporte || null} />
      )}
    </div>
  )
}

export default function ReportesPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes</h1>
        </div>
        <div className="text-center py-8">Cargando reportes...</div>
      </div>
    }>
      <ReportesPageContent />
    </Suspense>
  )
}

