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
import { toast } from '@/lib/toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface EstudianteFormData {
  codigo: string
  nombre_completo: string
}

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: { nombre: string }
  fcp_id: string
}

interface EstudianteEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
}

export function EstudianteEditDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
}: EstudianteEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [periodos, setPeriodos] = useState<Array<{ aula: { nombre: string } | null; fecha_inicio: string; fecha_fin: string | null }>>([])
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EstudianteFormData>()

  useEffect(() => {
    if (open && estudiante) {
      ;(async () => {
        try {
          const auth = await ensureAuthenticated()
          if (!auth?.supabase) return
          const { data } = await auth.supabase
            .from('estudiante_periodos')
            .select('fecha_inicio, fecha_fin, aula:aulas(nombre)')
            .eq('estudiante_id', estudiante.id)
            .order('fecha_inicio', { ascending: false })
          setPeriodos(data || [])
        } catch {
          setPeriodos([])
        }
      })()
    }
  }, [open, estudiante])

  useEffect(() => {
    if (open && estudiante) {
      reset({
        codigo: estudiante.codigo,
        nombre_completo: estudiante.nombre_completo,
      })
    }
  }, [open, estudiante, reset])

  const onSubmit = async (data: EstudianteFormData) => {
    if (!estudiante) return

    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      if (!authResult || !authResult.user) {
        toast.error('Sesión expirada', 'Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { user, supabase } = authResult

      const { error } = await supabase
        .from('estudiantes')
        .update({
          codigo: data.codigo,
          nombre_completo: data.nombre_completo,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', estudiante.id)

      if (error) throw error

      toast.updated('Estudiante')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating estudiante:', error)
      if (error.code === '23505') {
        toast.error('Código duplicado', 'El código del estudiante ya existe en esta FCP.')
      } else {
        toast.error('Error al actualizar el estudiante', error?.message || 'Intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!estudiante) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Datos del Estudiante</DialogTitle>
          <DialogDescription>
            Modifica la información personal del estudiante
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

            {periodos.length > 0 && (
              <div className="grid gap-2 pt-2 border-t">
                <Label>Historial de participación</Label>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salón</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodos.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>{p.aula?.nombre ?? '-'}</TableCell>
                          <TableCell>{new Date(p.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell>{p.fecha_fin ? new Date(p.fecha_fin + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : 'Actual'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
