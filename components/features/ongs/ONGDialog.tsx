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
  nombre: string
  descripcion?: string
  direccion?: string
  telefono?: string
  email?: string
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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ONGFormData>()

  // Verificar autenticación al abrir el diálogo
  useEffect(() => {
    if (open) {
      setAuthError(null)
      checkAuth()
    }
  }, [open])

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

      // Crear ONG usando el mismo cliente que tiene la sesión
      // El cliente de Supabase automáticamente incluirá el token en los headers
      console.log('Attempting to insert ONG...')
      const { data: ong, error: ongError } = await supabase
        .from('ongs')
        .insert({
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          direccion: data.direccion || null,
          telefono: data.telefono || null,
          email: data.email || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (ongError) {
        console.error('Error creating ONG:', ongError)
        setAuthError(`Error al crear la ONG: ${ongError.message} (Código: ${ongError.code})`)
        setLoading(false)
        return
      }

      if (!ong) {
        setAuthError('Error: La ONG se creó pero no se devolvió correctamente.')
        setLoading(false)
        return
      }

      console.log('ONG created successfully:', ong.id)

      // Asociar usuario como director de la ONG
      const { error: usuarioOngError } = await supabase
        .from('usuario_ong')
        .insert({
          usuario_id: user.id,
          ong_id: ong.id,
          rol: 'director',
          activo: true,
        })

      if (usuarioOngError) {
        console.error('Error creating usuario_ong:', usuarioOngError)
        console.error('Error details:', {
          message: usuarioOngError.message,
          code: usuarioOngError.code,
          details: usuarioOngError.details,
          hint: usuarioOngError.hint,
        })
        // Intentar eliminar la ONG creada si falla la asociación
        await supabase.from('ongs').delete().eq('id', ong.id)
        setAuthError(`Error al asociar el usuario con la ONG: ${usuarioOngError.message} (Código: ${usuarioOngError.code || 'N/A'}). Detalles: ${usuarioOngError.details || 'Sin detalles'}`)
        setLoading(false)
        return
      }

      console.log('Usuario asociado correctamente a la ONG')
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
          <DialogTitle>Crear Nueva ONG</DialogTitle>
          <DialogDescription>
            Completa la información para crear una nueva Organización No Gubernamental
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
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                {...register('nombre', { required: 'El nombre es requerido' })}
                placeholder="Nombre de la ONG"
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                {...register('descripcion')}
                placeholder="Breve descripción (opcional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                {...register('direccion')}
                placeholder="Dirección (opcional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                {...register('telefono')}
                placeholder="Teléfono (opcional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Email (opcional)"
              />
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
              {loading ? 'Creando...' : 'Crear ONG'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

