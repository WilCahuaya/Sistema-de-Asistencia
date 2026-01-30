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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'

interface AulaFormData {
  nombre: string
  descripcion?: string
  activa?: boolean
}

interface AulaEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  aulaId: string
  initialData: AulaFormData
}

export function AulaEditDialog({ open, onOpenChange, onSuccess, aulaId, initialData }: AulaEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activa, setActiva] = useState(initialData.activa ?? true)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AulaFormData>({
    defaultValues: initialData,
  })

  // Actualizar el formulario cuando cambian los datos iniciales
  useEffect(() => {
    if (open && initialData) {
      reset(initialData)
      setActiva(initialData.activa ?? true)
    }
  }, [open, initialData, reset])

  const onSubmit = async (data: AulaFormData) => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      
      // Verificar autenticación
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setError('Error de autenticación. Por favor, inicia sesión nuevamente.')
        toast.error('Error de autenticación', 'Inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      // Si se va a inactivar el aula, verificar si tiene tutor asignado
      if (!activa) {
        // Desasignar el tutor si existe
        const { error: deleteTutorError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('aula_id', aulaId)

        if (deleteTutorError) {
          console.error('Error al desasignar tutor:', deleteTutorError)
          // Continuar de todos modos
        }
      }

      // Actualizar aula
      const { error: updateError } = await supabase
        .from('aulas')
        .update({
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          activa: activa,
        })
        .eq('id', aulaId)

      if (updateError) throw updateError

      reset()
      toast.updated('Aula')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating aula:', error)
      const msg = error?.message || 'Error desconocido'
      setError(`Error al actualizar el aula: ${msg}`)
      toast.error('Error al actualizar el aula', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Aula</DialogTitle>
          <DialogDescription>
            Modifica la información del aula
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                {...register('nombre', { required: 'El nombre es requerido' })}
                placeholder="Ej: Aula 1, Primaria A, etc."
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                {...register('descripcion')}
                placeholder="Breve descripción (opcional)"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={activa ? 'activo' : 'inactivo'}
                onValueChange={(value) => setActiva(value === 'activo')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              {!activa && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Al inactivar el aula, se desasignará el tutor si existe y el aula no aparecerá en las listas de asistencia.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                setError(null)
                onOpenChange(false)
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

