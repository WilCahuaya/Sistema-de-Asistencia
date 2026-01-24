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
import { useUserRole } from '@/hooks/useUserRole'

interface MiembroFormData {
  email: string
  rol: 'secretario' | 'tutor' // Los directores solo pueden crear secretarios o tutores
  aulas?: string[] // IDs de aulas asignadas (solo para tutores)
}

interface MiembroAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
}

export function MiembroAddDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
}: MiembroAddDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [selectedAulas, setSelectedAulas] = useState<string[]>([])
  const [fcpNombre, setFcpNombre] = useState<string>('')
  const supabase = createClient()
  const { role: userRole, isDirector, isSecretario } = useUserRole(fcpId)
  
  // Roles disponibles según el usuario que está creando el miembro
  // Los directores pueden crear secretarios o tutores
  // Los secretarios solo pueden crear tutores
  // Si el usuario tiene múltiples roles, se prioriza el más alto (director > secretario)
  const availableRoles: Array<'secretario' | 'tutor'> = 
    (isSecretario && !isDirector) // Solo secretario (no director)
      ? ['tutor'] 
      : ['secretario', 'tutor'] // Director o múltiples roles (se prioriza director)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<MiembroFormData>({
    defaultValues: {
      rol: availableRoles[0] as 'secretario' | 'tutor', // Usar el primer rol disponible
      aulas: [],
    },
  })

  const selectedRol = watch('rol')

  // Cargar nombre de la FCP y aulas cuando el diálogo se abre
  useEffect(() => {
    if (open && fcpId) {
      loadFCPNombre()
      if (selectedRol === 'tutor') {
        loadAulas()
      }
    } else if (!open) {
      // Limpiar cuando se cierra el diálogo
      setAulas([])
      setSelectedAulas([])
      setFcpNombre('')
      reset()
    } else if (selectedRol !== 'tutor') {
      // Limpiar aulas si cambia el rol a algo que no sea tutor
      setSelectedAulas([])
      setValue('aulas', [])
    }
  }, [open, fcpId, selectedRol])

  const loadFCPNombre = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('fcps')
        .select('razon_social')
        .eq('id', fcpId)
        .single()

      if (error) throw error
      if (data) {
        setFcpNombre(data.razon_social)
      }
    } catch (error) {
      console.error('Error loading FCP nombre:', error)
    }
  }

  const loadAulas = async () => {
    try {
      const supabase = createClient()
      
      // 1. Obtener todas las aulas de la FCP
      const { data: todasLasAulas, error: aulasError } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', fcpId)
        .eq('activa', true)
        .order('nombre')

      if (aulasError) throw aulasError

      // 2. Obtener aulas que ya tienen tutor asignado
      const { data: aulasConTutor, error: tutorError } = await supabase
        .from('tutor_aula')
        .select('aula_id')
        .eq('fcp_id', fcpId)
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

      // Verificar autenticación y obtener usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error de autenticación:', userError)
        setError('Error de autenticación. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      // Verificar sesión activa
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        console.error('Error de sesión:', sessionError)
        console.error('No hay sesión activa')
        setError('No hay sesión activa. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      console.log('Usuario autenticado:', user.id)
      console.log('Sesión activa:', !!session)
      console.log('Token de acceso presente:', !!session?.access_token)

      // NOTA: La verificación de permisos se hace en MiembrosList.tsx
      // Solo directores y secretarios pueden ver el botón "Agregar Miembro"
      // La política INSERT en la base de datos permite inserción a usuarios autenticados
      // Confiamos en la verificación del botón para la seguridad

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
        // Usuario existe: verificar si ya tiene este rol específico en esta FCP
        const { data: memberData, error: checkError } = await supabase
          .from('fcp_miembros')
          .select('id, activo, usuario_id, rol')
          .eq('usuario_id', usuarioData.id)
          .eq('fcp_id', fcpId)
          .eq('rol', data.rol)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        existingMember = memberData
      } else {
        // Usuario no existe: verificar invitación pendiente por email con este rol específico
        const { data: pendingInvitation, error: checkError } = await supabase
          .from('fcp_miembros')
          .select('id, activo, email_pendiente, rol')
          .eq('email_pendiente', emailNormalizado)
          .eq('fcp_id', fcpId)
          .eq('rol', data.rol)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        existingMember = pendingInvitation
      }

      // 3. Si ya existe una membresía activa con este rol específico, mostrar error
      if (existingMember && existingMember.activo) {
        setError(`Este usuario ya tiene el rol de ${getRolDisplayName(data.rol)} activo en esta FCP.`)
        setLoading(false)
        return
      }

      // 4. Si existe pero está inactivo, reactivar y actualizar rol y aulas
      if (existingMember && !existingMember.activo) {
        // Si se está asignando como director, manejar el cambio del director anterior
        if (data.rol === 'director') {
          const { error: directorChangeError } = await supabase.rpc('manejar_cambio_director', {
            p_fcp_id: fcpId,
            p_nuevo_director_id: existingMember.id,
            p_nuevo_director_usuario_id: existingMember.usuario_id
          })

          if (directorChangeError) {
            console.error('Error al manejar cambio de director:', directorChangeError)
            throw new Error('Error al cambiar el director. Por favor, intenta nuevamente.')
          }
        }

        const { data: updatedMember, error: updateError } = await supabase
          .from('fcp_miembros')
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
            .eq('fcp_miembro_id', updatedMember.id)

          if (deleteOldAssignmentsError) throw deleteOldAssignmentsError

          // Insertar nuevas asignaciones (ahora las aulas están libres)
          const assignments = data.aulas.map(aulaId => ({
            fcp_miembro_id: updatedMember.id,
            aula_id: aulaId,
            fcp_id: fcpId,
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
      // Si se está asignando como director, verificar si el usuario tiene otros roles activos
      // Si tiene otros roles, crear un nuevo registro en lugar de actualizar
      if (data.rol === 'director' && usuarioData) {
        // Verificar si el usuario ya tiene otros roles activos en esta FCP
        const { data: otrosRoles, error: otrosRolesError } = await supabase
          .from('fcp_miembros')
          .select('id, rol')
          .eq('usuario_id', usuarioData.id)
          .eq('fcp_id', fcpId)
          .eq('activo', true)
        
        if (otrosRolesError) {
          console.error('Error verificando otros roles:', otrosRolesError)
          setError('Error al verificar otros roles del usuario.')
          setLoading(false)
          return
        }

        // Si el usuario tiene otros roles activos, crear un nuevo registro como director
        // en lugar de usar la función que podría actualizar el existente
        if (otrosRoles && otrosRoles.length > 0) {
          console.log('Usuario tiene otros roles activos, creando nuevo registro como director:', otrosRoles)
          
          // Crear nuevo registro como director directamente
          const { data: nuevoDirector, error: insertError } = await supabase
            .from('fcp_miembros')
            .insert({
              usuario_id: usuarioData.id,
              fcp_id: fcpId,
              rol: 'director',
              activo: true,
            })
            .select('id, usuario_id')
            .single()

          if (insertError) {
            console.error('Error creando nuevo registro como director:', insertError)
            setError('Error al crear el registro de director. Por favor, intenta nuevamente.')
            setLoading(false)
            return
          }

          // Manejar el cambio del director anterior
          const { error: directorChangeError } = await supabase.rpc('manejar_cambio_director', {
            p_fcp_id: fcpId,
            p_nuevo_director_id: nuevoDirector.id,
            p_nuevo_director_usuario_id: nuevoDirector.usuario_id
          })

          if (directorChangeError) {
            console.error('Error al manejar cambio de director:', directorChangeError)
            // Intentar eliminar el registro que acabamos de crear
            await supabase.from('fcp_miembros').delete().eq('id', nuevoDirector.id)
            setError('Error al cambiar el director. Por favor, intenta nuevamente.')
            setLoading(false)
            return
          }

          // Éxito: nuevo registro creado, otros roles preservados
          reset()
          setError(null)
          onSuccess()
          return
        }
      }

      // Si no es director o no tiene otros roles, proceder con el flujo normal
      const insertData: any = {
        fcp_id: fcpId,
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

      console.log('Intentando insertar miembro con datos:', insertData)
      console.log('Usuario autenticado:', user.id)
      console.log('Sesión activa:', !!session)

      // Usar función SECURITY DEFINER para insertar (evita problemas de RLS)
      const { data: functionResult, error: insertError } = await supabase.rpc('insertar_miembro_fcp', {
        p_fcp_id: insertData.fcp_id,
        p_rol: insertData.rol,
        p_usuario_id: insertData.usuario_id || null,
        p_email_pendiente: insertData.email_pendiente || null,
        p_activo: insertData.activo
      })

      // La función retorna el objeto completo del miembro como JSONB
      let newFcpMiembro = null
      if (!insertError && functionResult) {
        // Convertir el JSONB a objeto JavaScript
        newFcpMiembro = functionResult as any
        console.log('Miembro creado exitosamente:', newFcpMiembro)
      }

      if (insertError) {
        console.error('Error al insertar miembro usando función RPC:', insertError)
        console.error('Código de error:', insertError.code)
        console.error('Mensaje de error:', insertError.message)
        console.error('Detalles:', insertError.details)
        console.error('Hint:', insertError.hint)
        console.error('Datos que se intentaron insertar:', insertData)
        console.error('Usuario autenticado:', user?.id)
        console.error('Sesión activa:', !!session)
        
        // Mostrar mensaje de error más informativo
        if (insertError.code === '42501') {
          setError(`Error de permisos (42501). Usuario: ${user?.id || 'no autenticado'}. Sesión: ${session ? 'activa' : 'inactiva'}. Verifica que la función insertar_miembro_fcp exista y que tengas permisos para ejecutarla.`)
        } else if (insertError.code === '42883') {
          setError(`La función insertar_miembro_fcp no existe. Verifica que la migración 20240101000063 se haya ejecutado correctamente.`)
        } else if (insertError.message && insertError.message.includes('duplicate key') || insertError.message.includes('unique constraint')) {
          setError('Este usuario ya tiene una invitación o membresía pendiente en esta FCP. Por favor, verifica la lista de miembros.')
        } else {
          setError(insertError.message || 'Error al agregar el miembro. Por favor, intenta nuevamente.')
        }
        setLoading(false)
        return
      }

      if (!newFcpMiembro) {
        console.error('La función retornó un ID pero no se pudo obtener el miembro creado')
        setError('Error al obtener el miembro creado. Por favor, intenta nuevamente.')
        setLoading(false)
        return
      }

      // Si se asignó como director, manejar el cambio del director anterior
      if (data.rol === 'director' && newFcpMiembro.id) {
        const { error: directorChangeError } = await supabase.rpc('manejar_cambio_director', {
          p_fcp_id: fcpId,
          p_nuevo_director_id: newFcpMiembro.id,
          p_nuevo_director_usuario_id: newFcpMiembro.usuario_id
        })

        if (directorChangeError) {
          console.error('Error al manejar cambio de director:', directorChangeError)
          // No lanzar error aquí, solo loguear, porque el miembro ya se creó
          // El usuario puede ver el error y corregirlo manualmente si es necesario
        }
      }

      // 6. Si es tutor y se seleccionaron aulas, asignar las aulas
      if (data.rol === 'tutor' && data.aulas && data.aulas.length > 0 && newFcpMiembro) {
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
          fcp_miembro_id: newFcpMiembro.id,
          aula_id: aulaId,
          fcp_id: fcpId,
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
            {fcpNombre && (
              <span className="block mb-2">
                <strong>FCP:</strong> {fcpNombre}
              </span>
            )}
            Agrega un usuario a esta FCP por su email. Si el usuario aún no se ha registrado, se creará una invitación pendiente que se activará automáticamente cuando se registre con Google OAuth.
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
                  {availableRoles.map((rol) => (
                    <SelectItem key={rol} value={rol}>
                      {getRolDisplayName(rol)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {userRole === 'secretario' 
                  ? 'Los secretarios solo pueden crear tutores.'
                  : 'Los directores pueden crear secretarios o tutores.'}
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
                    No hay aulas disponibles en esta FCP. Crea aulas primero antes de asignar un tutor.
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

