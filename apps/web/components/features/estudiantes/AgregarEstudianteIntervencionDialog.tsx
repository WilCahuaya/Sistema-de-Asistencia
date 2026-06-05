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
import { Checkbox } from '@/components/ui/checkbox'
import { Search, UserPlus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { sortByNombreCompleto } from '@/lib/utils/sortEstudiantes'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_nombre?: string
}

interface AgregarEstudianteIntervencionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulaId: string
  aulaNombre: string
}

export function AgregarEstudianteIntervencionDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  aulaId,
  aulaNombre,
}: AgregarEstudianteIntervencionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [inscritosIds, setInscritosIds] = useState<Set<string>>(new Set())
  const [resultados, setResultados] = useState<Estudiante[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)

  useEffect(() => {
    if (!open || !fcpId || !aulaId) return
    const loadInscritos = async () => {
      const auth = await ensureAuthenticated()
      if (!auth?.supabase) return
      const { data } = await auth.supabase
        .from('intervencion_estudiantes')
        .select('estudiante_id')
        .eq('aula_id', aulaId)
        .eq('activo', true)
      setInscritosIds(new Set((data || []).map((r) => r.estudiante_id)))
    }
    loadInscritos()
  }, [open, fcpId, aulaId])

  useEffect(() => {
    if (!open) {
      setBusqueda('')
      setResultados([])
      setSeleccionados(new Set())
    }
  }, [open])

  const buscar = async () => {
    const term = busqueda.trim()
    if (!term || !fcpId) {
      if (!term) toast.info('Escribe para buscar', 'Ingresa código o nombre del estudiante.')
      return
    }
    setLoadingBusqueda(true)
    try {
      const auth = await ensureAuthenticated()
      if (!auth?.supabase) return

      const { data, error } = await auth.supabase
        .from('estudiantes')
        .select('id, codigo, nombre_completo, aula:aulas(nombre)')
        .eq('fcp_id', fcpId)
        .eq('activo', true)
        .or(`codigo.ilike.%${term}%,nombre_completo.ilike.%${term}%`)
        .order('nombre_completo')
        .limit(50)

      if (error) throw error

      const mapped = sortByNombreCompleto(
        (data || []).map((e: any) => ({
          id: e.id,
          codigo: e.codigo,
          nombre_completo: e.nombre_completo,
          aula_nombre: (e.aula as { nombre?: string })?.nombre || '—',
        }))
      )
      setResultados(mapped)
    } catch (e) {
      console.error(e)
      toast.error('Error al buscar', 'No se pudieron buscar estudiantes.')
      setResultados([])
    } finally {
      setLoadingBusqueda(false)
    }
  }

  const toggleSeleccion = (id: string) => {
    if (inscritosIds.has(id)) return
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const agregar = async () => {
    if (seleccionados.size === 0) {
      toast.warning('Selecciona estudiantes', 'Marca al menos un estudiante.')
      return
    }
    setLoading(true)
    try {
      const auth = await ensureAuthenticated()
      if (!auth?.supabase || !auth.user) throw new Error('No autenticado')

      let agregados = 0
      let duplicados = 0
      for (const estudianteId of seleccionados) {
        if (inscritosIds.has(estudianteId)) {
          duplicados++
          continue
        }
        const { error } = await auth.supabase.from('intervencion_estudiantes').insert({
          aula_id: aulaId,
          estudiante_id: estudianteId,
          fcp_id: fcpId,
          created_by: auth.user.id,
        })
        if (error) {
          if (error.code === '23505') duplicados++
          else throw error
        } else {
          agregados++
        }
      }

      toast.success(
        'Estudiantes agregados',
        `${agregados} agregado(s)${duplicados ? `, ${duplicados} ya inscrito(s)` : ''}.`
      )
      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      toast.error('Error', e?.message || 'No se pudieron agregar estudiantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Agregar estudiantes a la intervención
          </DialogTitle>
          <DialogDescription>
            Busca estudiantes existentes de la FCP para inscribirlos en &quot;{aulaNombre}&quot;.
            No se crean estudiantes nuevos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Código o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscar())}
          />
          <Button type="button" variant="secondary" onClick={buscar} disabled={loadingBusqueda}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] border rounded-md p-2 space-y-1">
          {loadingBusqueda ? (
            <p className="text-sm text-muted-foreground text-center py-8">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Escribe y busca estudiantes para agregar
            </p>
          ) : (
            resultados.map((e) => {
              const yaInscrito = inscritosIds.has(e.id)
              return (
                <label
                  key={e.id}
                  className={`flex items-center gap-3 p-2 rounded-md ${
                    yaInscrito ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50 cursor-pointer'
                  }`}
                >
                  <Checkbox
                    checked={yaInscrito || seleccionados.has(e.id)}
                    disabled={yaInscrito}
                    onCheckedChange={() => toggleSeleccion(e.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.nombre_completo}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.codigo} · Aula principal: {e.aula_nombre}
                      {yaInscrito && ' · Ya inscrito'}
                    </p>
                  </div>
                </label>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={agregar} disabled={loading || seleccionados.size === 0}>
            {loading ? 'Agregando...' : `Agregar (${seleccionados.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
