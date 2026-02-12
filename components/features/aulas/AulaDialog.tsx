'use client'

import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'

interface AulaFormData {
  nombre: string
  descripcion?: string
}

interface AulaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  /** Si se provee, se llama con el aula creada (útil para asignarla de inmediato desde otro diálogo) */
  onAulaCreated?: (aula: { id: string; nombre: string }) => void
}

export function AulaDialog({ open, onOpenChange, onSuccess, fcpId, onAulaCreated }: AulaDialogProps) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AulaFormData>()

  const onSubmit = async (data: AulaFormData) => {
    if (!fcpId) {
      toast.warning('Selecciona una ONG', 'Por favor, selecciona una ONG primero.')
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

      const { data: nuevaAula, error } = await supabase
        .from('aulas')
        .insert({
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          fcp_id: fcpId,
          activa: true,
          created_by: user.id,
        })
        .select('id, nombre')
        .single()

      if (error) throw error

      reset()
      toast.created('Aula')
      onAulaCreated?.(nuevaAula)
      onSuccess()
    } catch (error: any) {
      console.error('Error creating aula:', error)
      toast.error('Error al crear el aula', error?.message || 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Aula</DialogTitle>
          <DialogDescription>
            Completa la información para crear una nueva aula
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !fcpId}>
              {loading ? 'Creando...' : 'Crear Aula'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

