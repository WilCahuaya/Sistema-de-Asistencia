'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AsistenciaCalendarView } from '@/components/features/asistencias/AsistenciaCalendarView'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'

export default function AsistenciasPage() {
  const searchParams = useSearchParams()
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])

  useEffect(() => {
    loadUserONGs()
  }, [])

  useEffect(() => {
    if (userONGs.length > 0 && !selectedONG) {
      setSelectedONG(userONGs[0].id)
    }
  }, [userONGs])

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

  const loadUserONGs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          ong_id,
          ong:ongs(id, nombre)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (error) throw error

      const ongs = data?.map((item: any) => ({
        id: item.ong.id,
        nombre: item.ong.nombre,
      })) || []

      setUserONGs(ongs)
    } catch (error) {
      console.error('Error loading ONGs:', error)
    }
  }

  if (userONGs.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Asistencias</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No tienes ONGs asociadas. Primero crea o únete a una ONG.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Asistencias</h1>

      {userONGs.length > 1 && (
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">ONG:</label>
          <select
            value={selectedONG || ''}
            onChange={(e) => {
              setSelectedONG(e.target.value)
              setSelectedAula(null)
            }}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            {userONGs.map((ong) => (
              <option key={ong.id} value={ong.id}>
                {ong.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedONG && (
        <AsistenciaCalendarView
          ongId={selectedONG}
          aulaId={selectedAula || searchParams.get('aulaId')}
          initialMonth={searchParams.get('month') ? parseInt(searchParams.get('month')!) : null}
          initialYear={searchParams.get('year') ? parseInt(searchParams.get('year')!) : null}
        />
      )}
    </div>
  )
}

