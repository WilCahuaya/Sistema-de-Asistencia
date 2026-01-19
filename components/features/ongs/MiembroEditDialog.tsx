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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getRolDisplayName } from '@/lib/utils/roles'
import { Checkbox } from '@/components/ui/checkbox'

interface Miembro {
  id: string
  usuario_id: string
  fcp_id: string
  rol: 'facilitador' | 'director' | 'secretario' | 'tutor'
  activo: boolean
  usuario?: {
    email: string
    nombre_completo?: string
  }
}

interface MiembroEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  miembro: Miembro
}

export function MiembroEditDialog({
  open,
  onOpenChange,
  onSuccess,
  miembro,
}: MiembroEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rol, setRol] = useState<Miembro['rol']>(miembro.rol)
  const [activo, setActivo] = useState(miembro.activo)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [selectedAulas, setSelectedAulas] = useState<string[]>([])
  const [loadingAulas, setLoadingAulas] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (miembro) {
      setRol(miembro.rol)
      setActivo(miembro.activo)
    }
  }, [miembro])

  useEffect(() => {
    if (open && miembro && rol === 'tutor') {
      loadAulas()
      loadAulasAsignadas()
    } else if (!open) {
      // Limpiar cuando se cierra el diálogo
      setAulas([])
      setSelectedAulas([])
    } else if (rol !== 'tutor') {
      // Limpiar aulas si el rol no es tutor
      setSelectedAulas([])
    }
  }, [open, miembro, rol])

  const loadAulas = async () => {
    if (!miembro) return

    try {
      setLoadingAulas(true)
      // 1. Obtener todas las aulas de la FCP
      const { data: todasLasAulas, error: aulasError } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', miembro.fcp_id)
        .eq('activa', true)
        .order('nombre')

      if (aulasError) throw aulasError

      // 2. Obtener aulas que ya tienen tutor asignado (excluyendo las asignadas al tutor actual)
      const { data: aulasConTutor, error: tutorError } = await supabase
        .from('tutor_aula')
        .select('aula_id, fcp_miembro_id')
        .eq('fcp_id', miembro.fcp_id)
        .eq('activo', true)

      if (tutorError && tutorError.code !== 'PGRST116') {
        throw tutorError
      }

      // 3. Filtrar aulas sin tutor O aulas asignadas al tutor actual
      const aulasIdsConOtroTutor = new Set(
        (aulasConTutor || [])
          .filter(ta => ta.fcp_miembro_id !== miembro.id)
          .map(ta => ta.aula_id)
      )
      
      const aulasDisponibles = (todasLasAulas || []).filter(
        aula => !aulasIdsConOtroTutor.has(aula.id)
      )

      setAulas(aulasDisponibles)
    } catch (err) {
      console.error('Error loading aulas:', err)
      setAulas([])
    } finally {
      setLoadingAulas(false)
    }
  }

  const loadAulasAsignadas = async () => {
    if (!miembro || rol !== 'tutor') return

    try {
      const { data, error } = await supabase
        .from('tutor_aula')
        .select('aula_id')
        .eq('fcp_miembro_id', miembro.id)
        .eq('activo', true)

      if (error) throw error

      const aulaIds = (data || []).map(ta => ta.aula_id)
      setSelectedAulas(aulaIds)
    } catch (err) {
      console.error('Error loading aulas asignadas:', err)
      setSelectedAulas([])
    }
  }

  const onSubmit = async () => {
    try {
      setLoading(true)
      setError(null)

      // Validar que si es tutor, tenga al menos una aula asignada
      if (rol === 'tutor' && selectedAulas.length === 0) {
        setError('Debes asignar al menos una aula al tutor.')
        setLoading(false)
        return
      }

      const { error: updateError } = await supabase
        .from('fcp_miembros')
        .update({
          rol,
          activo,
        })
        .eq('id', miembro.id)

      if (updateError) {
        if (updateError.code === '42501') {
          setError('No tienes permisos para actualizar miembros. Solo los facilitadores, directores y secretarios pueden hacerlo.')
        } else {
          throw updateError
        }
        setLoading(false)
        return
      }

      // Si el rol es tutor, actualizar las asignaciones de aulas
      if (rol === 'tutor') {
        // Primero, eliminar cualquier tutor previo de las aulas seleccionadas
        // (cada aula solo puede tener un tutor)
        for (const aulaId of selectedAulas) {
          const { error: deleteOldTutorError } = await supabase
            .from('tutor_aula')
            .delete()
            .eq('aula_id', aulaId)
            .eq('activo', true)

          if (deleteOldTutorError) {
            console.error(`Error eliminando tutor previo del aula ${aulaId}:`, deleteOldTutorError)
            throw deleteOldTutorError
          }
        }

        // Eliminar todas las asignaciones antiguas de este tutor
        const { error: deleteOldAssignmentsError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('fcp_miembro_id', miembro.id)

        if (deleteOldAssignmentsError) throw deleteOldAssignmentsError

        // Insertar nuevas asignaciones
        if (selectedAulas.length > 0) {
          const assignments = selectedAulas.map(aulaId => ({
            fcp_miembro_id: miembro.id,
            aula_id: aulaId,
            fcp_id: miembro.fcp_id,
            activo: true,
          }))

          const { error: assignError } = await supabase
            .from('tutor_aula')
            .insert(assignments)

          if (assignError) throw assignError
        }
      } else {
        // Si el rol cambia de tutor a otro, eliminar todas las asignaciones de aulas
        const { error: deleteAssignmentsError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('fcp_miembro_id', miembro.id)

        if (deleteAssignmentsError) throw deleteAssignmentsError
      }

      setError(null)
      onSuccess()
    } catch (err: any) {
      console.error('Error updating miembro:', err)
      setError(err.message || 'Error al actualizar el miembro. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Miembro</DialogTitle>
          <DialogDescription>
            Cambiar el rol o estado del miembro: {miembro.usuario?.nombre_completo || miembro.usuario?.email}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <p className="text-sm text-muted-foreground font-mono">
              {miembro.usuario?.email || 'Sin email'}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rol">Rol *</Label>
            <Select value={rol} onValueChange={(value) => setRol(value as 'facilitador' | 'director' | 'secretario' | 'tutor')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facilitador">{getRolDisplayName('facilitador')}</SelectItem>
                <SelectItem value="director">{getRolDisplayName('director')}</SelectItem>
                <SelectItem value="secretario">{getRolDisplayName('secretario')}</SelectItem>
                <SelectItem value="tutor">{getRolDisplayName('tutor')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="activo">Estado</Label>
            <Select
              value={activo ? 'activo' : 'inactivo'}
              onValueChange={(value) => setActivo(value === 'activo')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selector de aulas (solo para tutores) */}
          {rol === 'tutor' && (
            <div className="grid gap-2">
              <Label htmlFor="aulas">Aulas Asignadas *</Label>
              {loadingAulas ? (
                <p className="text-sm text-muted-foreground">Cargando aulas...</p>
              ) : aulas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay aulas disponibles. Todas las aulas ya tienen tutor asignado o no hay aulas creadas.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                  {aulas.map((aula) => (
                    <div key={aula.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`aula-${aula.id}`}
                        checked={selectedAulas.includes(aula.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newAulas = [...selectedAulas, aula.id]
                            setSelectedAulas(newAulas)
                          } else {
                            const newAulas = selectedAulas.filter((id) => id !== aula.id)
                            setSelectedAulas(newAulas)
                          }
                        }}
                      />
                      <label
                        htmlFor={`aula-${aula.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {aula.nombre}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {rol === 'tutor' && selectedAulas.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Debes asignar al menos una aula al tutor.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null)
              onOpenChange(false)
            }}
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={onSubmit} 
            disabled={loading || (rol === 'tutor' && selectedAulas.length === 0)}
          >
            {loading ? 'Actualizando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

