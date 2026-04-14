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
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { useUserRole } from '@/hooks/useUserRole'
import { getRolDisplayName } from '@/lib/utils/roles'
import { UserPlus } from 'lucide-react'

interface Tutor {
  usuario_fcp_id: string
  usuario_id: string | null
  email: string
  nombre_completo?: string
  /** Invitación pendiente (sin fila en usuarios aún) */
  esInvitacionPendiente?: boolean
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
  const [loadingInvitar, setLoadingInvitar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutores, setTutores] = useState<Tutor[]>([])
  const [selectedTutorUsuarioOngId, setSelectedTutorUsuarioOngId] = useState<string>('__none__')
  const [emailNuevo, setEmailNuevo] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const supabase = createClient()
  const { canEdit } = useUserRole(fcpId)

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
      setEmailNuevo('')
      setNombreNuevo('')
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
      // Sin !inner: incluye tutores con invitación pendiente (usuario_id null, email_pendiente).
      // Con usuarios!inner esos registros no aparecían en el desplegable.
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          usuario_id,
          email_pendiente,
          nombre_display,
          usuario:usuarios(id, email, nombre_completo)
        `)
        .eq('fcp_id', fcpId)
        .eq('rol', 'tutor')
        .eq('activo', true)

      if (error) throw error

      const tutoresList = (data || [])
        .map((item: any) => {
          const u = item.usuario
          const emailPend = (item.email_pendiente as string | null)?.trim() || ''
          const nombreDisplay = (item.nombre_display as string | null)?.trim() || ''
          const tieneUsuario = !!item.usuario_id && !!u
          return {
            usuario_fcp_id: item.id,
            usuario_id: item.usuario_id ?? null,
            email: (u?.email as string) || emailPend || '',
            nombre_completo:
              nombreDisplay ||
              (u?.nombre_completo as string | undefined) ||
              (tieneUsuario ? '' : emailPend || '(Invitación pendiente)'),
            esInvitacionPendiente: !tieneUsuario && !!emailPend,
          }
        })
        .sort((a, b) => {
          const labelA = a.nombre_completo || a.email || ''
          const labelB = b.nombre_completo || b.email || ''
          return labelA.localeCompare(labelB)
        })

      setTutores(tutoresList)
    } catch (error: any) {
      console.error('Error loading tutores:', error)
      setError(`Error al cargar tutores: ${error.message}`)
    }
  }

  /** Quita el tutor previo de esta aula y asigna `fcpMiembroId` como tutor del salón. */
  const asignarTutorAlAula = async (fcpMiembroId: string) => {
    const { error: deleteError } = await supabase.from('tutor_aula').delete().eq('aula_id', aulaId)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase.from('tutor_aula').insert({
      fcp_miembro_id: fcpMiembroId,
      aula_id: aulaId,
      fcp_id: fcpId,
      activo: true,
    })
    if (insertError) throw insertError
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
        await asignarTutorAlAula(selectedTutorUsuarioOngId)
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

  const handleInvitarNuevoTutor = async () => {
    const emailNormalizado = emailNuevo.toLowerCase().trim()
    if (!emailNormalizado) {
      setError('Indica el correo del nuevo tutor.')
      toast.error('Correo requerido', 'Indica el correo del nuevo tutor.')
      return
    }

    setLoadingInvitar(true)
    setError(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        setError('Error de autenticación. Inicia sesión nuevamente.')
        toast.error('Sesión', 'Inicia sesión nuevamente.')
        return
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setError('No hay sesión activa.')
        toast.error('Sesión', 'Inicia sesión nuevamente.')
        return
      }

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('email', emailNormalizado)
        .maybeSingle()

      if (usuarioError && usuarioError.code !== 'PGRST116') {
        throw usuarioError
      }

      let existingMember: {
        id: string
        activo: boolean
        usuario_id?: string | null
        email_pendiente?: string | null
      } | null = null

      if (usuarioData) {
        const { data: memberData, error: checkError } = await supabase
          .from('fcp_miembros')
          .select('id, activo, usuario_id, email_pendiente')
          .eq('usuario_id', usuarioData.id)
          .eq('fcp_id', fcpId)
          .eq('rol', 'tutor')
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        existingMember = memberData
      } else {
        const { data: pendingInvitation, error: checkError } = await supabase
          .from('fcp_miembros')
          .select('id, activo, usuario_id, email_pendiente')
          .eq('email_pendiente', emailNormalizado)
          .eq('fcp_id', fcpId)
          .eq('rol', 'tutor')
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        existingMember = pendingInvitation
      }

      if (existingMember?.activo) {
        await asignarTutorAlAula(existingMember.id)
        await loadTutores()
        setSelectedTutorUsuarioOngId(existingMember.id)
        setEmailNuevo('')
        setNombreNuevo('')
        toast.success('Tutor asignado', 'El tutor ya existía en la FCP; quedó asignado a este salón.')
        onSuccess()
        onOpenChange(false)
        return
      }

      if (existingMember && !existingMember.activo) {
        const { data: updatedMember, error: updateError } = await supabase
          .from('fcp_miembros')
          .update({
            rol: 'tutor',
            activo: true,
            usuario_id: usuarioData?.id ?? null,
            email_pendiente: usuarioData ? null : emailNormalizado,
            nombre_display: nombreNuevo.trim() || null,
          })
          .eq('id', existingMember.id)
          .select('id')
          .single()

        if (updateError) throw updateError
        if (!updatedMember) throw new Error('No se pudo reactivar el tutor.')

        const { error: deleteOldAssignmentsError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('fcp_miembro_id', updatedMember.id)
        if (deleteOldAssignmentsError) throw deleteOldAssignmentsError

        await asignarTutorAlAula(updatedMember.id)

        await loadTutores()
        setSelectedTutorUsuarioOngId(updatedMember.id)
        setEmailNuevo('')
        setNombreNuevo('')
        toast.success('Tutor reactivado', 'Se reactivó el tutor y se asignó a este salón.')
        onSuccess()
        onOpenChange(false)
        return
      }

      const { data: functionResult, error: insertError } = await supabase.rpc('insertar_miembro_fcp', {
        p_fcp_id: fcpId,
        p_rol: 'tutor',
        p_usuario_id: usuarioData?.id ?? null,
        p_email_pendiente: usuarioData ? null : emailNormalizado,
        p_activo: true,
        p_nombre_display: nombreNuevo.trim() || null,
      })

      if (insertError) {
        if (
          insertError.message?.includes('ya tiene el rol') ||
          insertError.message?.includes('activo en esta FCP')
        ) {
          setError(
            `Este usuario ya tiene el rol de ${getRolDisplayName('tutor')} activo en esta FCP. Puedes asignarlo desde la lista superior.`
          )
          toast.error('Miembro existente', insertError.message)
          return
        }
        throw insertError
      }

      const newFcpMiembro = functionResult as { id?: string } | null
      if (!newFcpMiembro?.id) {
        throw new Error('No se pudo crear el registro de tutor.')
      }

      await asignarTutorAlAula(newFcpMiembro.id)

      await loadTutores()
      setSelectedTutorUsuarioOngId(newFcpMiembro.id)
      setEmailNuevo('')
      setNombreNuevo('')
      toast.success('Tutor creado', 'Se invitó o registró el tutor y se asignó a este salón.')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error invitando tutor:', error)
      const msg = error?.message || 'Error al crear el tutor.'
      setError(msg)
      toast.error('Error', msg)
    } finally {
      setLoadingInvitar(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Asignar Tutor al Aula</DialogTitle>
          <DialogDescription>
            Asigna o cambia el tutor encargado del aula &quot;{aulaNombre}&quot;
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tutor">Tutor encargado</Label>
              <Select
                value={selectedTutorUsuarioOngId}
                onValueChange={setSelectedTutorUsuarioOngId}
                disabled={loading || loadingInvitar}
              >
                <SelectTrigger id="tutor">
                  <SelectValue placeholder="Selecciona un tutor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin tutor asignado</SelectItem>
                  {tutores.map((tutor) => {
                    const base = tutor.nombre_completo || tutor.email || 'Sin nombre'
                    const texto = tutor.esInvitacionPendiente ? `${base} (pendiente de registro)` : base
                    return (
                      <SelectItem key={tutor.usuario_fcp_id} value={tutor.usuario_fcp_id}>
                        {texto}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {tutores.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {canEdit
                    ? 'No hay tutores registrados aún. Puedes invitar uno con el formulario de abajo o agregar miembros desde la sección Miembros.'
                    : 'No hay tutores disponibles en esta ONG. Primero agrega un tutor desde la sección de miembros.'}
                </p>
              )}
            </div>

            {canEdit && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Invitar nuevo tutor a este salón
                </div>
                <p className="text-xs text-muted-foreground">
                  Se creará un miembro con rol tutor en esta FCP (o se reutilizará si ya existe) y quedará asignado a &quot;{aulaNombre}&quot;.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="email-nuevo-tutor">Correo electrónico</Label>
                    <Input
                      id="email-nuevo-tutor"
                      type="email"
                      autoComplete="email"
                      placeholder="correo@ejemplo.org"
                      value={emailNuevo}
                      onChange={(e) => setEmailNuevo(e.target.value)}
                      disabled={loading || loadingInvitar}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nombre-nuevo-tutor">Nombre para mostrar (opcional)</Label>
                    <Input
                      id="nombre-nuevo-tutor"
                      type="text"
                      placeholder="Nombre del tutor"
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      disabled={loading || loadingInvitar}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={loading || loadingInvitar}
                  onClick={handleInvitarNuevoTutor}
                >
                  {loadingInvitar ? 'Creando…' : 'Crear tutor y asignar a este salón'}
                </Button>
              </div>
            )}

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
              disabled={loading || loadingInvitar}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || loadingInvitar}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

