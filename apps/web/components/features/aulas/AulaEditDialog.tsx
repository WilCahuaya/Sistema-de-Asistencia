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
import { toast } from '@/lib/toast'
import { SucursalField, resolverSucursalId } from './SucursalField'
import type { AulaTipo, EstadoIntervencion } from '@/lib/utils/aulaIntervencion'
import { esIntervencion, ESTADO_INTERVENCION_LABEL } from '@/lib/utils/aulaIntervencion'

interface AulaFormData {
  nombre: string
  descripcion?: string
  activa?: boolean
  codigo_aula?: string
}

interface AulaEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  aulaId: string
  fcpId: string
  initialData: AulaFormData & {
    sucursal_id?: string
    tipo?: AulaTipo
    fecha_inicio?: string | null
    fecha_fin?: string | null
    estado_intervencion?: EstadoIntervencion | null
  }
}

export function AulaEditDialog({ open, onOpenChange, onSuccess, aulaId, fcpId, initialData }: AulaEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activa, setActiva] = useState(initialData.activa ?? true)
  const [sucursalId, setSucursalId] = useState(initialData.sucursal_id ?? '')
  const [nuevaSucursal, setNuevaSucursal] = useState('')
  const [fechaInicio, setFechaInicio] = useState(initialData.fecha_inicio ?? '')
  const [fechaFin, setFechaFin] = useState(initialData.fecha_fin ?? '')
  const [estadoIntervencion, setEstadoIntervencion] = useState<EstadoIntervencion>(
    initialData.estado_intervencion ?? 'ACTIVA'
  )
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AulaFormData>({
    defaultValues: initialData,
  })

  const esInt = esIntervencion(initialData)

  useEffect(() => {
    if (open && initialData) {
      reset(initialData)
      setActiva(initialData.activa ?? true)
      setSucursalId(initialData.sucursal_id ?? '')
      setNuevaSucursal('')
      setFechaInicio(initialData.fecha_inicio ?? '')
      setFechaFin(initialData.fecha_fin ?? '')
      setEstadoIntervencion(initialData.estado_intervencion ?? 'ACTIVA')
    }
  }, [open, initialData, reset])

  const onSubmit = async (data: AulaFormData) => {
    if (esInt && !fechaInicio) {
      toast.warning('Fecha requerida', 'Indica la fecha de inicio de la temporada.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setError('Error de autenticación. Por favor, inicia sesión nuevamente.')
        toast.error('Error de autenticación', 'Inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      if (!activa) {
        const { error: deleteTutorError } = await supabase
          .from('tutor_aula')
          .delete()
          .eq('aula_id', aulaId)

        if (deleteTutorError) {
          console.error('Error al desasignar tutor:', deleteTutorError)
        }
      }

      const sucursalFinalId = await resolverSucursalId(supabase, {
        fcpId,
        value: sucursalId,
        nuevaNombre: nuevaSucursal,
        userId: user.id,
      })

      const updatePayload: Record<string, unknown> = {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        activa: activa,
        sucursal_id: sucursalFinalId,
      }

      if (esInt) {
        updatePayload.fecha_inicio = fechaInicio
        updatePayload.fecha_fin = fechaFin || null
        updatePayload.estado_intervencion = estadoIntervencion
      }

      const { error: updateError } = await supabase
        .from('aulas')
        .update(updatePayload)
        .eq('id', aulaId)

      if (updateError) throw updateError

      reset()
      if (esInt) {
        toast.updatedFem('Intervención')
      } else {
        toast.updated('Aula')
      }
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating aula:', error)
      const msg = error?.message || 'Error desconocido'
      setError(`Error al actualizar: ${msg}`)
      toast.error('Error al actualizar', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{esInt ? 'Editar Intervención' : 'Editar Aula'}</DialogTitle>
          <DialogDescription>
            Modifica la información {esInt ? 'de la intervención' : 'del aula'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input
                value={initialData.codigo_aula || '—'}
                readOnly
                disabled
                className="bg-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {esInt
                  ? 'Código INT-01 asignado automáticamente según el orden en la FCP.'
                  : 'Se asigna automáticamente (A01, A02…) según el orden en la FCP.'}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                {...register('nombre', { required: 'El nombre es requerido' })}
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input id="descripcion" {...register('descripcion')} />
            </div>

            <SucursalField
              fcpId={fcpId}
              value={sucursalId}
              onChange={setSucursalId}
              nuevaNombre={nuevaSucursal}
              onNuevaNombreChange={setNuevaSucursal}
              disabled={loading}
            />

            {esInt && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="fecha_inicio">Inicio temporada *</Label>
                    <Input
                      id="fecha_inicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      disabled={estadoIntervencion === 'FINALIZADA'}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fecha_fin">Fin temporada</Label>
                    <Input
                      id="fecha_fin"
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      min={fechaInicio || undefined}
                      disabled={estadoIntervencion === 'FINALIZADA'}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Estado de la temporada</Label>
                  <Select
                    value={estadoIntervencion}
                    onValueChange={(v) => setEstadoIntervencion(v as EstadoIntervencion)}
                    disabled={initialData.estado_intervencion === 'FINALIZADA'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado">
                        {ESTADO_INTERVENCION_LABEL[estadoIntervencion]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVA">Activa</SelectItem>
                      <SelectItem value="SUSPENDIDA">Suspendida</SelectItem>
                      <SelectItem value="FINALIZADA">Finalizada (cierre definitivo)</SelectItem>
                    </SelectContent>
                  </Select>
                  {estadoIntervencion === 'FINALIZADA' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Al finalizar no se podrán modificar asistencias ni el roster.
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="estado">Estado en plataforma</Label>
              <Select
                value={activa ? 'activo' : 'inactivo'}
                onValueChange={(value) => setActiva(value === 'activo')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              {!activa && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Al inactivar, se desasignará el tutor y no aparecerá en listas de asistencia.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                setError(null)
                onOpenChange(false)
              }}
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
