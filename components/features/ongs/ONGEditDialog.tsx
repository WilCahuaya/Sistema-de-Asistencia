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

interface ONGEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  ongId: string
  initialData: ONGFormData
}

export function ONGEditDialog({ open, onOpenChange, onSuccess, ongId, initialData }: ONGEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ONGFormData>({
    defaultValues: initialData,
  })

  // Actualizar el formulario cuando cambian los datos iniciales
  useEffect(() => {
    if (open && initialData) {
      reset({
        ...initialData,
        rol_contacto: 'Director', // Siempre mantener como Director
      })
    }
  }, [open, initialData, reset])

  const onSubmit = async (data: ONGFormData) => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      
      // Verificar autenticación
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setError('Error de autenticación. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      // Obtener datos actuales de la FCP para comparar el email
      const { data: currentFCP, error: fetchError } = await supabase
        .from('fcps')
        .select('email')
        .eq('id', ongId)
        .single()

      if (fetchError) {
        console.error('Error fetching current FCP:', fetchError)
        setError(`Error al obtener datos de la FCP: ${fetchError.message}`)
        setLoading(false)
        return
      }

      // Actualizar la FCP
      // Nota: rol_contacto siempre debe ser 'Director', no se actualiza
      const { error: updateError } = await supabase
        .from('fcps')
        .update({
          numero_identificacion: data.numero_identificacion,
          razon_social: data.razon_social,
          nombre_completo_contacto: data.nombre_completo_contacto,
          telefono: data.telefono,
          email: data.email,
          ubicacion: data.ubicacion,
          rol_contacto: 'Director', // Siempre mantener como Director
        })
        .eq('id', ongId)

      if (updateError) {
        console.error('Error updating ONG:', updateError)
        setError(`Error al actualizar la FCP: ${updateError.message}`)
        setLoading(false)
        return
      }

      // Siempre asegurar que el usuario con el email tenga el rol de director
      // Usar la función RPC que busca en auth.users
      try {
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('asociar_director_por_email', {
            p_fcp_id: ongId,
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
        
        // Verificar si ya existe una invitación pendiente o registro de director para esta FCP
        const { data: existingDirector } = await supabase
          .from('fcp_miembros')
          .select('id, usuario_id, email_pendiente')
          .eq('fcp_id', ongId)
          .eq('rol', 'director')
          .maybeSingle()

        if (!existingDirector || (existingDirector.usuario_id === null && existingDirector.email_pendiente !== data.email.toLowerCase())) {
          // Si no existe o el email cambió, eliminar el registro antiguo y crear uno nuevo
          if (existingDirector) {
            await supabase
              .from('fcp_miembros')
              .delete()
              .eq('id', existingDirector.id)
          }

          const { error: invitationError } = await supabase
            .from('fcp_miembros')
            .insert({
              usuario_id: null, // NULL indica invitación pendiente
              fcp_id: ongId,
              rol: 'director',
              activo: true,
              email_pendiente: data.email.toLowerCase(),
              fecha_asignacion: new Date().toISOString(),
            })

          if (invitationError) {
            console.error('Error creando invitación pendiente:', invitationError)
            // No fallar la actualización de la FCP si esto falla, solo loguear el error
          } else {
            console.log('Invitación pendiente creada para el director')
          }
        }
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error inesperado updating ONG:', err)
      setError(`Error inesperado: ${err.message || 'Error desconocido'}`)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar FCP</DialogTitle>
          <DialogDescription>
            Actualiza la información de la FCP
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
                placeholder="Ej: Director"
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
              {loading ? 'Actualizando...' : 'Actualizar FCP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


