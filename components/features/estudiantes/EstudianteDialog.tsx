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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'
import { getCurrentMonthYearInAppTimezone, getMonthRangeInAppTimezone } from '@/lib/utils/dateUtils'

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
      toast.warning('Selecciona una FCP', 'Por favor, selecciona una FCP primero.')
      return
    }

    if (!selectedAulaId) {
      toast.warning('Selecciona un aula', 'Por favor, selecciona un aula.')
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

      const { data: nuevoEstudiante, error: errorEstudiante } = await supabase
        .from('estudiantes')
        .insert({
          codigo: data.codigo,
          nombre_completo: data.nombre_completo,
          fcp_id: fcpId,
          aula_id: selectedAulaId,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (errorEstudiante) throw errorEstudiante

      const { year, month } = getCurrentMonthYearInAppTimezone()
      const { start: fechaInicioPeriodo, end: fechaFinPeriodo } = getMonthRangeInAppTimezone(year, month)
      const { error: errorPeriodo } = await supabase
        .from('estudiante_periodos')
        .insert({
          estudiante_id: nuevoEstudiante.id,
          aula_id: selectedAulaId,
          fecha_inicio: fechaInicioPeriodo,
          fecha_fin: fechaFinPeriodo,
          created_by: user.id,
        })

      if (errorPeriodo) {
        console.error('Error creando periodo:', errorPeriodo)
        await supabase.from('estudiantes').delete().eq('id', nuevoEstudiante.id)
        throw errorPeriodo
      }

      reset()
      setSelectedAulaId(aulas.length > 0 ? aulas[0].id : '')
      toast.created('Estudiante')
      onSuccess()
    } catch (error: any) {
      console.error('Error creating estudiante:', error)
      if (error.code === '23505') {
        toast.error('Código duplicado', 'El código del estudiante ya existe en esta FCP.')
      } else {
        toast.error('Error al crear el estudiante', error?.message || 'Intenta nuevamente.')
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
              <Label htmlFor="aula_id">Aula / Salón *</Label>
              <Select
                value={selectedAulaId || ''}
                onValueChange={(value) => setSelectedAulaId(value)}
              >
                <SelectTrigger id="aula_id" className="w-full">
                  <SelectValue placeholder="Selecciona un aula">
                    {selectedAulaId ? aulas.find(a => a.id === selectedAulaId)?.nombre : 'Selecciona un aula'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {aulas.map((aula) => (
                    <SelectItem key={aula.id} value={aula.id}>
                      {aula.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                setSelectedAulaId(aulaId || (aulas.length > 0 ? aulas[0].id : ''))
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

