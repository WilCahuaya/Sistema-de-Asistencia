'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  fcpId?: string | null
}

export function IntervencionesPendientesBanner({ fcpId }: Props) {
  const [items, setItems] = useState<Array<{ id: string; nombre: string; codigo_aula?: string | null; fecha_fin?: string | null }>>([])

  useEffect(() => {
    if (!fcpId) {
      setItems([])
      return
    }
    const load = async () => {
      const supabase = createClient()
      const hoy = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('aulas')
        .select('id, nombre, codigo_aula, fecha_fin')
        .eq('fcp_id', fcpId)
        .eq('tipo', 'INTERVENTION')
        .eq('estado_intervencion', 'ACTIVA')
        .eq('activa', true)
        .not('fecha_fin', 'is', null)
        .lt('fecha_fin', hoy)
      setItems(data || [])
    }
    load()
  }, [fcpId])

  if (items.length === 0) return null

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {items.length} intervención(es) con temporada finalizada — pendiente de cierre
          </p>
          <ul className="mt-2 text-sm text-amber-800 dark:text-amber-300 space-y-1">
            {items.slice(0, 5).map((i) => (
              <li key={i.id}>
                {i.nombre}
                {i.codigo_aula && ` (${i.codigo_aula})`}
                {i.fecha_fin && ` · fin ${i.fecha_fin}`}
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/aulas">Ir a intervenciones</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
