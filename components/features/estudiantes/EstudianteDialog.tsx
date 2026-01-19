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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'

interface EstudianteFormData {
  codigo: string
  nombre_completo: string
}

interface EstudianteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulaId?: string
  aulas: Array<{ id: string; nombre: string }>
}

export function EstudianteDialog({ open, onOpenChange, onSuccess, fcpId, aulaId, aulas }: EstudianteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAulaId, setSelectedAulaId] = useState(aulaId || '')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EstudianteFormData>()

  useEffect(() => {
    if (aulaId) {
      setSelectedAulaId(aulaId)
    } else if (aulas.length > 0 && !selectedAulaId) {
      setSelectedAulaId(aulas[0].id)
    }
  }, [aulaId, aulas])

  const onSubmit = async (data: EstudianteFormData) => {
    if (!fcpId) {
      alert('Por favor, selecciona una ONG primero')
      return
    }

    if (!selectedAulaId) {
      alert('Por favor, selecciona un aula')
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

      // Crear estudiante
      const { error } = await supabase
        .from('estudiantes')
        .insert({
          codigo: data.codigo,
          nombre_completo: data.nombre_completo,
          fcp_id: fcpId,
          aula_id: selectedAulaId,
          created_by: user.id,
        })

      if (error) throw error

      reset()
      setSelectedAulaId(aulas.length > 0 ? aulas[0].id : '')
      onSuccess()
    } catch (error: any) {
      console.error('Error creating estudiante:', error)
      if (error.code === '23505') {
        alert('El código del estudiante ya existe en esta ONG')
      } else {
        alert('Error al crear el estudiante. Por favor, intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Estudiante</DialogTitle>
          <DialogDescription>
            Completa la información para registrar un nuevo estudiante
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="codigo">Código del Estudiante *</Label>
              <Input
                id="codigo"
                {...register('codigo', { required: 'El código es requerido' })}
                placeholder="Ej: EST001, 2024001"
              />
              {errors.codigo && (
                <p className="text-sm text-red-500">{errors.codigo.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nombre_completo">Nombre Completo *</Label>
              <Input
                id="nombre_completo"
                {...register('nombre_completo', { required: 'El nombre completo es requerido' })}
                placeholder="Ej: Juan Pérez García"
              />
              {errors.nombre_completo && (
                <p className="text-sm text-red-500">{errors.nombre_completo.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="aula_id">Aula *</Label>
              <select
                id="aula_id"
                value={selectedAulaId}
                onChange={(e) => setSelectedAulaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                required
              >
                <option value="">Selecciona un aula</option>
                {aulas.map((aula) => (
                  <option key={aula.id} value={aula.id}>
                    {aula.nombre}
                  </option>
                ))}
              </select>
              {!selectedAulaId && (
                <p className="text-sm text-red-500">Debes seleccionar un aula</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                setSelectedAulaId(aulas.length > 0 ? aulas[0].id : '')
                onOpenChange(false)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !fcpId || !selectedAulaId}>
              {loading ? 'Creando...' : 'Crear Estudiante'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

