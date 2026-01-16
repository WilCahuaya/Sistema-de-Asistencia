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

interface AulaFormData {
  nombre: string
  descripcion?: string
}

interface AulaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  ongId: string
}

export function AulaDialog({ open, onOpenChange, onSuccess, ongId }: AulaDialogProps) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AulaFormData>()

  const onSubmit = async (data: AulaFormData) => {
    if (!ongId) {
      alert('Por favor, selecciona una ONG primero')
      return
    }

    try {
      setLoading(true)

      // Asegurar que el usuario esté autenticado (refresca la sesión si es necesario)
      const authResult = await ensureAuthenticated()
      
      if (!authResult || !authResult.user) {
        alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { user, supabase } = authResult

      // Crear aula
      const { error } = await supabase
        .from('aulas')
        .insert({
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          ong_id: ongId,
          created_by: user.id,
        })

      if (error) throw error

      reset()
      onSuccess()
    } catch (error) {
      console.error('Error creating aula:', error)
      alert('Error al crear el aula. Por favor, intenta nuevamente.')
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
            <Button type="submit" disabled={loading || !ongId}>
              {loading ? 'Creando...' : 'Crear Aula'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

