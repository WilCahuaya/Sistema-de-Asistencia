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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getCurrentMonthYearInAppTimezone, getMonthRangeInAppTimezone } from '@/lib/utils/dateUtils'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: { nombre: string }
  fcp_id: string
}

interface EstudianteMovimientoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
  aulas: Array<{ id: string; nombre: string }>
}

export function EstudianteMovimientoDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
  aulas,
}: EstudianteMovimientoDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAulaId, setSelectedAulaId] = useState<string>('')
  const [motivo, setMotivo] = useState<string>('')

  useEffect(() => {
    if (open && estudiante) {
      setSelectedAulaId('')
      setMotivo('')
      const aulasDisponibles = aulas.filter(a => a.id !== estudiante.aula_id)
      if (aulasDisponibles.length > 0) {
        setSelectedAulaId(aulasDisponibles[0].id)
      }
    }
  }, [open, estudiante, aulas])

  const onSubmit = async () => {
    if (!estudiante || !selectedAulaId) {
      toast.warning('Selecciona un aula', 'Por favor, selecciona un aula destino.')
      return
    }

    if (selectedAulaId === estudiante.aula_id) {
      toast.warning('Aula diferente', 'Debes seleccionar un aula diferente a la actual.')
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
      const { year, month } = getCurrentMonthYearInAppTimezone()
      const { start: firstCur, end: lastCur } = getMonthRangeInAppTimezone(year, month)

      const { data: periodoActual } = await supabase
        .from('estudiante_periodos')
        .select('id')
        .eq('estudiante_id', estudiante.id)
        .lte('fecha_inicio', lastCur)
        .gte('fecha_fin', firstCur)
        .limit(1)
        .single()

      if (!periodoActual) {
        toast.error('Sin período', 'No se encontró un período para el mes actual.')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('estudiante_periodos')
        .update({ aula_id: selectedAulaId })
        .eq('id', periodoActual.id)

      if (error) throw error

      toast.success('Cambio de salón registrado', 'El estudiante fue asignado al nuevo salón.')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error moving estudiante:', error)
      toast.error('Error al mover el estudiante', error?.message || 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedAulaId('')
      setMotivo('')
      onOpenChange(false)
    }
  }

  if (!estudiante) return null

  const aulasDisponibles = aulas.filter(a => a.id !== estudiante.aula_id)
  const aulaActual = aulas.find(a => a.id === estudiante.aula_id)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cambiar de Salón</DialogTitle>
          <DialogDescription>
            El estudiante cambiará de salón este mes. El histórico se conserva en su perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label className="mb-2 block">Estudiante:</Label>
            <div className="p-3 bg-muted border border-border rounded-md">
              <p className="font-medium text-foreground">{estudiante.nombre_completo}</p>
              <p className="text-sm text-muted-foreground font-mono">{estudiante.codigo}</p>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Aula Actual:</Label>
            <div className="p-3 bg-muted border border-border rounded-md">
              <p className="font-medium text-foreground">{aulaActual?.nombre || 'Sin aula'}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="aula-destino" className="mb-2 block">
              Nuevo Salón: <span className="text-red-500">*</span>
            </Label>
            {aulasDisponibles.length === 0 ? (
              <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">No hay otras aulas disponibles</p>
                    <p className="mt-1">Necesitas crear otra aula para poder mover estudiantes.</p>
                  </div>
                </div>
              </div>
            ) : (
              <Select value={selectedAulaId} onValueChange={setSelectedAulaId}>
                <SelectTrigger id="aula-destino" className="w-full">
                  <SelectValue placeholder="Selecciona un aula" />
                </SelectTrigger>
                <SelectContent>
                  {aulasDisponibles.map((aula) => (
                    <SelectItem key={aula.id} value={aula.id}>
                      {aula.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="motivo">Motivo (opcional):</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Razón del movimiento del estudiante..."
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
            onClick={onSubmit}
            disabled={loading || !selectedAulaId || aulasDisponibles.length === 0}
          >
            {loading ? (
              <>
                <ArrowRight className="mr-2 h-4 w-4 animate-pulse" />
                Moviendo...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Confirmar Cambio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
