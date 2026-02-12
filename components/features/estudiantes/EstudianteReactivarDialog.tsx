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
import { UserCheck } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getCurrentMonthYearInAppTimezone, getMonthRangeInAppTimezone } from '@/lib/utils/dateUtils'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: { nombre: string }
  fcp_id: string
  activo?: boolean
}

interface EstudianteReactivarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
  aulas: Array<{ id: string; nombre: string }>
}

export function EstudianteReactivarDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
  aulas,
}: EstudianteReactivarDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAulaId, setSelectedAulaId] = useState<string>('')

  useEffect(() => {
    if (open && estudiante && aulas.length > 0) {
      setSelectedAulaId(estudiante.aula_id || aulas[0]?.id || '')
    }
  }, [open, estudiante, aulas])

  const onSubmit = async () => {
    if (!estudiante) return

    if (!selectedAulaId) {
      toast.warning('Salón', 'Selecciona el salón donde será reactivado.')
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

      const { user, supabase } = authResult
      const { year, month } = getCurrentMonthYearInAppTimezone()
      const { start: fechaInicioPeriodo, end: fechaFinPeriodo } = getMonthRangeInAppTimezone(year, month)

      const { error } = await supabase
        .from('estudiante_periodos')
        .insert({
          estudiante_id: estudiante.id,
          aula_id: selectedAulaId,
          fecha_inicio: fechaInicioPeriodo,
          fecha_fin: fechaFinPeriodo,
          created_by: user.id,
        })

      if (error) throw error

      toast.success('Estudiante reactivado', 'Aparecerá en el salón desde este mes.')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error reactivando estudiante:', error)
      toast.error('Error al reactivar', error?.message || 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) onOpenChange(false)
  }

  if (!estudiante) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reactivar en Salón</DialogTitle>
          <DialogDescription>
            Crea un nuevo período para este mes. El historial anterior no se modifica.
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
            <Label htmlFor="aula_reactivar">Salón: *</Label>
            <Select value={selectedAulaId} onValueChange={setSelectedAulaId}>
              <SelectTrigger id="aula_reactivar" className="w-full">
                <SelectValue placeholder="Selecciona salón" />
              </SelectTrigger>
              <SelectContent>
                {aulas.map((aula) => (
                  <SelectItem key={aula.id} value={aula.id}>
                    {aula.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || !selectedAulaId}
          >
            {loading ? (
              <>
                <UserCheck className="mr-2 h-4 w-4 animate-pulse" />
                Reactivando...
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Reactivar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
