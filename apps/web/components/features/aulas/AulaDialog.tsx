'use client'

import { useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'
import { SucursalField, NUEVA_SUCURSAL, resolverSucursalId } from './SucursalField'
import type { AulaTipo, EstadoIntervencion } from '@/lib/utils/aulaIntervencion'
import { SEGMENT_AULA_TIPO, ESTADO_INTERVENCION_LABEL } from '@/lib/utils/aulaIntervencion'
import { SegmentedControl } from '@/components/ui/segmented-control'

interface AulaFormData {
  nombre: string
  descripcion?: string
}

interface AulaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  /** Tipo inicial al abrir (desde listado Regulares / Intervenciones) */
  defaultTipo?: AulaTipo
  onAulaCreated?: (aula: { id: string; nombre: string; codigo_aula?: string | null }) => void
}

export function AulaDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  defaultTipo = 'REGULAR',
  onAulaCreated,
}: AulaDialogProps) {
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<AulaTipo>(defaultTipo)
  const [sucursalId, setSucursalId] = useState('')
  const [nuevaSucursal, setNuevaSucursal] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [estadoIntervencion, setEstadoIntervencion] = useState<EstadoIntervencion>('ACTIVA')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AulaFormData>()

  useEffect(() => {
    if (open) {
      setTipo(defaultTipo)
    } else {
      setSucursalId('')
      setNuevaSucursal('')
      setFechaInicio('')
      setFechaFin('')
      setEstadoIntervencion('ACTIVA')
    }
  }, [open, defaultTipo])

  const esIntervencion = tipo === 'INTERVENTION'

  const onSubmit = async (data: AulaFormData) => {
    if (!fcpId) {
      toast.warning('Selecciona una ONG', 'Por favor, selecciona una ONG primero.')
      return
    }

    if (esIntervencion && !fechaInicio) {
      toast.warning('Fecha requerida', 'Indica la fecha de inicio de la temporada.')
      return
    }

    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      if (!authResult || !authResult.user) {
        toast.error('Sesión expirada', 'Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { user, supabase } = authResult

      const sucursalFinalId = await resolverSucursalId(supabase, {
        fcpId,
        value: sucursalId,
        nuevaNombre: nuevaSucursal,
        userId: user.id,
      })

      const payload: Record<string, unknown> = {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        fcp_id: fcpId,
        sucursal_id: sucursalFinalId,
        activa: true,
        tipo,
        created_by: user.id,
      }

      if (esIntervencion) {
        payload.fecha_inicio = fechaInicio
        payload.fecha_fin = fechaFin || null
        payload.estado_intervencion = estadoIntervencion
      }

      const { data: nuevaAula, error } = await supabase
        .from('aulas')
        .insert(payload)
        .select('id, nombre, codigo_aula')
        .single()

      if (error) throw error

      reset()
      setSucursalId('')
      setNuevaSucursal('')
      if (esIntervencion) {
        toast.createdFem('Intervención')
      } else {
        toast.created('Aula')
      }
      onAulaCreated?.(nuevaAula)
      onSuccess()
    } catch (error: any) {
      console.error('Error creating aula:', error)
      toast.error('Error al crear', error?.message || 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{esIntervencion ? 'Crear Intervención' : 'Crear Nueva Aula'}</DialogTitle>
          <DialogDescription>
            {esIntervencion
              ? 'Grupo temporal para refuerzo, taller o acompañamiento'
              : 'Completa la información para crear una nueva aula'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <SegmentedControl
                value={tipo}
                onChange={setTipo}
                options={SEGMENT_AULA_TIPO}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                {...register('nombre', { required: 'El nombre es requerido' })}
                placeholder={esIntervencion ? 'Ej: Refuerzo Matemático' : 'Ej: Aula 1, Primaria A, etc.'}
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>
            <SucursalField
              fcpId={fcpId}
              value={sucursalId}
              onChange={setSucursalId}
              nuevaNombre={nuevaSucursal}
              onNuevaNombreChange={setNuevaSucursal}
              disabled={loading}
            />
            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                {...register('descripcion')}
                placeholder="Breve descripción (opcional)"
              />
            </div>
            {esIntervencion && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="fecha_inicio">Inicio temporada *</Label>
                    <Input
                      id="fecha_inicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      required
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
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Estado inicial</Label>
                  <Select
                    value={estadoIntervencion}
                    onValueChange={(v) => setEstadoIntervencion(v as EstadoIntervencion)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado">
                        {ESTADO_INTERVENCION_LABEL[estadoIntervencion]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVA">Activa</SelectItem>
                      <SelectItem value="SUSPENDIDA">Suspendida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  El código INT-01 se asignará automáticamente. Asigna tutores/responsables desde el listado.
                </p>
              </>
            )}
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
            <Button type="submit" disabled={loading || !fcpId}>
              {loading ? 'Creando...' : esIntervencion ? 'Crear Intervención' : 'Crear Aula'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
