'use client'

import { useState, useEffect } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Search, UserPlus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useForm } from 'react-hook-form'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface AgregarEstudianteMesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulaId: string
  aulaNombre: string
  anio: number
  mes: number
  mesLabel: string
}

type Modo = 'existente' | 'nuevo'

interface FormNuevo {
  codigo: string
  nombre_completo: string
}

function getFirstLastDayOfMonth(anio: number, mes: number): { first: string; last: string } {
  const first = `${anio}-${String(mes).padStart(2, '0')}-01`
  const lastDay = new Date(anio, mes, 0).getDate()
  const last = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { first, last }
}

/** Comprueba si dos períodos se superponen */
function periodosSeSuperponen(
  startA: string,
  endA: string,
  startB: string,
  endB: string | null
): boolean {
  // Período A: startA - endA (ambos definidos)
  // Período B: startB - endB (endB puede ser null = vigente)
  return startA <= (endB ?? '9999-12-31') && endA >= startB
}

export function AgregarEstudianteMesDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  aulaId,
  aulaNombre,
  anio,
  mes,
  mesLabel,
}: AgregarEstudianteMesDialogProps) {
  const [modo, setModo] = useState<Modo>('existente')
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [estudiantesEncontrados, setEstudiantesEncontrados] = useState<Estudiante[]>([])
  const [busquedaLoading, setBusquedaLoading] = useState(false)
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<Estudiante | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormNuevo>()

  useEffect(() => {
    if (!open) {
      setModo('existente')
      setBusqueda('')
      setEstudiantesEncontrados([])
      setEstudianteSeleccionado(null)
      reset()
    }
  }, [open, reset])

  const buscarEstudiantes = async () => {
    const term = busqueda.trim()
    if (!term) return

    setBusquedaLoading(true)
    setEstudiantesEncontrados([])
    setEstudianteSeleccionado(null)
    try {
      const auth = await ensureAuthenticated()
      if (!auth?.supabase) return

      const { data, error } = await auth.supabase
        .from('estudiantes')
        .select('id, codigo, nombre_completo')
        .eq('fcp_id', fcpId)
        .or(`codigo.ilike.%${term}%,nombre_completo.ilike.%${term}%`)
        .limit(20)

      if (error) throw error
      setEstudiantesEncontrados(data || [])
      if (data?.length === 0) {
        toast.info('Sin resultados', `No se encontraron estudiantes con "${term}".`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Error al buscar', 'No se pudo buscar estudiantes.')
    } finally {
      setBusquedaLoading(false)
    }
  }

  const validarSuperposicion = async (
    supabase: NonNullable<Awaited<ReturnType<typeof ensureAuthenticated>>['supabase']>,
    estudianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<{ ok: boolean; mensaje?: string }> => {
    const { data } = await supabase
      .from('estudiante_periodos')
      .select('fecha_inicio, fecha_fin, aula_id, aula:aulas(nombre)')
      .eq('estudiante_id', estudianteId)

    if (!data?.length) return { ok: true }

    for (const p of data) {
      if (!periodosSeSuperponen(fechaInicio, fechaFin, p.fecha_inicio, p.fecha_fin)) continue
      const nombreAula = (p.aula as { nombre?: string })?.nombre || 'otro salón'
      const esMismoAula = p.aula_id === aulaId
      return {
        ok: false,
        mensaje: esMismoAula
          ? `Ya existe un período para este estudiante en ${nombreAula} que se cruza con ${mesLabel}.`
          : `El estudiante ya tiene un período en "${nombreAula}" que se superpone con este mes. Un estudiante no puede estar en dos salones al mismo tiempo.`,
      }
    }
    return { ok: true }
  }

  const crearPeriodoParaMes = async (estudianteId: string) => {
    const { first, last } = getFirstLastDayOfMonth(anio, mes)

    const authResult = await ensureAuthenticated()
    if (!authResult?.supabase || !authResult.user) throw new Error('No autenticado')

    const { supabase, user } = authResult

    const result = await validarSuperposicion(supabase, estudianteId, first, last)
    if (!result.ok) {
      toast.error('Período superpuesto', result.mensaje || 'Revisa el historial del estudiante.')
      return false
    }

    const { error } = await supabase.from('estudiante_periodos').insert({
      estudiante_id: estudianteId,
      aula_id: aulaId,
      fecha_inicio: first,
      fecha_fin: last,
      created_by: user.id,
    })

    if (error) throw error
    return true
  }

  const handleConfirmarExistente = async () => {
    if (!estudianteSeleccionado) {
      toast.warning('Selecciona un estudiante', 'Elige un estudiante de la lista.')
      return
    }

    try {
      setLoading(true)
      await crearPeriodoParaMes(estudianteSeleccionado.id)
      toast.success('Estudiante agregado', `${estudianteSeleccionado.nombre_completo} quedó registrado solo para ${mesLabel}.`)
      onSuccess()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error(e)
      toast.error('Error al agregar', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmarNuevo = async (data: FormNuevo) => {
    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      if (!authResult?.supabase || !authResult.user) {
        toast.error('Sesión expirada', 'Por favor, inicia sesión nuevamente.')
        return
      }

      const { supabase, user } = authResult
      const { first, last } = getFirstLastDayOfMonth(anio, mes)

      const { data: nuevoEstudiante, error: errEst } = await supabase
        .from('estudiantes')
        .insert({
          codigo: data.codigo,
          nombre_completo: data.nombre_completo,
          fcp_id: fcpId,
          aula_id: aulaId,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (errEst) throw errEst

      const result = await validarSuperposicion(supabase, nuevoEstudiante.id, first, last)
      if (!result.ok) {
        await supabase.from('estudiantes').delete().eq('id', nuevoEstudiante.id)
        toast.error('Período superpuesto', result.mensaje || 'No se pudo crear el período.')
        return
      }

      const { error: errPer } = await supabase.from('estudiante_periodos').insert({
        estudiante_id: nuevoEstudiante.id,
        aula_id: aulaId,
        fecha_inicio: first,
        fecha_fin: last,
        created_by: user.id,
      })

      if (errPer) {
        await supabase.from('estudiantes').delete().eq('id', nuevoEstudiante.id)
        throw errPer
      }

      toast.success('Estudiante creado', `${data.nombre_completo} quedó registrado solo para ${mesLabel}.`)
      onSuccess()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error(e)
      if ((e as { code?: string })?.code === '23505') {
        toast.error('Código duplicado', 'El código ya existe en esta FCP.')
      } else {
        toast.error('Error al crear', e instanceof Error ? e.message : 'Intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agregar estudiante a {mesLabel}</DialogTitle>
          <DialogDescription>
            El estudiante aparecerá únicamente en {mesLabel} en {aulaNombre}. No se mostrará antes ni después.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={modo}
          onValueChange={(v) => setModo(v as Modo)}
          className="flex gap-4 mb-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="existente" id="modo-existente" />
            <Label htmlFor="modo-existente" className="font-normal cursor-pointer flex items-center gap-2">
              <Search className="h-4 w-4" />
              El estudiante ya existe
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nuevo" id="modo-nuevo" />
            <Label htmlFor="modo-nuevo" className="font-normal cursor-pointer flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Crear nuevo estudiante
            </Label>
          </div>
        </RadioGroup>

        {modo === 'existente' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por código o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarEstudiantes())}
              />
              <Button type="button" variant="secondary" onClick={buscarEstudiantes} disabled={busquedaLoading}>
                {busquedaLoading ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>
            {estudiantesEncontrados.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {estudiantesEncontrados.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-muted/50 ${estudianteSeleccionado?.id === e.id ? 'bg-primary/10' : ''}`}
                    onClick={() => setEstudianteSeleccionado(estudianteSeleccionado?.id === e.id ? null : e)}
                  >
                    <span className="font-mono text-sm">{e.codigo}</span>
                    <span className="text-sm">{e.nombre_completo}</span>
                  </button>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarExistente} disabled={loading || !estudianteSeleccionado}>
                {loading ? 'Agregando…' : 'Agregar a este mes'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {modo === 'nuevo' && (
          <form onSubmit={handleSubmit(handleConfirmarNuevo)} className="space-y-4">
            <div className="grid gap-2">
              <Label>Código *</Label>
              <Input {...register('codigo', { required: 'Código requerido' })} placeholder="Ej: EST001" />
              {errors.codigo && <p className="text-sm text-destructive">{errors.codigo.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Nombre completo *</Label>
              <Input {...register('nombre_completo', { required: 'Nombre requerido' })} placeholder="Ej: Juan Pérez" />
              {errors.nombre_completo && <p className="text-sm text-destructive">{errors.nombre_completo.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creando…' : 'Crear y agregar a este mes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
