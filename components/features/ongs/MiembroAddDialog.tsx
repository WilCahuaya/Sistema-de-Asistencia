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
import { getRolDisplayName } from '@/lib/utils/roles'
import { Checkbox } from '@/components/ui/checkbox'

interface MiembroFormData {
  email: string
  rol: 'secretario' | 'tutor' // Facilitador no puede ser asignado desde la UI, solo desde BD
  aulas?: string[] // IDs de aulas asignadas (solo para tutores)
}

interface MiembroAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  ongId: string
}

export function MiembroAddDialog({
  open,
  onOpenChange,
  onSuccess,
  ongId,
}: MiembroAddDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [selectedAulas, setSelectedAulas] = useState<string[]>([])
  const [ongNombre, setOngNombre] = useState<string>('')
  const supabase = createClient()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<MiembroFormData>({
    defaultValues: {
      rol: 'tutor' as const,
      aulas: [],
    },
  })

  const selectedRol = watch('rol')

  // Cargar nombre de la ONG y aulas cuando el diálogo se abre
  useEffect(() => {
    if (open && ongId) {
      loadONGNombre()
      if (selectedRol === 'tutor') {
        loadAulas()
      }
    } else if (!open) {
      // Limpiar cuando se cierra el diálogo
      setAulas([])
      setSelectedAulas([])
      setOngNombre('')
      reset()
    } else if (selectedRol !== 'tutor') {
      // Limpiar aulas si cambia el rol a algo que no sea tutor
      setSelectedAulas([])
      setValue('aulas', [])
    }
  }, [open, ongId, selectedRol])

  const loadONGNombre = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ongs')
        .select('nombre')
        .eq('id', ongId)
        .single()

      if (error) throw error
      if (data) {
        setOngNombre(data.nombre)
      }
    } catch (error) {
      console.error('Error loading ONG nombre:', error)
    }
  }

  const loadAulas = async () => {
    try {
      const supabase = createClient()
      
      // 1. Obtener todas las aulas de la ONG
      const { data: todasLasAulas, error: aulasError } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('ong_id', ongId)
        .eq('activa', true)
        .order('nombre')

      if (aulasError) throw aulasError

      // 2. Obtener aulas que ya tienen tutor asignado
      const { data: aulasConTutor, error: tutorError } = await supabase
        .from('tutor_aula')
        .select('aula_id')
        .eq('ong_id', ongId)
        .eq('activo', true)

      if (tutorError && tutorError.code !== 'PGRST116') {
        throw tutorError
      }

      // 3. Filtrar solo las aulas sin tutor asignado
      const aulasIdsConTutor = new Set(aulasConTutor?.map(ta => ta.aula_id) || [])
      const aulasSinTutor = (todasLasAulas || []).filter(aula => !aulasIdsConTutor.has(aula.id))

      setAulas(aulasSinTutor)
    } catch (err) {
      console.error('Error loading aulas:', err)
      setAulas([]) // En caso de error, mostrar lista vacía
    }
  }

  const onSubmit = async (data: MiembroFormData) => {
    try {
      setLoading(true)
      setError(null)

      // Validar que si es tutor, tenga al menos una aula asignada
      if (data.rol === 'tutor' && (!data.aulas || data.aulas.length === 0)) {
        setError('Debes asignar al menos una aula al tutor.')
        setLoading(false)
        return
      }

      const emailNormalizado = data.email.toLowerCase().trim()

      // 1. Buscar el usuario por email (puede no existir todavía)
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('email', emailNormalizado)
        .single()

      // 2. Verificar si ya existe una invitación o membresía pendiente/activa
      let existingMember = null
      
      if (usuarioData) {
        // Usuario existe: verificar membresía existente
        const { data: memberData, error: checkError } = await supabase
          .from('usuario_ong')
          .select('id, activo, usuario_id')
          .eq('usuario_id', usuarioData.id)
          .eq('ong_id', ongId)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        existingMember = memberData
      } else {
        // Usuario no existe: verificar invitación pendiente por email
        const { data: pendingInvitation, error: checkError } = await supabase
          .from('usuario_ong')
          .select('id, activo, email_pendiente')
          .eq('email_pendiente', emailNormalizado)
          .eq('ong_id', ongId)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        existingMember = pendingInvitation
      }

      // 3. Si ya existe una membresía activa, mostrar error
      if (existingMember && existingMember.activo) {
        setError('Este usuario ya es miembro activo de esta ONG.')
        setLoading(false)
        return
      }

      // 4. Si existe pero está inactivo, reactivar y actualizar rol y aulas
      if (existingMember && !existingMember.activo) {
        const { data: updatedMember, error: updateError } = await supabase
          .from('usuario_ong')
          .update({
            rol: data.rol,
            activo: true,
            usuario_id: usuarioData?.id || null, // Asegurar que se asocie si el usuario ya se registró
            email_pendiente: usuarioData ? null : emailNormalizado, // Limpiar si ya se registró
          })
          .eq('id', existingMember.id)
          .select('id')
          .single()

        if (updateError) throw updateError

        // Si es tutor y se seleccionaron aulas, actualizar las asignaciones
        if (data.rol === 'tutor' && data.aulas && data.aulas.length > 0 && updatedMember) {
          // Primero, eliminar cualquier tutor previo de las aulas seleccionadas
          // (cada aula solo puede tener un tutor)
          for (const aulaId of data.aulas) {
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

          // Eliminar asignaciones antiguas de este tutor (por si se removió de algunas aulas)
          const { error: deleteOldAssignmentsError } = await supabase
            .from('tutor_aula')
            .delete()
            .eq('usuario_ong_id', updatedMember.id)

          if (deleteOldAssignmentsError) throw deleteOldAssignmentsError

          // Insertar nuevas asignaciones (ahora las aulas están libres)
          const assignments = data.aulas.map(aulaId => ({
            usuario_ong_id: updatedMember.id,
            aula_id: aulaId,
            ong_id: ongId,
            activo: true,
          }))

          const { error: assignError } = await supabase
            .from('tutor_aula')
            .insert(assignments)

          if (assignError) throw assignError
        }

        reset()
        setError(null)
        onSuccess()
        return
      }

      // 5. Crear nueva membresía o invitación pendiente
      const insertData: any = {
        ong_id: ongId,
        rol: data.rol,
        activo: true,
      }

      if (usuarioData) {
        // Usuario existe: crear membresía normal
        insertData.usuario_id = usuarioData.id
      } else {
        // Usuario no existe: crear invitación pendiente
        insertData.usuario_id = null
        insertData.email_pendiente = emailNormalizado
      }

      const { data: newUsuarioOng, error: insertError } = await supabase
        .from('usuario_ong')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '42501') {
          setError('No tienes permisos para agregar miembros. Solo los facilitadores pueden hacerlo.')
        } else {
          throw insertError
        }
        setLoading(false)
        return
      }

      // 6. Si es tutor y se seleccionaron aulas, asignar las aulas
      if (data.rol === 'tutor' && data.aulas && data.aulas.length > 0 && newUsuarioOng) {
        // Primero, eliminar cualquier tutor previo de las aulas seleccionadas
        // (cada aula solo puede tener un tutor)
        for (const aulaId of data.aulas) {
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

        // Insertar nuevas asignaciones (ahora las aulas están libres)
        const assignments = data.aulas.map(aulaId => ({
          usuario_ong_id: newUsuarioOng.id,
          aula_id: aulaId,
          ong_id: ongId,
          activo: true,
        }))

        const { error: aulasError } = await supabase
          .from('tutor_aula')
          .insert(assignments)

        if (aulasError) {
          console.error('Error asignando aulas:', aulasError)
          throw aulasError
        }
      }

      reset()
      setSelectedAulas([])
      setError(null)
      onSuccess()
    } catch (err: any) {
      console.error('Error adding miembro:', err)
      setError(err.message || 'Error al agregar el miembro. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Miembro</DialogTitle>
          <DialogDescription>
            {ongNombre && (
              <span className="block mb-2">
                <strong>ONG:</strong> {ongNombre}
              </span>
            )}
            Agrega un usuario a esta ONG por su email. Si el usuario aún no se ha registrado, se creará una invitación pendiente que se activará automáticamente cuando se registre con Google OAuth.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email del Usuario *</Label>
              <Input
                id="email"
                type="email"
                {...register('email', {
                  required: 'El email es requerido',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Email inválido',
                  },
                })}
                placeholder="usuario@example.com"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rol">Rol *</Label>
              <Select
                value={selectedRol}
                onValueChange={(value) => setValue('rol', value as 'secretario' | 'tutor')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="secretario">{getRolDisplayName('secretario')}</SelectItem>
                  <SelectItem value="tutor">{getRolDisplayName('tutor')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Nota: Los facilitadores solo se asignan desde la base de datos.
              </p>
              {errors.rol && (
                <p className="text-sm text-red-500">{errors.rol.message}</p>
              )}
            </div>

            {/* Selector de aulas (solo para tutores) */}
            {selectedRol === 'tutor' && (
              <div className="grid gap-2">
                <Label htmlFor="aulas">Aulas Asignadas *</Label>
                {aulas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay aulas disponibles en esta ONG. Crea aulas primero antes de asignar un tutor.
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
                              setValue('aulas', newAulas)
                            } else {
                              const newAulas = selectedAulas.filter((id) => id !== aula.id)
                              setSelectedAulas(newAulas)
                              setValue('aulas', newAulas)
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
                {selectedRol === 'tutor' && selectedAulas.length === 0 && (
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
                reset()
                setSelectedAulas([])
                setError(null)
                onOpenChange(false)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || (selectedRol === 'tutor' && selectedAulas.length === 0)}>
              {loading ? 'Agregando...' : 'Agregar Miembro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

