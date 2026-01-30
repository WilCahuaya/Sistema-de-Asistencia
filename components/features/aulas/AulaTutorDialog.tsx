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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

interface Tutor {
  usuario_fcp_id: string
  usuario_id: string
  email: string
  nombre_completo?: string
}

interface AulaTutorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  aulaId: string
  aulaNombre: string
  fcpId: string
  tutorActual?: {
    id: string
    email: string
    nombre_completo?: string
  }
}

export function AulaTutorDialog({
  open,
  onOpenChange,
  onSuccess,
  aulaId,
  aulaNombre,
  fcpId,
  tutorActual,
}: AulaTutorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutores, setTutores] = useState<Tutor[]>([])
  const [selectedTutorUsuarioOngId, setSelectedTutorUsuarioOngId] = useState<string>('__none__')
  const supabase = createClient()

  // Cargar tutores cuando el diálogo se abre
  useEffect(() => {
    if (open && fcpId) {
      loadTutores()
      // Si hay tutor actual, establecer su usuario_fcp_id
      if (tutorActual) {
        // Necesitamos obtener el usuario_fcp_id del tutor actual
        loadCurrentTutorUsuarioOngId()
      } else {
        setSelectedTutorUsuarioOngId('__none__')
      }
    } else if (!open) {
      // Limpiar al cerrar
      setTutores([])
      setSelectedTutorUsuarioOngId('__none__')
      setError(null)
    }
  }, [open, fcpId, tutorActual])

  const loadCurrentTutorUsuarioOngId = async () => {
    if (!tutorActual) return
    
    try {
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select('id')
        .eq('usuario_id', tutorActual.id)
        .eq('fcp_id', fcpId)
        .eq('rol', 'tutor')
        .eq('activo', true)
        .single()

      if (error) throw error
      if (data) {
        setSelectedTutorUsuarioOngId(data.id)
      }
    } catch (error) {
      console.error('Error loading current tutor usuario_fcp_id:', error)
    }
  }

  const loadTutores = async () => {
    try {
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          usuario_id,
          usuario:usuarios!inner(id, email, nombre_completo)
        `)
        .eq('fcp_id', fcpId)
        .eq('rol', 'tutor')
        .eq('activo', true)

      if (error) throw error

      const tutoresList = (data || [])
        .map((item: any) => ({
          usuario_fcp_id: item.id,
          usuario_id: item.usuario_id,
          email: item.usuario?.email || '',
          nombre_completo: item.usuario?.nombre_completo || '',
        }))
        // Ordenar por nombre_completo o email (en el cliente ya que PostgREST no soporta ordenar por relaciones anidadas fácilmente)
        .sort((a, b) => {
          const nombreA = a.nombre_completo || a.email || ''
          const nombreB = b.nombre_completo || b.email || ''
          return nombreA.localeCompare(nombreB)
        })

      setTutores(tutoresList)
    } catch (error: any) {
      console.error('Error loading tutores:', error)
      setError(`Error al cargar tutores: ${error.message}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Si se selecciona "ninguno" (valor especial "__none__"), eliminar tutor actual
      if (!selectedTutorUsuarioOngId || selectedTutorUsuarioOngId === '__none__') {
        // Eliminar todas las asignaciones de tutor a esta aula
        const { error: deleteError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('aula_id', aulaId)
          .eq('activo', true)

        if (deleteError) throw deleteError
      } else {
        // Primero, eliminar todas las asignaciones actuales de esta aula
        // (una aula solo puede tener un tutor asignado)
        const { error: deleteError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('aula_id', aulaId)

        if (deleteError) throw deleteError

        // Crear nueva asignación
        const { error: insertError } = await supabase
          .from('tutor_aula')
          .insert({
            usuario_fcp_id: selectedTutorUsuarioOngId,
            aula_id: aulaId,
            fcp_id: fcpId,
            activo: true,
          })

        if (insertError) throw insertError
      }

      toast.success(selectedTutorUsuarioOngId === '__none__' ? 'Tutor desasignado' : 'Tutor asignado al aula')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error assigning tutor:', error)
      setError(`Error al asignar tutor: ${error.message}`)
      toast.error('Error al asignar tutor', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Asignar Tutor al Aula</DialogTitle>
          <DialogDescription>
            Asigna o cambia el tutor encargado del aula "{aulaNombre}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tutor">Tutor encargado</Label>
              <Select
                value={selectedTutorUsuarioOngId}
                onValueChange={setSelectedTutorUsuarioOngId}
                disabled={loading}
              >
                <SelectTrigger id="tutor">
                  <SelectValue placeholder="Selecciona un tutor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin tutor asignado</SelectItem>
                  {tutores.map((tutor) => (
                    <SelectItem key={tutor.usuario_fcp_id} value={tutor.usuario_fcp_id}>
                      {tutor.nombre_completo || tutor.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tutores.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay tutores disponibles en esta ONG. Primero agrega un tutor desde la sección de miembros.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
                {error}
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
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

