'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { toast } from '@/lib/toast'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface QuitarEstudianteMesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
  periodoId: string | null
  fcpId: string
  aulaId: string
  firstDay: string
  lastDay: string
  mesLabel: string
}

export function QuitarEstudianteMesDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
  periodoId,
  fcpId,
  aulaId,
  firstDay,
  lastDay,
  mesLabel,
}: QuitarEstudianteMesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [asistenciasCount, setAsistenciasCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(true)

  useEffect(() => {
    if (!open || !estudiante?.id) {
      setAsistenciasCount(null)
      setLoadingCount(true)
      return
    }

    let cancelled = false
    const fetchCount = async () => {
      setLoadingCount(true)
      try {
        const supabase = createClient()
        const { count, error } = await supabase
          .from('asistencias')
          .select('*', { count: 'exact', head: true })
          .eq('fcp_id', fcpId)
          .eq('aula_id', aulaId)
          .eq('estudiante_id', estudiante.id)
          .gte('fecha', firstDay)
          .lte('fecha', lastDay)

        if (!cancelled && !error) {
          setAsistenciasCount(count ?? 0)
        }
      } catch {
        if (!cancelled) setAsistenciasCount(0)
      } finally {
        if (!cancelled) setLoadingCount(false)
      }
    }

    fetchCount()
    return () => { cancelled = true }
  }, [open, estudiante?.id, fcpId, aulaId, firstDay, lastDay])

  const handleConfirm = async () => {
    if (!estudiante || !periodoId) return

    try {
      setLoading(true)
      const supabase = createClient()

      // 1) Eliminar asistencias del estudiante en este mes (si hay)
      const { error: errAsist } = await supabase
        .from('asistencias')
        .delete()
        .eq('fcp_id', fcpId)
        .eq('aula_id', aulaId)
        .eq('estudiante_id', estudiante.id)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay)

      if (errAsist) throw errAsist

      // 2) Eliminar el período
      const { error: errPeriodo } = await supabase
        .from('estudiante_periodos')
        .delete()
        .eq('id', periodoId)

      if (errPeriodo) throw errPeriodo

      toast.success('Estudiante quitado', `${estudiante.nombre_completo} fue removido de ${mesLabel}.`)
      onSuccess()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error('Error al quitar estudiante:', e)
      toast.error('Error al quitar', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const mensaje = loadingCount
    ? 'Cargando...'
    : (asistenciasCount ?? 0) > 0
      ? `Este estudiante tiene ${asistenciasCount} asistencia(s) registrada(s) en este período. Se eliminarán las asistencias y el período. ¿Desea continuar?`
      : `Esto eliminará el período limitado a este mes. ¿Desea continuar?`

  if (!estudiante) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <DialogTitle>Quitar de este mes</DialogTitle>
              <DialogDescription className="text-base leading-relaxed">
                {mensaje}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || loadingCount || !periodoId}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
