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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, AlertCircle } from 'lucide-react'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: {
    nombre: string
  }
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
      // Excluir el aula actual del listado
      const aulasDisponibles = aulas.filter(a => a.id !== estudiante.aula_id)
      if (aulasDisponibles.length > 0) {
        setSelectedAulaId(aulasDisponibles[0].id)
      }
    }
  }, [open, estudiante, aulas])

  const onSubmit = async () => {
    if (!estudiante || !selectedAulaId) {
      alert('Por favor, selecciona un aula destino')
      return
    }

    if (selectedAulaId === estudiante.aula_id) {
      alert('Debes seleccionar un aula diferente a la actual')
      return
    }

    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      
      if (!authResult || !authResult.user) {
        alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { user, supabase } = authResult

      // Obtener el aula anterior antes de actualizar
      const aulaAnteriorId = estudiante.aula_id

      // Actualizar el aula del estudiante
      const { error: updateError } = await supabase
        .from('estudiantes')
        .update({
          aula_id: selectedAulaId,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estudiante.id)

      if (updateError) throw updateError

      // Registrar el movimiento en el historial
      const { error: historialError } = await supabase
        .from('historial_movimientos')
        .insert({
          estudiante_id: estudiante.id,
          aula_anterior_id: aulaAnteriorId,
          aula_nueva_id: selectedAulaId,
          motivo: motivo || null,
          created_by: user.id,
        })

      if (historialError) {
        console.error('Error saving movement history:', historialError)
        // No lanzamos error aquí, ya que el movimiento principal fue exitoso
        // Solo registramos el error en la consola
      }

      onSuccess()
      setSelectedAulaId('')
      setMotivo('')
    } catch (error: any) {
      console.error('Error moving estudiante:', error)
      alert('Error al mover el estudiante. Por favor, intenta nuevamente.')
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
          <DialogTitle>Mover Estudiante a Otra Aula</DialogTitle>
          <DialogDescription>
            Mueve el estudiante a un aula diferente. El historial de asistencias se conservará.
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
              Nueva Aula: <span className="text-red-500">*</span>
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
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
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
                Mover Estudiante
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

