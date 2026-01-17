'use client'

import { useState } from 'react'
import { ReporteList } from '@/components/features/reportes/ReporteList'
import { ReporteAsistenciaPorNivel } from '@/components/features/reportes/ReporteAsistenciaPorNivel'
import { ReporteMensual } from '@/components/features/reportes/ReporteMensual'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

export default function ReportesPage() {
  const [viewType, setViewType] = useState<'general' | 'por-nivel' | 'mensual'>('general')
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])

  useEffect(() => {
    loadUserONGs()
  }, [])

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
      if (ongs.length > 0 && !selectedONG) {
        setSelectedONG(ongs[0].id)
      }
    } catch (error) {
      console.error('Error loading ONGs:', error)
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
      </div>

      {viewType === 'general' ? (
        <ReporteList />
      ) : viewType === 'por-nivel' ? (
        <ReporteAsistenciaPorNivel ongId={selectedONG} />
      ) : (
        <ReporteMensual ongId={selectedONG} />
      )}
    </div>
  )
}

