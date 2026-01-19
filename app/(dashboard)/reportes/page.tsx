'use client'

import { useState } from 'react'
import { ReporteList } from '@/components/features/reportes/ReporteList'
import { ReporteAsistenciaPorNivel } from '@/components/features/reportes/ReporteAsistenciaPorNivel'
import { ReporteMensual } from '@/components/features/reportes/ReporteMensual'
import { ReporteParticipantesPorMes } from '@/components/features/reportes/ReporteParticipantesPorMes'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import { useSearchParams } from 'next/navigation'

export default function ReportesPage() {
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const ongParam = searchParams.get('ong')
  
  const [viewType, setViewType] = useState<'general' | 'por-nivel' | 'mensual' | 'participantes-mes'>(
    (viewParam === 'participantes-mes' || viewParam === 'ongs-por-mes') ? 'participantes-mes' :
    viewParam === 'por-nivel' ? 'por-nivel' :
    viewParam === 'mensual' ? 'mensual' :
    'general'
  )
  const [selectedFCP, setSelectedFCP] = useState<string | null>(ongParam || null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string }>>([])
  const { isFacilitador } = useUserRole(selectedFCP)

  useEffect(() => {
    loadUserFCPs()
  }, [])

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

      let fcps: Array<{ id: string; nombre: string }> = []

      if (esFacilitador) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPs, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        fcps = (todasLasFCPs || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP',
        }))
      } else {
        // Usuarios no facilitadores solo ven sus FCPs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        fcps = data?.map((item: any) => ({
          id: item.fcp.id,
          nombre: item.fcp.razon_social,
        })) || []
      }

      setUserFCPs(fcps)
      if (fcps.length > 0 && !selectedFCP) {
        setSelectedFCP(fcps[0].id)
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Reportes</h1>
      
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
        {isFacilitador && (
          <Button
            variant={viewType === 'participantes-mes' ? 'default' : 'outline'}
            onClick={() => setViewType('participantes-mes')}
          >
            FCPs por Mes
          </Button>
        )}
      </div>

      {/* Selector de FCP para facilitadores en reportes que requieren FCP */}
      {(isFacilitador && (viewType === 'por-nivel' || viewType === 'mensual')) && userFCPs.length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Seleccionar FCP:</label>
          <select
            value={selectedFCP || ''}
            onChange={(e) => setSelectedFCP(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            {userFCPs.map((fcp) => (
              <option key={fcp.id} value={fcp.id}>
                {fcp.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

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

