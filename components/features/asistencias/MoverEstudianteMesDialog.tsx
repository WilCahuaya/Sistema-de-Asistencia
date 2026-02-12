'use client'

import { useState, useEffect } from 'react'
import { ensureAuthenticated } from '@/lib/supabase/auth-helpers'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight } from 'lucide-react'
import { toast } from '@/lib/toast'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface MoverEstudianteMesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
  fcpId: string
  aulaOrigenId: string
  aulaOrigenNombre: string
  aulas: Array<{ id: string; nombre: string }>
  firstDay: string
  lastDay: string
  mesLabel: string
}

function lastDayOfPrevMonth(firstDay: string): string {
  const [y, m] = firstDay.split('-').map(Number)
  const d = new Date(y, m - 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstDayOfNextMonth(lastDay: string): string {
  const [y, m, d] = lastDay.split('-').map(Number)
  const date = new Date(y, m, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function MoverEstudianteMesDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
  fcpId,
  aulaOrigenId,
  aulaOrigenNombre,
  aulas,
  firstDay,
  lastDay,
  mesLabel,
}: MoverEstudianteMesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [aulaDestinoId, setAulaDestinoId] = useState<string>('')

  const aulasDestino = aulas.filter((a) => a.id !== aulaOrigenId)

  useEffect(() => {
    if (open && aulasDestino.length > 0 && !aulaDestinoId) {
      setAulaDestinoId(aulasDestino[0].id)
    }
  }, [open, aulasDestino, aulaDestinoId])

  const handleConfirm = async () => {
    if (!estudiante || !aulaDestinoId || aulaDestinoId === aulaOrigenId) return

    try {
      setLoading(true)
      const authResult = await ensureAuthenticated()
      if (!authResult?.supabase || !authResult.user) {
        toast.error('Sesión expirada', 'Inicia sesión nuevamente.')
        return
      }
      const { supabase, user } = authResult

      // 1) Eliminar asistencias del estudiante en este mes (en aula origen)
      const { error: errAsist } = await supabase
        .from('asistencias')
        .delete()
        .eq('fcp_id', fcpId)
        .eq('aula_id', aulaOrigenId)
        .eq('estudiante_id', estudiante.id)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay)

      if (errAsist) throw errAsist

      // 2) Obtener el período que cubre este mes en el aula origen
      const { data: periodos, error: errPer } = await supabase
        .from('estudiante_periodos')
        .select('id, fecha_inicio, fecha_fin')
        .eq('estudiante_id', estudiante.id)
        .eq('aula_id', aulaOrigenId)

      if (errPer) throw errPer

      const periodo = periodos?.find(
        (p) =>
          p.fecha_inicio <= lastDay && (p.fecha_fin === null || p.fecha_fin >= firstDay)
      )
      let necesitaInsertar = true
      if (periodo) {
        const prevLast = lastDayOfPrevMonth(firstDay)
        const nextFirst = firstDayOfNextMonth(lastDay)
        const esExacto = periodo.fecha_inicio === firstDay && periodo.fecha_fin === lastDay

        if (esExacto) {
          const { error: errUpd } = await supabase
            .from('estudiante_periodos')
            .update({ aula_id: aulaDestinoId })
            .eq('id', periodo.id)
          if (errUpd) throw errUpd
          necesitaInsertar = false
        } else {
          const spansBefore = periodo.fecha_inicio < firstDay
          const spansAfter = !periodo.fecha_fin || periodo.fecha_fin > lastDay

          if (spansBefore && spansAfter) {
            const { error: e1 } = await supabase.from('estudiante_periodos').update({ fecha_fin: prevLast }).eq('id', periodo.id)
            if (e1) throw e1
            const { error: e2 } = await supabase.from('estudiante_periodos').insert({
              estudiante_id: estudiante.id,
              aula_id: aulaOrigenId,
              fecha_inicio: nextFirst,
              fecha_fin: periodo.fecha_fin,
              created_by: user.id,
            })
            if (e2) throw e2
          } else if (spansBefore) {
            const { error: e } = await supabase.from('estudiante_periodos').update({ fecha_fin: prevLast }).eq('id', periodo.id)
            if (e) throw e
          } else if (spansAfter) {
            const { error: e } = await supabase.from('estudiante_periodos').update({ fecha_inicio: nextFirst }).eq('id', periodo.id)
            if (e) throw e
          }
        }
      }

      if (necesitaInsertar) {
        const { error: errInsert } = await supabase.from('estudiante_periodos').insert({
          estudiante_id: estudiante.id,
          aula_id: aulaDestinoId,
          fecha_inicio: firstDay,
          fecha_fin: lastDay,
          created_by: user.id,
        })
        if (errInsert) throw errInsert
      }

      const nombreDestino = aulas.find((a) => a.id === aulaDestinoId)?.nombre || 'salón'
      toast.success('Estudiante movido', `${estudiante.nombre_completo} fue movido a ${nombreDestino} para ${mesLabel}.`)
      onSuccess()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error('Error al mover estudiante:', e)
      toast.error('Error al mover', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!estudiante || aulasDestino.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Mover a otro salón
          </DialogTitle>
          <DialogDescription>
            Se eliminarán las asistencias de este mes y se moverá a {estudiante.nombre_completo} al salón destino. Solo para {mesLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid gap-2">
            <Label>Mover a:</Label>
            <Select value={aulaDestinoId} onValueChange={setAulaDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el salón destino" />
              </SelectTrigger>
              <SelectContent>
                {aulasDestino.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Salón actual: <strong>{aulaOrigenNombre}</strong>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !aulaDestinoId}>
            {loading ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
