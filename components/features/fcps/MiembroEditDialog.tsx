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
import { toast } from '@/lib/toast'
import { Checkbox } from '@/components/ui/checkbox'
import { useUserRole } from '@/hooks/useUserRole'

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
  // Nuevo estado para roles múltiples (solo para directores)
  const [selectedRoles, setSelectedRoles] = useState<Array<'secretario' | 'tutor'>>([])
  const [existingRoles, setExistingRoles] = useState<Array<{ id: string; rol: string; activo: boolean }>>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const { isSecretario, isDirector, isFacilitador } = useUserRole(miembro.fcp_id)
  
  // El director NO puede modificar ni eliminar el rol de director de ningún usuario (incluido él mismo).
  // PERO SÍ puede agregar otros roles (secretario, tutor) a un director.
  // El secretario solo puede editar miembros con rol tutor.
  const canEditThisMember = isFacilitador || isDirector || (isSecretario && miembro.rol === 'tutor')
  
  // Director/secretario NO pueden ponerse inactivos a sí mismos.
  const isEditingSelf = Boolean(currentUserId && miembro.usuario_id === currentUserId)
  const cannotSetInactive = (isDirector && !isFacilitador && isEditingSelf) || (isSecretario && isEditingSelf)
  
  // Si es director (pero no facilitador), permitir asignar múltiples roles
  // IMPORTANTE: Un director puede tener también el rol de tutor, pero debe poder gestionar todas las aulas
  const canAssignMultipleRoles = isDirector && !isFacilitador
  
  // Obtener usuario actual para reglas (director/secretario no pueden inactivarse a sí mismos)
  useEffect(() => {
    if (open) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUserId(user?.id ?? null)
      })
    }
  }, [open])

  // Debug: Log cuando el componente se monta o cuando cambian los roles
  useEffect(() => {
    if (open && miembro) {
      console.log('🔍 MiembroEditDialog - Roles del usuario actual:', {
        isDirector,
        isFacilitador,
        isSecretario,
        canAssignMultipleRoles,
        fcpId: miembro.fcp_id
      })
    }
  }, [open, miembro, isDirector, isFacilitador, isSecretario, canAssignMultipleRoles])

  useEffect(() => {
    if (miembro) {
      setRol(miembro.rol)
      
      // Si el usuario es secretario y el miembro no es tutor, mostrar error
      if (isSecretario && miembro.rol !== 'tutor') {
        setError('Como secretario, solo puedes editar miembros con rol tutor.')
      } else {
        setError(null)
      }
      
      // Si es director, cargar todos los roles existentes del usuario en esta FCP
      if (canAssignMultipleRoles && miembro.usuario_id) {
        loadExistingRoles()
      }
    }
  }, [miembro, isSecretario, canAssignMultipleRoles])
  
  const loadExistingRoles = async () => {
    if (!miembro?.usuario_id) return
    
    try {
      // Cargar TODOS los roles del usuario (activos e inactivos)
      const { data: allRoles, error: allRolesError } = await supabase
        .from('fcp_miembros')
        .select('id, rol, activo')
        .eq('usuario_id', miembro.usuario_id)
        .eq('fcp_id', miembro.fcp_id)
      
      if (allRolesError) {
        console.error('Error loading all roles:', allRolesError)
        return
      }
      
      // Determinar si el usuario tiene al menos un rol activo
      const tieneRolActivo = (allRoles || []).some(r => r.activo)
      setActivo(tieneRolActivo)
      
      // Cargar solo roles activos para el selector
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select('id, rol, activo')
        .eq('usuario_id', miembro.usuario_id)
        .eq('fcp_id', miembro.fcp_id)
        .eq('activo', true)
        .in('rol', ['secretario', 'tutor'])
      
      if (error) {
        console.error('Error loading existing roles:', error)
        return
      }
      
      setExistingRoles(data || [])
      
      // Inicializar selectedRoles con los roles existentes
      const roles = (data || [])
        .filter(r => r.rol === 'secretario' || r.rol === 'tutor')
        .map(r => r.rol as 'secretario' | 'tutor')
      setSelectedRoles(roles)
    } catch (err) {
      console.error('Error loading existing roles:', err)
    }
  }

  // Determinar si se debe mostrar el selector de aulas
  // - Para directores: cuando tutor está en selectedRoles
  // - Para secretarios: cuando el rol original es tutor
  const shouldShowAulas = 
    (canAssignMultipleRoles && selectedRoles.includes('tutor')) || 
    (isSecretario && !isDirector && rol === 'tutor')

  useEffect(() => {
    // Cargar aulas si:
    // - Es director y tutor está seleccionado, O
    // - Es secretario editando un tutor
    if (open && miembro && shouldShowAulas) {
      loadAulas()
      loadAulasAsignadas()
    } else if (!open) {
      // Limpiar cuando se cierra el diálogo
      setAulas([])
      setSelectedAulas([])
      setSelectedRoles([])
      setExistingRoles([])
    } else if (canAssignMultipleRoles && !selectedRoles.includes('tutor')) {
      // Limpiar aulas si tutor no está seleccionado (solo para directores con múltiples roles)
      setSelectedAulas([])
    }
  }, [open, miembro, shouldShowAulas, canAssignMultipleRoles, selectedRoles])

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

      // 2. Obtener aulas que ya tienen tutor asignado
      // Excluir las aulas asignadas al tutor actual (o a cualquier rol tutor del mismo usuario)
      let tutorIdsToExclude: string[] = [miembro.id]

      // Si es director con múltiples roles, también excluir otros roles tutor del mismo usuario
      if (canAssignMultipleRoles && miembro.usuario_id) {
        const { data: tutorRecords } = await supabase
          .from('fcp_miembros')
          .select('id')
          .eq('usuario_id', miembro.usuario_id)
          .eq('fcp_id', miembro.fcp_id)
          .eq('rol', 'tutor')
          .eq('activo', true)
        
        if (tutorRecords && tutorRecords.length > 0) {
          tutorIdsToExclude = tutorRecords.map(tr => tr.id)
        }
      }

      const { data: aulasConTutor, error: tutorError } = await supabase
        .from('tutor_aula')
        .select('aula_id, fcp_miembro_id')
        .eq('fcp_id', miembro.fcp_id)
        .eq('activo', true)

      if (tutorError && tutorError.code !== 'PGRST116') {
        throw tutorError
      }

      // 3. Filtrar: mostrar solo aulas SIN tutor O aulas asignadas al tutor actual
      // Esto permite que el tutor vea sus aulas actuales y pueda cambiarlas,
      // pero NO permite asignar aulas que ya tienen otro tutor
      const aulasIdsConOtroTutor = new Set(
        (aulasConTutor || [])
          .filter(ta => !tutorIdsToExclude.includes(ta.fcp_miembro_id))
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
    if (!miembro) return
    
    // Si es director con múltiples roles, buscar todas las aulas asignadas a cualquier rol tutor del usuario
    if (canAssignMultipleRoles && miembro.usuario_id) {
      try {
        // Buscar todos los registros de tutor activos del usuario en esta FCP
        const { data: tutorRecords, error: tutorRecordsError } = await supabase
          .from('fcp_miembros')
          .select('id')
          .eq('usuario_id', miembro.usuario_id)
          .eq('fcp_id', miembro.fcp_id)
          .eq('rol', 'tutor')
          .eq('activo', true)

        if (tutorRecordsError) {
          console.error('Error loading tutor records:', tutorRecordsError)
          return
        }

        if (tutorRecords && tutorRecords.length > 0) {
          // Obtener todas las aulas asignadas a estos registros de tutor
          const tutorIds = tutorRecords.map(tr => tr.id)
          const { data, error } = await supabase
            .from('tutor_aula')
            .select('aula_id')
            .in('fcp_miembro_id', tutorIds)
            .eq('activo', true)

          if (error) {
            console.error('Error loading aulas asignadas:', error)
            return
          }

          const aulaIds = (data || []).map(ta => ta.aula_id)
          setSelectedAulas(aulaIds)
        } else {
          // Si no hay registros de tutor, limpiar las aulas seleccionadas
          setSelectedAulas([])
        }
      } catch (err) {
        console.error('Error loading aulas asignadas:', err)
        setSelectedAulas([])
      }
    } else if (rol === 'tutor') {
      // Lógica original para un solo rol tutor
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
  }

  /** Quitar el rol de tutor: elimina asignaciones tutor_aula y el registro de miembro (o lo deja sin rol tutor). */
  const onSubmit = async () => {
    try {
      setLoading(true)
      setError(null)

      // Validar permisos: secretarios solo pueden editar tutores
      if (isSecretario && miembro.rol !== 'tutor') {
        setError('Como secretario, solo puedes editar miembros con rol tutor.')
        setLoading(false)
        return
      }

      // Director/secretario no pueden ponerse inactivos a sí mismos
      if (cannotSetInactive && !activo) {
        setError('No puedes ponerte inactivo a ti mismo.')
        setLoading(false)
        return
      }

      // Si es director y puede asignar múltiples roles, manejar la lógica de múltiples roles
      if (canAssignMultipleRoles) {
        await handleMultipleRolesUpdate()
        return
      }

      // Validar que si es tutor y está activo, tenga al menos una aula asignada
      if (activo && rol === 'tutor' && selectedAulas.length === 0) {
        setError('Debes asignar al menos una aula al tutor.')
        setLoading(false)
        return
      }

      // Si se está cambiando a director, verificar si el usuario ya tiene otro rol (como tutor)
      // Si tiene otro rol, crear un nuevo registro como director en lugar de actualizar el existente
      if (rol === 'director' && miembro.rol !== 'director') {
        // Verificar si el usuario ya tiene otro registro activo en esta FCP con un rol diferente
        const { data: otrosRoles, error: otrosRolesError } = await supabase
          .from('fcp_miembros')
          .select('id, rol')
          .eq('usuario_id', miembro.usuario_id)
          .eq('fcp_id', miembro.fcp_id)
          .eq('activo', true)
          .neq('id', miembro.id)
        
        if (otrosRolesError) {
          console.error('Error verificando otros roles:', otrosRolesError)
          setError('Error al verificar otros roles del usuario.')
          setLoading(false)
          return
        }

        // Si el usuario tiene otros roles activos, crear un nuevo registro como director
        // en lugar de actualizar el registro existente (para preservar el otro rol)
        if (otrosRoles && otrosRoles.length > 0) {
          console.log('Usuario tiene otros roles activos, creando nuevo registro como director:', otrosRoles)
          
          // Crear nuevo registro como director
          const { data: nuevoDirector, error: insertError } = await supabase
            .from('fcp_miembros')
            .insert({
              usuario_id: miembro.usuario_id,
              fcp_id: miembro.fcp_id,
              rol: 'director',
              activo: true,
            })
            .select('id')
            .single()

          if (insertError) {
            console.error('Error creando nuevo registro como director:', insertError)
            setError('Error al crear el registro de director. Por favor, intenta nuevamente.')
            setLoading(false)
            return
          }

          // Manejar el cambio del director anterior
          const { error: directorChangeError } = await supabase.rpc('manejar_cambio_director', {
            p_fcp_id: miembro.fcp_id,
            p_nuevo_director_id: nuevoDirector.id,
            p_nuevo_director_usuario_id: miembro.usuario_id
          })

          if (directorChangeError) {
            console.error('Error al manejar cambio de director:', directorChangeError)
            // Intentar eliminar el registro que acabamos de crear
            await supabase.from('fcp_miembros').delete().eq('id', nuevoDirector.id)
            setError('Error al cambiar el director. Por favor, intenta nuevamente.')
            setLoading(false)
            return
          }

          // No actualizar el registro existente, solo refrescar la lista
          setError(null)
          toast.success('Director actualizado')
          onSuccess()
          return
        } else {
          // Si no tiene otros roles, actualizar el registro existente normalmente
          const { error: directorChangeError } = await supabase.rpc('manejar_cambio_director', {
            p_fcp_id: miembro.fcp_id,
            p_nuevo_director_id: miembro.id,
            p_nuevo_director_usuario_id: miembro.usuario_id
          })

          if (directorChangeError) {
            console.error('Error al manejar cambio de director:', directorChangeError)
            setError('Error al cambiar el director. Por favor, intenta nuevamente.')
            setLoading(false)
            return
          }
        }
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
          if (isSecretario && miembro.rol !== 'tutor') {
            setError('Como secretario, solo puedes editar miembros con rol tutor.')
          } else {
          setError('No tienes permisos para actualizar miembros. Solo los facilitadores, directores y secretarios pueden hacerlo.')
          }
        } else {
          throw updateError
        }
        setLoading(false)
        return
      }

      // Si el rol es tutor, manejar asignaciones de aulas según el estado
      if (rol === 'tutor') {
        if (!activo) {
          // Si está inactivo, eliminar todas las asignaciones de aulas
          const { error: deleteAssignmentsError } = await supabase
            .from('tutor_aula')
            .delete()
            .eq('fcp_miembro_id', miembro.id)

          if (deleteAssignmentsError) throw deleteAssignmentsError
        } else {
          // Si está activo, actualizar las asignaciones de aulas
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
      toast.updated('Miembro')
      onSuccess()
    } catch (err: any) {
      console.error('Error updating miembro:', err)
      toast.error('Error al actualizar miembro', err?.message)
      setError(err.message || 'Error al actualizar el miembro. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleMultipleRolesUpdate = async () => {
    // Si está inactivo, desactivar todos los roles del miembro en esta FCP
    // Esto funciona tanto para miembros con usuario_id como para invitaciones pendientes (email_pendiente)
    if (!activo) {
      if (miembro.usuario_id) {
        // Si tiene usuario_id, desactivar todos los roles del usuario en esta FCP
        const { error: deactivateAllError } = await supabase
          .from('fcp_miembros')
          .update({ activo: false })
          .eq('usuario_id', miembro.usuario_id)
          .eq('fcp_id', miembro.fcp_id)
        
        if (deactivateAllError) {
          console.error('Error desactivando todos los roles:', deactivateAllError)
          throw deactivateAllError
        }
        
        // Eliminar todas las asignaciones de aulas de todos los roles tutor del usuario
        const { data: tutorRecords } = await supabase
          .from('fcp_miembros')
          .select('id')
          .eq('usuario_id', miembro.usuario_id)
          .eq('fcp_id', miembro.fcp_id)
          .eq('rol', 'tutor')
        
        if (tutorRecords && tutorRecords.length > 0) {
          const tutorIds = tutorRecords.map(tr => tr.id)
          const { error: deleteAssignmentsError } = await supabase
            .from('tutor_aula')
            .delete()
            .in('fcp_miembro_id', tutorIds)
          
          if (deleteAssignmentsError) {
            console.error('Error eliminando asignaciones de aulas:', deleteAssignmentsError)
            throw deleteAssignmentsError
          }
        }
      } else {
        // Si no tiene usuario_id (invitación pendiente), solo desactivar este registro específico
        const { error: deactivateError } = await supabase
          .from('fcp_miembros')
          .update({ activo: false })
          .eq('id', miembro.id)
        
        if (deactivateError) {
          console.error('Error desactivando miembro:', deactivateError)
          throw deactivateError
        }
        
        // Si es tutor, eliminar asignaciones de aulas de este registro específico
        if (miembro.rol === 'tutor') {
          const { error: deleteAssignmentsError } = await supabase
            .from('tutor_aula')
            .delete()
            .eq('fcp_miembro_id', miembro.id)
          
          if (deleteAssignmentsError) {
            console.error('Error eliminando asignaciones de aulas:', deleteAssignmentsError)
            throw deleteAssignmentsError
          }
        }
      }
      
      setError(null)
      toast.deleted('Miembro')
      onSuccess()
      setLoading(false)
      return
    }

    // Si está activo, requerir usuario_id para asignar roles
    if (!miembro.usuario_id) {
      setError('El miembro debe tener un usuario asociado para asignar roles.')
      setLoading(false)
      return
    }

    // Validar que si tutor está seleccionado y está activo, tenga al menos una aula asignada
    if (selectedRoles.includes('tutor') && selectedAulas.length === 0) {
      setError('Si asignas el rol de tutor, debes asignar al menos una aula.')
      setLoading(false)
      return
    }

    // Función auxiliar para asignar aulas a un tutor
    const assignAulasToTutor = async (tutorMemberId: string) => {
      // Primero, obtener las aulas actualmente asignadas a este tutor
      const { data: existingAssignments, error: fetchError } = await supabase
        .from('tutor_aula')
        .select('aula_id')
        .eq('fcp_miembro_id', tutorMemberId)
        .eq('activo', true)

      if (fetchError) {
        console.error('Error obteniendo asignaciones existentes:', fetchError)
        throw fetchError
      }

      const existingAulaIds = new Set((existingAssignments || []).map(a => a.aula_id))
      const selectedAulaIds = new Set(selectedAulas)

      // Identificar aulas a eliminar (están asignadas pero no están en la selección)
      const aulasToRemove = Array.from(existingAulaIds).filter(id => !selectedAulaIds.has(id))
      
      // Identificar aulas a agregar (están en la selección pero no están asignadas)
      const aulasToAdd = Array.from(selectedAulaIds).filter(id => !existingAulaIds.has(id))

      // Eliminar cualquier tutor previo de las aulas seleccionadas (excepto el tutor actual)
      for (const aulaId of selectedAulas) {
        const { error: deleteOldTutorError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('aula_id', aulaId)
          .eq('activo', true)
          .neq('fcp_miembro_id', tutorMemberId)

        if (deleteOldTutorError) {
          console.error(`Error eliminando tutor previo del aula ${aulaId}:`, deleteOldTutorError)
          throw deleteOldTutorError
        }
      }

      // Eliminar asignaciones que ya no están seleccionadas
      if (aulasToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('fcp_miembro_id', tutorMemberId)
          .in('aula_id', aulasToRemove)

        if (deleteError) {
          console.error('Error eliminando asignaciones antiguas:', deleteError)
          throw deleteError
        }
      }

      // Insertar solo las nuevas asignaciones que no existen
      if (aulasToAdd.length > 0) {
        const assignments = aulasToAdd.map(aulaId => ({
          fcp_miembro_id: tutorMemberId,
          aula_id: aulaId,
          fcp_id: miembro.fcp_id,
          activo: true,
        }))

        const { error: assignError } = await supabase
          .from('tutor_aula')
          .insert(assignments)

        if (assignError) {
          console.error('Error asignando aulas:', assignError)
          throw assignError
        }
      }
    }

    // Obtener los roles que deben existir y los que deben eliminarse
    const rolesToKeep = selectedRoles
    const existingRoleNames = existingRoles.map(r => r.rol as 'secretario' | 'tutor')

    // Crear o actualizar roles seleccionados
    for (const roleToAssign of rolesToKeep) {
      const existingRole = existingRoles.find(r => r.rol === roleToAssign)
      
      if (existingRole) {
        // El rol ya existe, asegurar que esté activo
        if (!existingRole.activo) {
          const { error: updateError } = await supabase
            .from('fcp_miembros')
            .update({ activo: true })
            .eq('id', existingRole.id)
          
          if (updateError) {
            console.error(`Error activando rol ${roleToAssign}:`, updateError)
            throw updateError
          }
        }
        
        // Si es tutor y ya existe, actualizar las aulas asignadas
        if (roleToAssign === 'tutor' && selectedAulas.length > 0) {
          await assignAulasToTutor(existingRole.id)
        }
      } else {
        // Verificar si hay un registro inactivo antes de crear uno nuevo
        const { data: inactiveRole, error: checkInactiveError } = await supabase
          .from('fcp_miembros')
          .select('id')
          .eq('usuario_id', miembro.usuario_id)
          .eq('fcp_id', miembro.fcp_id)
          .eq('rol', roleToAssign)
          .eq('activo', false)
          .maybeSingle()

        if (checkInactiveError && checkInactiveError.code !== 'PGRST116') {
          console.error(`Error verificando rol inactivo ${roleToAssign}:`, checkInactiveError)
          throw checkInactiveError
        }

        if (inactiveRole) {
          // Reactivar el rol inactivo
          const { error: reactivateError } = await supabase
            .from('fcp_miembros')
            .update({ activo: true })
            .eq('id', inactiveRole.id)

          if (reactivateError) {
            console.error(`Error reactivando rol ${roleToAssign}:`, reactivateError)
            throw reactivateError
          }
          
          // Si es tutor, asignar aulas
          if (roleToAssign === 'tutor' && selectedAulas.length > 0) {
            await assignAulasToTutor(inactiveRole.id)
          }
        } else {
          // El rol no existe, crear uno nuevo
          const { data: newRole, error: insertError } = await supabase
            .from('fcp_miembros')
            .insert({
              usuario_id: miembro.usuario_id,
              fcp_id: miembro.fcp_id,
              rol: roleToAssign,
              activo: true,
            })
            .select('id')
            .single()

          if (insertError) {
            // Si el error es de duplicado, verificar si se creó en otro proceso
            if (insertError.code === '23505') {
              console.warn(`Rol ${roleToAssign} ya existe (posible condición de carrera), verificando...`)
              
              // Verificar si el rol se creó en otro proceso
              const { data: newlyCreatedRole } = await supabase
                .from('fcp_miembros')
                .select('id')
                .eq('usuario_id', miembro.usuario_id)
                .eq('fcp_id', miembro.fcp_id)
                .eq('rol', roleToAssign)
                .eq('activo', true)
                .maybeSingle()

              if (!newlyCreatedRole) {
                // Si realmente no existe, lanzar el error original
                console.error(`Error creando rol ${roleToAssign}:`, insertError)
                throw insertError
              }
              
              // Si existe, usar ese rol para asignar aulas
              if (roleToAssign === 'tutor' && selectedAulas.length > 0) {
                await assignAulasToTutor(newlyCreatedRole.id)
              }
              // Continuar con el siguiente rol
              continue
            } else {
              console.error(`Error creando rol ${roleToAssign}:`, insertError)
              throw insertError
            }
          }

          // Si es tutor, asignar aulas
          if (roleToAssign === 'tutor' && newRole && selectedAulas.length > 0) {
            await assignAulasToTutor(newRole.id)
          }
        }
      }
    }

    // Desactivar roles que ya no están seleccionados
    const rolesToDeactivate = existingRoleNames.filter(r => !rolesToKeep.includes(r))
    console.log('🔍 Roles a desactivar:', {
      rolesToDeactivate,
      existingRoleNames,
      rolesToKeep,
      existingRoles
    })
    
    for (const roleToDeactivate of rolesToDeactivate) {
      const roleToDeactivateRecord = existingRoles.find(r => r.rol === roleToDeactivate)
      if (roleToDeactivateRecord) {
        console.log(`🔄 Desactivando rol ${roleToDeactivate}:`, roleToDeactivateRecord)
        
        const { data: updateResult, error: deactivateError } = await supabase
          .from('fcp_miembros')
          .update({ activo: false })
          .eq('id', roleToDeactivateRecord.id)
          .select()

        if (deactivateError) {
          console.error(`❌ Error desactivando rol ${roleToDeactivate}:`, deactivateError)
          throw deactivateError
        }
        
        console.log(`✅ Rol ${roleToDeactivate} desactivado exitosamente:`, updateResult)

        // Si se desactiva tutor, eliminar asignaciones de aulas
        if (roleToDeactivate === 'tutor') {
          const { error: deleteAssignmentsError } = await supabase
            .from('tutor_aula')
            .delete()
            .eq('fcp_miembro_id', roleToDeactivateRecord.id)

          if (deleteAssignmentsError) {
            console.error('Error eliminando asignaciones de aulas:', deleteAssignmentsError)
            throw deleteAssignmentsError
          }
        }
      }
    }

    // NOTA: La actualización de aulas del tutor ya se maneja en el bucle anterior
    // cuando se procesa cada rol (líneas 539-540, 572, 610, 622, 659).
    // No es necesario hacerlo nuevamente aquí para evitar duplicados.

    console.log('✅ Actualización de roles completada exitosamente')
    setError(null)
    toast.updated('Miembro')
    console.log('🔄 Llamando a onSuccess() para recargar la lista')
    onSuccess()
    setLoading(false)
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
        {!canEditThisMember && isSecretario && miembro.rol !== 'tutor' && (
          <div className="mb-4 rounded-md bg-amber-50 p-4 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <p className="text-sm">
              Como secretario, solo puedes editar miembros con rol tutor.
            </p>
          </div>
        )}
        {miembro.rol === 'director' && isDirector && !isFacilitador && (
          <div className="mb-4 rounded-md bg-blue-50 p-4 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <p className="text-sm">
              ℹ️ Puedes agregar roles adicionales (secretario, tutor) a este director, pero no puedes eliminar el rol de director.
            </p>
          </div>
        )}
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <p className="text-sm text-muted-foreground font-mono">
              {miembro.usuario?.email || 'Sin email'}
            </p>
          </div>
          {/* Si es director (pero no facilitador), mostrar selector de múltiples roles */}
          {canAssignMultipleRoles ? (
            <div className="grid gap-2">
              <Label>Roles *</Label>
              <div className="space-y-3 border rounded-md p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rol-secretario"
                    checked={selectedRoles.includes('secretario')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, 'secretario'])
                      } else {
                        setSelectedRoles(selectedRoles.filter(r => r !== 'secretario'))
                      }
                    }}
                    disabled={!activo || !canEditThisMember}
                  />
                  <label
                    htmlFor="rol-secretario"
                    className={`text-sm font-medium leading-none ${!activo || !canEditThisMember ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {getRolDisplayName('secretario')}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rol-tutor"
                    checked={selectedRoles.includes('tutor')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, 'tutor'])
                      } else {
                        setSelectedRoles(selectedRoles.filter(r => r !== 'tutor'))
                        setSelectedAulas([]) // Limpiar aulas si se desmarca tutor
                      }
                    }}
                    disabled={!activo || !canEditThisMember}
                  />
                  <label
                    htmlFor="rol-tutor"
                    className={`text-sm font-medium leading-none ${!activo || !canEditThisMember ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {getRolDisplayName('tutor')}
                  </label>
                </div>
              </div>
              {selectedRoles.length === 0 && activo && (
                <p className="text-xs text-muted-foreground">
                  {miembro.rol === 'director' 
                    ? 'Si no seleccionas ningún rol adicional, el director mantendrá solo el rol de director.'
                    : 'Si no seleccionas ningún rol, el usuario quedará sin roles asignados.'}
                </p>
              )}
              {!activo && (
                <p className="text-xs text-muted-foreground">
                  Los roles están bloqueados cuando el miembro está inactivo.
                </p>
              )}
              {activo && (
                <p className="text-xs text-muted-foreground">
                  {miembro.rol === 'director' 
                    ? 'Puedes agregar roles adicionales (secretario y/o tutor) a este director. El rol de director se mantendrá.'
                    : 'Como director, puedes asignar uno o ambos roles al miembro.'}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="rol">Rol *</Label>
              <Select 
                value={rol} 
                onValueChange={(value) => {
                  // Si el usuario es secretario, solo permitir mantener el rol como tutor
                  if (isSecretario && value !== 'tutor') {
                    setError('Como secretario, solo puedes editar miembros con rol tutor.')
                    return
                  }
                  // Director no puede asignar director
                  if (isDirector && !isFacilitador && value === 'director') {
                    setError('Como director, no puedes asignar el rol de director.')
                    return
                  }
                  // El rol Facilitador solo se asigna en BD; nunca desde la UI.
                  if (value === 'facilitador') {
                    setError('El rol Facilitador solo se asigna en base de datos.')
                    return
                  }
                  setRol(value as 'director' | 'secretario' | 'tutor')
                }}
                disabled={!activo || !canEditThisMember || (isSecretario && miembro.rol === 'tutor')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {/* Facilitadores pueden asignar director, secretario, tutor. Nunca facilitador (solo en BD). */}
                  {isFacilitador && (
                    <>
                      <SelectItem value="director">{getRolDisplayName('director')}</SelectItem>
                      <SelectItem value="secretario">{getRolDisplayName('secretario')}</SelectItem>
                      <SelectItem value="tutor">{getRolDisplayName('tutor')}</SelectItem>
                    </>
                  )}
                  {/* Directores solo pueden asignar secretario y tutor */}
                  {isDirector && !isFacilitador && (
                    <>
                      <SelectItem value="secretario">{getRolDisplayName('secretario')}</SelectItem>
                      <SelectItem value="tutor">{getRolDisplayName('tutor')}</SelectItem>
                    </>
                  )}
                  {/* Secretarios solo pueden asignar tutor */}
                  {isSecretario && !isDirector && !isFacilitador && (
                    <SelectItem value="tutor">{getRolDisplayName('tutor')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isSecretario && (
                <p className="text-xs text-muted-foreground">
                  Como secretario, solo puedes editar miembros con rol tutor.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="activo">Estado</Label>
            <Select
              value={activo ? 'activo' : 'inactivo'}
              onValueChange={(value) => setActivo(value === 'activo')}
              disabled={!canEditThisMember || cannotSetInactive}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
            {cannotSetInactive && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No puedes ponerte inactivo a ti mismo.
              </p>
            )}
          </div>

          {/* Selector de aulas (para tutores - tanto directores como secretarios) */}
          {shouldShowAulas && (
            <div className="grid gap-2">
              <Label htmlFor="aulas">Aulas Asignadas *</Label>
              {!activo ? (
                <p className="text-sm text-muted-foreground">
                  Las aulas están bloqueadas cuando el miembro está inactivo.
                </p>
              ) : loadingAulas ? (
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
                        disabled={!activo}
                      />
                      <label
                        htmlFor={`aula-${aula.id}`}
                        className={`text-sm font-medium leading-none ${!activo ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        {aula.nombre}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {activo && selectedAulas.length === 0 && (
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
            disabled={
              loading ||
              !canEditThisMember || 
              (activo && shouldShowAulas && selectedAulas.length === 0)
            }
          >
            {loading ? 'Actualizando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

