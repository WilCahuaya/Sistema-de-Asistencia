'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Search, UserPlus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useForm } from 'react-hook-form'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_nombre?: string // Salón actual (solo cuando es de otro salón)
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
  const [estudiantesDelSalon, setEstudiantesDelSalon] = useState<Estudiante[]>([])
  const [estudiantesOtrosSalones, setEstudiantesOtrosSalones] = useState<Estudiante[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(false)
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormNuevo>()

  // Cargar estudiantes del salón que aún no tienen período en este mes
  useEffect(() => {
    if (!open || modo !== 'existente' || !fcpId || !aulaId) return

    const load = async () => {
      setLoadingEstudiantes(true)
      setEstudiantesDelSalon([])
      setEstudiantesOtrosSalones([])
      setSeleccionados(new Set())
      try {
        const auth = await ensureAuthenticated()
        if (!auth?.supabase) return

        const { first, last } = getFirstLastDayOfMonth(anio, mes)

        const { data: estudiantesData, error: errEst } = await auth.supabase
          .from('estudiantes')
          .select('id, codigo, nombre_completo')
          .eq('fcp_id', fcpId)
          .eq('aula_id', aulaId)
          .eq('activo', true)
          .order('nombre_completo')

        if (errEst) throw errEst
        const todos = estudiantesData || []

        const { data: periodosData, error: errPer } = await auth.supabase
          .from('estudiante_periodos')
          .select('estudiante_id')
          .eq('aula_id', aulaId)
          .lte('fecha_inicio', last)
          .gte('fecha_fin', first)

        if (errPer) throw errPer
        const idsConPeriodo = new Set((periodosData || []).map((p: { estudiante_id: string }) => p.estudiante_id))
        const candidatos = todos.filter((e) => !idsConPeriodo.has(e.id))
        setEstudiantesDelSalon(candidatos)
      } catch (e) {
        console.error(e)
        toast.error('Error al cargar', 'No se pudieron cargar los estudiantes del salón.')
      } finally {
        setLoadingEstudiantes(false)
      }
    }
    load()
  }, [open, modo, fcpId, aulaId, anio, mes])

  useEffect(() => {
    if (!open) {
      setModo('existente')
      setBusqueda('')
      setEstudiantesDelSalon([])
      setEstudiantesOtrosSalones([])
      setSeleccionados(new Set())
      reset()
    }
  }, [open, reset])

  // Búsqueda en otros salones (debounced): alumnos trasladados que necesitan asistencia del mes anterior
  useEffect(() => {
    const term = busqueda.trim()
    if (!open || modo !== 'existente' || !fcpId || !aulaId || term.length < 2) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      setEstudiantesOtrosSalones([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingBusqueda(true)
      try {
        const auth = await ensureAuthenticated()
        if (!auth?.supabase) return

        const { first, last } = getFirstLastDayOfMonth(anio, mes)

        const { data: estudiantesData, error: errEst } = await auth.supabase
          .from('estudiantes')
          .select('id, codigo, nombre_completo, aula_id, aula:aulas(nombre)')
          .eq('fcp_id', fcpId)
          .neq('aula_id', aulaId)
          .eq('activo', true)
          .or(`codigo.ilike.%${term}%,nombre_completo.ilike.%${term}%`)
          .order('nombre_completo')
          .limit(30)

        if (errEst) throw errEst
        const deOtros = (estudiantesData || []).map((e: any) => ({
          id: e.id,
          codigo: e.codigo,
          nombre_completo: e.nombre_completo,
          aula_nombre: (e.aula as { nombre?: string })?.nombre || 'Otro salón',
        }))

        const { data: periodosData, error: errPer } = await auth.supabase
          .from('estudiante_periodos')
          .select('estudiante_id')
          .eq('aula_id', aulaId)
          .lte('fecha_inicio', last)
          .gte('fecha_fin', first)

        if (errPer) throw errPer
        const idsConPeriodo = new Set((periodosData || []).map((p: { estudiante_id: string }) => p.estudiante_id))
        const candidatos = deOtros.filter((e) => !idsConPeriodo.has(e.id))
        setEstudiantesOtrosSalones(candidatos)
      } catch (e) {
        console.error(e)
        setEstudiantesOtrosSalones([])
      } finally {
        setLoadingBusqueda(false)
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, modo, busqueda, fcpId, aulaId, anio, mes])

  // Lista combinada: salón actual (filtrado si hay búsqueda) + resultados de otros salones
  const terminoBusqueda = busqueda.trim().toLowerCase()
  const delSalonFiltrados = terminoBusqueda
    ? estudiantesDelSalon.filter(
        (e) =>
          e.codigo.toLowerCase().includes(terminoBusqueda) ||
          e.nombre_completo.toLowerCase().includes(terminoBusqueda)
      )
    : estudiantesDelSalon
  const idsDelSalon = new Set(delSalonFiltrados.map((e) => e.id))
  const estudiantesFiltrados = [
    ...delSalonFiltrados,
    ...estudiantesOtrosSalones.filter((e) => !idsDelSalon.has(e.id)),
  ]

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const marcarTodo = () => {
    setSeleccionados(new Set(estudiantesFiltrados.map((e) => e.id)))
  }

  const desmarcarTodo = () => {
    setSeleccionados(new Set())
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
          : `Este estudiante ya está registrado en el salón "${nombreAula}". No puede estar en este salón (${aulaNombre}) en esa fecha.`,
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
    const ids = Array.from(seleccionados)
    if (ids.length === 0) {
      toast.warning('Selecciona al menos un estudiante', 'Marca los estudiantes que deseas agregar.')
      return
    }

    try {
      setLoading(true)
      let agregados = 0
      for (const id of ids) {
        const ok = await crearPeriodoParaMes(id)
        if (ok) agregados++
      }
      if (agregados > 0) {
        toast.success(
          agregados === 1 ? 'Estudiante agregado' : `${agregados} estudiantes agregados`,
          agregados === 1
            ? `Quedó registrado solo para ${mesLabel}.`
            : `Quedaron registrados solo para ${mesLabel}.`
        )
        onSuccess()
        onOpenChange(false)
      }
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
                placeholder="Buscar por código o nombre (incl. otros salones)..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
              {loadingBusqueda && (
                <span className="text-xs text-muted-foreground self-center">Buscando…</span>
              )}
            </div>
            {estudiantesFiltrados.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button type="button" variant="ghost" size="sm" onClick={marcarTodo}>
                  Marcar todo
                </Button>
                <span className="text-muted-foreground/50">|</span>
                <Button type="button" variant="ghost" size="sm" onClick={desmarcarTodo}>
                  Desmarcar todo
                </Button>
              </div>
            )}
            {loadingEstudiantes ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Cargando estudiantes…</div>
            ) : estudiantesFiltrados.length === 0 && !loadingBusqueda ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                {estudiantesDelSalon.length === 0 && !terminoBusqueda
                  ? 'No hay estudiantes en este salón que puedan agregarse. Todos ya tienen período en este mes.'
                  : 'Ningún estudiante coincide con la búsqueda. Escribe código o nombre (p. ej. para buscar en otros salones).'}
              </div>
            ) : (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {estudiantesFiltrados.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={seleccionados.has(e.id)}
                      onCheckedChange={() => toggleSeleccion(e.id)}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="font-mono text-sm">{e.codigo}</span>
                      <span className="text-sm truncate">{e.nombre_completo}</span>
                      {e.aula_nombre && (
                        <span className="text-xs text-muted-foreground">Salón actual: {e.aula_nombre}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarExistente} disabled={loading || seleccionados.size === 0}>
                {loading ? 'Agregando…' : seleccionados.size === 0 ? 'Agregar a este mes' : `Agregar ${seleccionados.size} estudiante${seleccionados.size > 1 ? 's' : ''}`}
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
