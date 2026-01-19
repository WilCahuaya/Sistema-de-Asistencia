'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AsistenciaCalendarView } from '@/components/features/asistencias/AsistenciaCalendarView'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'

export default function AsistenciasPage() {
  const searchParams = useSearchParams()
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string }>>([])

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
          id: item.fcp?.id,
          nombre: item.fcp?.razon_social || 'FCP',
        })).filter((fcp: any) => fcp.id) || []
      }

      setUserFCPs(fcps)
    } catch (error) {
      console.error('Error loading FCPs:', error)
    }
  }

  if (userFCPs.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Asistencias</h1>
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
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Asistencias</h1>

      {userFCPs.length > 1 && (
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">FCP:</label>
          <select
            value={selectedFCP || ''}
            onChange={(e) => {
              setSelectedFCP(e.target.value)
              setSelectedAula(null)
            }}
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

