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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Edit } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'

interface Asistencia {
  id: string
  fecha: string
  estado: 'presente' | 'falto' | 'permiso'
  observaciones?: string
  estudiante_id: string
  estudiante?: {
    codigo: string
    nombre_completo: string
    aula?: {
      nombre: string
    }
  }
  fcp_id: string
}

interface AsistenciaEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  asistencia: Asistencia
}

export function AsistenciaEditDialog({
  open,
  onOpenChange,
  onSuccess,
  asistencia,
}: AsistenciaEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [estado, setEstado] = useState<'presente' | 'falto' | 'permiso'>(asistencia.estado)
  const [observaciones, setObservaciones] = useState(asistencia.observaciones || '')
  const { canEdit, role } = useUserRole(asistencia.fcp_id)

  useEffect(() => {
    if (open) {
      setEstado(asistencia.estado)
      setObservaciones(asistencia.observaciones || '')
    }
  }, [open, asistencia])

  const onSubmit = async () => {
    // Validar permisos: solo director y secretario pueden editar asistencias
    if (!canEdit || (role !== 'director' && role !== 'secretario')) {
      alert('No tienes permisos para editar asistencias. Solo los directores y secretarios pueden realizar esta acción.')
      return
    }

    // Validar inmutabilidad: no permitir editar asistencias de meses anteriores
    const fechaAsistencia = new Date(asistencia.fecha)
    const fechaActual = new Date()
    const mesAsistencia = new Date(fechaAsistencia.getFullYear(), fechaAsistencia.getMonth(), 1)
    const mesActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
    
    if (mesAsistencia < mesActual) {
      alert('No se pueden modificar asistencias de meses anteriores. Las asistencias quedan cerradas al finalizar cada mes.')
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

      const { error } = await supabase
        .from('asistencias')
        .update({
          estado,
          observaciones: observaciones || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asistencia.id)

      if (error) {
        // Si el error es de inmutabilidad desde la BD, mostrar mensaje específico
        if (error.message?.includes('meses anteriores') || error.message?.includes('mes cerrado')) {
          alert('No se pueden modificar asistencias de meses anteriores. Las asistencias quedan cerradas al finalizar cada mes.')
        } else {
          throw error
        }
        setLoading(false)
        return
      }

      onSuccess()
    } catch (error: any) {
      console.error('Error updating asistencia:', error)
      alert(error.message || 'Error al actualizar la asistencia. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setEstado(asistencia.estado)
      setObservaciones(asistencia.observaciones || '')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Asistencia</DialogTitle>
          <DialogDescription>
            Edita la asistencia del estudiante {asistencia.estudiante?.nombre_completo} ({asistencia.estudiante?.codigo})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label className="mb-2 block">Fecha:</Label>
            <p className="text-sm text-muted-foreground">
              {new Date(asistencia.fecha).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Estudiante:</Label>
            <p className="text-sm text-muted-foreground">{asistencia.estudiante?.nombre_completo}</p>
            <p className="text-xs text-muted-foreground font-mono">{asistencia.estudiante?.codigo}</p>
          </div>

          <div>
            <Label className="mb-2 block">Aula:</Label>
            <p className="text-sm text-muted-foreground">{asistencia.estudiante?.aula?.nombre}</p>
          </div>

          <div>
            <Label className="mb-2 block">Estado:</Label>
            <RadioGroup
              value={estado}
              onValueChange={(value) => setEstado(value as 'presente' | 'falto' | 'permiso')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="presente" id="edit-presente" />
                <Label htmlFor="edit-presente" className="cursor-pointer">
                  Presente
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="falto" id="edit-falto" />
                <Label htmlFor="edit-falto" className="cursor-pointer">
                  Faltó
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="permiso" id="edit-permiso" />
                <Label htmlFor="edit-permiso" className="cursor-pointer">
                  Permiso
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="edit-observaciones">Observaciones (opcional):</Label>
            <Textarea
              id="edit-observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales..."
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
            disabled={loading}
          >
            {loading ? (
              <>
                <Edit className="mr-2 h-4 w-4 animate-pulse" />
                Guardando...
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

