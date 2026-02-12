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
import { getTodayInAppTimezone } from '@/lib/utils/dateUtils'

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

  useEffect(() => {
    if (open && estudiante) {
      setFechaRetiro(getTodayInAppTimezone())
      setMotivo('')
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
        .select('id')
        .eq('estudiante_id', estudiante.id)
        .is('fecha_fin', null)
        .single()

      if (!periodoActual) {
        toast.error('Sin período activo', 'No se encontró un período activo para este estudiante.')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('estudiante_periodos')
        .update({
          fecha_fin: fechaRetiro,
          motivo_retiro: motivo || null,
        })
        .eq('id', periodoActual.id)

      if (error) throw error

      toast.success('Estudiante retirado', 'El estudiante ya no aparecerá en meses posteriores.')
      onSuccess()
    } catch (error: any) {
      console.error('Error retirando estudiante:', error)
      toast.error('Error al retirar', error?.message || 'Intenta nuevamente.')
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
            <Label htmlFor="fecha_retiro">¿Fecha de retiro? *</Label>
            <Input
              id="fecha_retiro"
              type="date"
              value={fechaRetiro}
              onChange={(e) => setFechaRetiro(e.target.value)}
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
