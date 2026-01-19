'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

interface ONGFormData {
  numero_identificacion: string
  razon_social: string
  nombre_completo_contacto: string
  telefono: string
  email: string
  ubicacion: string
  rol_contacto: string
}

interface ONGDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ONGDialog({ open, onOpenChange, onSuccess }: ONGDialogProps) {
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ONGFormData>({
    defaultValues: {
      rol_contacto: 'Director',
    },
  })

  // Verificar autenticación al abrir el diálogo y establecer valor por defecto del rol
  useEffect(() => {
    if (open) {
      setAuthError(null)
      checkAuth()
      // Establecer el valor del rol como "Director" cuando se abre el diálogo
      reset({
        rol_contacto: 'Director',
      })
    }
  }, [open, reset])

  const checkAuth = async () => {
    try {
      console.log('Checking authentication in ONGDialog...')
      const authResult = await ensureAuthenticated()
      
      if (!authResult || !authResult.user) {
        console.error('Authentication check failed:', authResult)
        setAuthError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        return
      }
      
      console.log('Authentication check successful:', authResult.user.id)
    } catch (error: any) {
      console.error('Error checking auth:', error)
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
      })
      setAuthError('Error al verificar la autenticación.')
    }
  }

  const onSubmit = async (data: ONGFormData) => {
    try {
      setLoading(true)
      setAuthError(null)

      // Asegurar que el usuario esté autenticado (refresca la sesión si es necesario)
      console.log('Submitting ONG form, checking authentication...')
      const authResult = await ensureAuthenticated()
      
      if (!authResult || !authResult.user) {
        console.error('Authentication failed during form submission:', authResult)
        setAuthError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        setTimeout(() => {
          router.push('/login')
        }, 2000)
        return
      }

      const { user, supabase } = authResult
      console.log('Creating ONG with user:', user.id, 'email:', user.email)

      // Asegurar que la sesión esté actualizada en el cliente antes de hacer la petición
      // Esto garantiza que el token JWT se incluya en los headers
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        console.error('No session found before insert:', sessionError)
        setAuthError('Error: No se encontró la sesión. Por favor, recarga la página.')
        setLoading(false)
        return
      }
      
      if (!session.access_token) {
        console.error('No access token in session')
        setAuthError('Error: No se encontró el token de acceso. Por favor, recarga la página.')
        setLoading(false)
        return
      }
      
      console.log('Session found, access token available:', !!session.access_token)
      console.log('Access token (first 50 chars):', session.access_token.substring(0, 50))
      console.log('Session expires at:', new Date(session.expires_at! * 1000).toLocaleString())
      console.log('User ID from session:', session.user.id)

      // DEBUG: Llamar a la función RPC para verificar si auth.uid() funciona
      try {
        const { data: debugData, error: debugError } = await supabase.rpc('debug_auth')
        console.log('Debug auth result:', debugData)
        if (debugError) {
          console.error('Error calling debug_auth:', debugError)
        }
        if (debugData && !debugData.jwt_available) {
          console.warn('WARNING: auth.uid() is NULL even though token is present!')
        }
      } catch (error) {
        console.error('Error calling debug_auth RPC:', error)
      }

      // Crear FCP usando el mismo cliente que tiene la sesión
      // El cliente de Supabase automáticamente incluirá el token en los headers
      console.log('Attempting to insert FCP...')
      const { data: fcp, error: fcpError } = await supabase
        .from('fcps')
        .insert({
          numero_identificacion: data.numero_identificacion,
          razon_social: data.razon_social,
          nombre_completo_contacto: data.nombre_completo_contacto,
          telefono: data.telefono,
          email: data.email,
          ubicacion: data.ubicacion,
          rol_contacto: data.rol_contacto,
          created_by: user.id,
        })
        .select()
        .single()

      if (fcpError) {
        console.error('Error creating FCP:', fcpError)
        setAuthError(`Error al crear la FCP: ${fcpError.message} (Código: ${fcpError.code})`)
        setLoading(false)
        return
      }

      if (!fcp) {
        setAuthError('Error: La FCP se creó pero no se devolvió correctamente.')
        setLoading(false)
        return
      }

      console.log('FCP created successfully:', fcp.id)

      // Asociar usuario como facilitador de la FCP
      // Nota: Los facilitadores necesitan tener al menos un registro en fcp_miembros con rol 'facilitador'
      // para que la función es_facilitador() los identifique
      const { error: fcpMiembroError } = await supabase
        .from('fcp_miembros')
        .insert({
          usuario_id: user.id,
          fcp_id: fcp.id,
          rol: 'facilitador',
          activo: true,
        })

      if (fcpMiembroError) {
        console.error('Error creating fcp_miembros:', fcpMiembroError)
        console.error('Error details:', {
          message: fcpMiembroError.message,
          code: fcpMiembroError.code,
          details: fcpMiembroError.details,
          hint: fcpMiembroError.hint,
        })
        // Intentar eliminar la FCP creada si falla la asociación
        await supabase.from('fcps').delete().eq('id', fcp.id)
        setAuthError(`Error al asociar el usuario con la FCP: ${fcpMiembroError.message} (Código: ${fcpMiembroError.code || 'N/A'}). Detalles: ${fcpMiembroError.details || 'Sin detalles'}`)
        setLoading(false)
        return
      }

      console.log('Usuario facilitador asociado correctamente a la FCP')

      // Crear usuario con rol de director para la FCP
      // Primero intentar asociar usando la función RPC que busca en auth.users
      try {
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('asociar_director_por_email', {
            p_fcp_id: fcp.id,
            p_email: data.email.toLowerCase()
          })

        if (rpcError) {
          console.error('Error en asociar_director_por_email:', rpcError)
          // Si hay error, crear invitación pendiente como fallback
          throw rpcError
        }

        if (rpcResult && (rpcResult as any).success) {
          console.log('Director asociado correctamente usando RPC:', (rpcResult as any).usuario_id)
        } else {
          // Si la función RPC no encontró el usuario en auth.users,
          // crear una invitación pendiente
          throw new Error('Usuario no encontrado en auth.users')
        }
      } catch (error: any) {
        // Si falla la función RPC o no encuentra el usuario, crear invitación pendiente
        console.log('Creando invitación pendiente para:', data.email, 'Error:', error?.message)
        const { error: invitationError } = await supabase
          .from('fcp_miembros')
          .insert({
            usuario_id: null, // NULL indica invitación pendiente
            fcp_id: fcp.id,
            rol: 'director',
            activo: true,
            email_pendiente: data.email.toLowerCase(),
            fecha_asignacion: new Date().toISOString(),
          })

        if (invitationError) {
          console.error('Error creando invitación pendiente:', invitationError)
          // No fallar la creación de la FCP si esto falla, solo loguear el error
        } else {
          console.log('Invitación pendiente creada para el director')
        }
      }
      reset()
      setAuthError(null)
      onSuccess()
    } catch (error: any) {
      console.error('Error inesperado creating ONG:', error)
      setAuthError(`Error inesperado: ${error.message || 'Error desconocido'}`)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva FCP</DialogTitle>
          <DialogDescription>
            Completa la información para crear una nueva FCP
          </DialogDescription>
          </DialogHeader>
        {authError && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
            <p className="text-sm">{authError}</p>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="numero_identificacion">Número de Identificación *</Label>
              <Input
                id="numero_identificacion"
                {...register('numero_identificacion', { required: 'El número de identificación es requerido' })}
                placeholder="Ej: PE0530"
              />
              {errors.numero_identificacion && (
                <p className="text-sm text-red-500">{errors.numero_identificacion.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="razon_social">Razón Social *</Label>
              <Input
                id="razon_social"
                {...register('razon_social', { required: 'La razón social es requerida' })}
                placeholder="Ej: RESCATANDO VALORES"
              />
              {errors.razon_social && (
                <p className="text-sm text-red-500">{errors.razon_social.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nombre_completo_contacto">Nombre Completo *</Label>
              <Input
                id="nombre_completo_contacto"
                {...register('nombre_completo_contacto', { required: 'El nombre completo es requerido' })}
                placeholder="Ej: Juan Pérez Camacho"
              />
              {errors.nombre_completo_contacto && (
                <p className="text-sm text-red-500">{errors.nombre_completo_contacto.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input
                id="telefono"
                {...register('telefono', { required: 'El teléfono es requerido' })}
                placeholder="Ej: +51 987654321"
              />
              {errors.telefono && (
                <p className="text-sm text-red-500">{errors.telefono.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo Electrónico *</Label>
              <Input
                id="email"
                type="email"
                {...register('email', { required: 'El correo electrónico es requerido' })}
                placeholder="Ej: juan.perez@ci.org"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ubicacion">Ubicación *</Label>
              <Input
                id="ubicacion"
                {...register('ubicacion', { required: 'La ubicación es requerida' })}
                placeholder="Ej: Lima, Perú"
              />
              {errors.ubicacion && (
                <p className="text-sm text-red-500">{errors.ubicacion.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rol_contacto">Rol *</Label>
              <Input
                id="rol_contacto"
                {...register('rol_contacto', { required: 'El rol es requerido' })}
                readOnly
                disabled
                className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
              />
              {errors.rol_contacto && (
                <p className="text-sm text-red-500">{errors.rol_contacto.message}</p>
              )}
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear FCP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

