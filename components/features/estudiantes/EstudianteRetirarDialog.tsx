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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { UserX } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getTodayInAppTimezone, lastDayOfMonthFromDate } from '@/lib/utils/dateUtils'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: { nombre: string }
  fcp_id: string
  activo?: boolean
}

interface EstudianteRetirarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
}

export function EstudianteRetirarDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
}: EstudianteRetirarDialogProps) {
  const [loading, setLoading] = useState(false)
  const [fechaRetiro, setFechaRetiro] = useState<string>(() => getTodayInAppTimezone())
  const [motivo, setMotivo] = useState<string>('')
  const [fechaInicioMin, setFechaInicioMin] = useState<string | null>(null)

  useEffect(() => {
    if (open && estudiante) {
      setFechaRetiro(getTodayInAppTimezone())
      setMotivo('')
      setFechaInicioMin(null)
      ;(async () => {
        try {
          const auth = await ensureAuthenticated()
          if (!auth?.supabase) return
          const { data } = await auth.supabase
            .from('estudiante_periodos')
            .select('fecha_inicio')
            .eq('estudiante_id', estudiante.id)
            .is('fecha_fin', null)
            .single()
          if (data?.fecha_inicio) setFechaInicioMin(data.fecha_inicio)
        } catch {
          // ignorar
        }
      })()
    }
  }, [open, estudiante])

  const onSubmit = async () => {
    if (!estudiante) return

    if (!fechaRetiro) {
      toast.warning('Fecha de retiro', 'Indica la fecha de retiro del estudiante.')
      return
    }

    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      if (!authResult || !authResult.user) {
        toast.error('Sesión expirada', 'Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { supabase } = authResult

      const { data: periodoActual } = await supabase
        .from('estudiante_periodos')
        .select('id, fecha_inicio')
        .eq('estudiante_id', estudiante.id)
        .is('fecha_fin', null)
        .single()

      if (!periodoActual) {
        toast.error('Sin período activo', 'No se encontró un período activo para este estudiante.')
        setLoading(false)
        return
      }

      const fechaFinPeriodo = lastDayOfMonthFromDate(fechaRetiro)
      if (fechaFinPeriodo < periodoActual.fecha_inicio) {
        toast.error(
          'Fecha inválida',
          `El mes de retiro no puede ser anterior al inicio del período (${periodoActual.fecha_inicio}).`
        )
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('estudiante_periodos')
        .update({
          fecha_fin: fechaFinPeriodo,
          motivo_retiro: motivo || null,
        })
        .eq('id', periodoActual.id)

      if (error) throw error

      toast.success('Estudiante retirado', 'El estudiante ya no aparecerá en meses posteriores.')
      onSuccess()
    } catch (error: any) {
      console.error('Error retirando estudiante:', error)
      const msg = error?.message || 'Intenta nuevamente.'
      if (error?.code === '23514' || msg.includes('chk_fecha_fin')) {
        toast.error('Fecha inválida', 'La fecha de retiro no puede ser anterior al inicio del período en este salón. Elige una fecha posterior.')
      } else {
        toast.error('Error al retirar', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setMotivo('')
      onOpenChange(false)
    }
  }

  if (!estudiante) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Retirar Estudiante</DialogTitle>
          <DialogDescription>
            El estudiante ya no aparecerá en los meses posteriores, pero conservará su historial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label className="mb-2 block">Estudiante:</Label>
            <div className="p-3 bg-muted border border-border rounded-md">
              <p className="font-medium text-foreground">{estudiante.nombre_completo}</p>
              <p className="text-sm text-muted-foreground font-mono">{estudiante.codigo}</p>
              <p className="text-xs text-muted-foreground mt-1">Salón: {estudiante.aula?.nombre || '-'}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="fecha_retiro">¿En qué mes se retira? *</Label>
            <p className="text-xs text-muted-foreground">Se usará el último día del mes.</p>
            <Input
              id="fecha_retiro"
              type="date"
              value={fechaRetiro}
              min={fechaInicioMin ?? undefined}
              onChange={(e) => setFechaRetiro(e.target.value)}
              title={fechaInicioMin ? `Debe ser igual o posterior a ${fechaInicioMin}` : undefined}
            />
          </div>

          <div>
            <Label htmlFor="motivo">Motivo (opcional):</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Razón del retiro..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onSubmit}
            disabled={loading || !fechaRetiro}
          >
            {loading ? (
              <>
                <UserX className="mr-2 h-4 w-4 animate-pulse" />
                Retirando...
              </>
            ) : (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Confirmar Retiro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
