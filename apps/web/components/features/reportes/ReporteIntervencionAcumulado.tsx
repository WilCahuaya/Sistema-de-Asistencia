'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileSpreadsheet, Search, BarChart3 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useUserRole } from '@/hooks/useUserRole'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { fetchAsistenciasRangoFlat } from '@/lib/reportes/asistenciasReporteQueries'
import { formatTemporada, ESTADO_INTERVENCION_LABEL } from '@/lib/utils/aulaIntervencion'
import type { EstadoIntervencion } from '@/lib/utils/aulaIntervencion'
import { compareNombreCompleto } from '@/lib/utils/sortEstudiantes'
import * as XLSX from 'xlsx'

interface ReporteIntervencionAcumuladoProps {
  fcpId: string | null
  soloAulasIds?: string[] | null
}

interface IntervencionOption {
  id: string
  nombre: string
  codigo_aula: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado_intervencion: EstadoIntervencion | null
}

interface FilaEstudiante {
  estudianteId: string
  codigo: string
  nombreCompleto: string
  asistencias: number
  faltas: number
  tardanzas: number
  porcentaje: number
}

interface ReporteData {
  intervencion: IntervencionOption
  fechaInicio: string
  fechaFin: string
  filas: FilaEstudiante[]
}

function calcularPorcentaje(presente: number, faltas: number): number {
  const denom = presente + faltas
  if (denom <= 0) return 0
  return Math.round((presente / denom) * 1000) / 10
}

function fechaHoyLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ReporteIntervencionAcumulado({
  fcpId: fcpIdProp,
  soloAulasIds = null,
}: ReporteIntervencionAcumuladoProps) {
  const { selectedRole } = useSelectedRole()
  const fcpId = fcpIdProp || selectedRole?.fcpId || null
  const { canViewReports, loading: roleLoading } = useUserRole(fcpId)

  const [intervenciones, setIntervenciones] = useState<IntervencionOption[]>([])
  const [selectedIntervencionId, setSelectedIntervencionId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingLista, setLoadingLista] = useState(true)
  const [reporte, setReporte] = useState<ReporteData | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (!fcpId) {
      setIntervenciones([])
      setLoadingLista(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingLista(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('aulas')
          .select('id, nombre, codigo_aula, fecha_inicio, fecha_fin, estado_intervencion')
          .eq('fcp_id', fcpId)
          .eq('tipo', 'INTERVENTION')
          .eq('activa', true)
          .order('nombre', { ascending: true })

        if (error) throw error
        if (cancelled) return

        let lista = (data || []) as IntervencionOption[]
        if (soloAulasIds && soloAulasIds.length > 0) {
          const permitidas = new Set(soloAulasIds)
          lista = lista.filter((a) => permitidas.has(a.id))
        }
        setIntervenciones(lista)
        setSelectedIntervencionId((prev) => {
          if (lista.length === 0) return ''
          if (lista.some((a) => a.id === prev)) return prev
          return lista[0].id
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) toast.error('Error', 'No se pudieron cargar las intervenciones.')
      } finally {
        if (!cancelled) setLoadingLista(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fcpId, soloAulasIds])

  const intervencionSeleccionada = intervenciones.find((a) => a.id === selectedIntervencionId)

  const generarReporte = async () => {
    if (!fcpId || !intervencionSeleccionada) {
      toast.warning('Selecciona una intervención', 'Elige la intervención para generar el reporte acumulado.')
      return
    }
    if (!intervencionSeleccionada.fecha_inicio) {
      toast.warning('Sin fecha de inicio', 'La intervención no tiene fecha de inicio configurada.')
      return
    }

    setLoading(true)
    setReporte(null)
    try {
      const supabase = createClient()
      const hoy = fechaHoyLocal()
      const fechaInicio = intervencionSeleccionada.fecha_inicio
      const fechaFin =
        intervencionSeleccionada.fecha_fin && intervencionSeleccionada.fecha_fin < hoy
          ? intervencionSeleccionada.fecha_fin
          : hoy

      const { data: inscripciones, error: inscErr } = await supabase
        .from('intervencion_estudiantes')
        .select(`
          estudiante_id,
          estudiante:estudiantes(id, codigo, nombre_completo)
        `)
        .eq('fcp_id', fcpId)
        .eq('aula_id', intervencionSeleccionada.id)
        .eq('activo', true)

      if (inscErr) throw inscErr

      const estudiantesMap = new Map<string, { codigo: string; nombreCompleto: string }>()
      for (const row of inscripciones || []) {
        const est = Array.isArray(row.estudiante) ? row.estudiante[0] : row.estudiante
        if (!est?.id) continue
        estudiantesMap.set(est.id, {
          codigo: est.codigo || '—',
          nombreCompleto: est.nombre_completo || '—',
        })
      }

      const stats = new Map<string, { presente: number; falto: number; tardanzas: number }>()
      for (const id of estudiantesMap.keys()) {
        stats.set(id, { presente: 0, falto: 0, tardanzas: 0 })
      }

      const asistencias = (await fetchAsistenciasRangoFlat(
        supabase,
        fcpId,
        fechaInicio,
        fechaFin
      )).filter((a) => a.aula_id === intervencionSeleccionada.id)

      for (const a of asistencias) {
        if (!estudiantesMap.has(a.estudiante_id)) continue
        const s = stats.get(a.estudiante_id)!
        if (a.estado === 'presente') s.presente++
        else if (a.estado === 'falto') s.falto++
        if (a.registro_tardio) s.tardanzas++
      }

      const filas: FilaEstudiante[] = [...estudiantesMap.entries()]
        .map(([estudianteId, meta]) => {
          const s = stats.get(estudianteId)!
          return {
            estudianteId,
            codigo: meta.codigo,
            nombreCompleto: meta.nombreCompleto,
            asistencias: s.presente,
            faltas: s.falto,
            tardanzas: s.tardanzas,
            porcentaje: calcularPorcentaje(s.presente, s.falto),
          }
        })
        .sort((a, b) => compareNombreCompleto(a.nombreCompleto, b.nombreCompleto))

      setReporte({
        intervencion: intervencionSeleccionada,
        fechaInicio,
        fechaFin,
        filas,
      })
    } catch (e) {
      console.error(e)
      toast.error('Error al generar reporte', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const filasFiltradas = useMemo(() => {
    if (!reporte) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return reporte.filas
    return reporte.filas.filter(
      (f) =>
        f.nombreCompleto.toLowerCase().includes(q) || f.codigo.toLowerCase().includes(q)
    )
  }, [reporte, busqueda])

  const exportarExcel = () => {
    if (!reporte) return
    const titulo = reporte.intervencion.nombre
    const codigo = reporte.intervencion.codigo_aula || ''
    const rows: (string | number)[][] = [
      ['Asistencia acumulada de la intervención'],
      [titulo, codigo],
      [`Periodo: ${reporte.fechaInicio} – ${reporte.fechaFin}`],
      [],
      ['Estudiante', 'Código', 'Asistencias', 'Faltas', 'Tardanzas', '% Asistencia'],
      ...reporte.filas.map((f) => [
        f.nombreCompleto,
        f.codigo,
        f.asistencias,
        f.faltas,
        f.tardanzas,
        f.porcentaje,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Acumulado')
    const slug = (codigo || titulo).replace(/\s+/g, '_').slice(0, 30)
    XLSX.writeFile(wb, `asistencia_acumulada_${slug}.xlsx`)
    toast.success('Excel descargado')
  }

  if (roleLoading || loadingLista) {
    return <div className="py-12 text-center text-muted-foreground">Cargando intervenciones…</div>
  }

  if (!canViewReports) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No tienes permiso para ver reportes en esta FCP.
        </CardContent>
      </Card>
    )
  }

  if (!fcpId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Selecciona un proyecto (FCP) para ver el reporte acumulado.
        </CardContent>
      </Card>
    )
  }

  if (intervenciones.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No hay intervenciones activas en este proyecto.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Asistencia acumulada de la intervención
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Participación total de cada estudiante desde el inicio de la temporada hasta hoy (o hasta el fin de la
            intervención si ya concluyó).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="grid gap-2 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Intervención</label>
              <Select value={selectedIntervencionId} onValueChange={setSelectedIntervencionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar intervención" />
                </SelectTrigger>
                <SelectContent>
                  {intervenciones.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                      {a.codigo_aula ? ` (${a.codigo_aula})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {intervencionSeleccionada && (
              <p className="text-xs text-muted-foreground sm:pb-2">
                Temporada: {formatTemporada(intervencionSeleccionada)} ·{' '}
                {ESTADO_INTERVENCION_LABEL[intervencionSeleccionada.estado_intervencion ?? 'ACTIVA']}
              </p>
            )}
            <Button onClick={generarReporte} disabled={loading || !selectedIntervencionId}>
              {loading ? 'Generando…' : 'Generar reporte'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {reporte && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {reporte.intervencion.nombre}
                {reporte.intervencion.codigo_aula && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {reporte.intervencion.codigo_aula}
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Del {reporte.fechaInicio} al {reporte.fechaFin} · {reporte.filas.length} estudiante
                {reporte.filas.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportarExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar estudiante…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead className="text-right w-24">Asistencias</TableHead>
                    <TableHead className="text-right w-20">Faltas</TableHead>
                    <TableHead className="text-right w-24">Tardanzas</TableHead>
                    <TableHead className="text-right w-28">% Asistencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {busqueda ? 'Sin resultados' : 'No hay estudiantes inscritos'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filasFiltradas.map((f) => (
                      <TableRow key={f.estudianteId}>
                        <TableCell>
                          <div className="font-medium">{f.nombreCompleto}</div>
                          <div className="text-xs text-muted-foreground font-mono">{f.codigo}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{f.asistencias}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.faltas}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.tardanzas}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {f.porcentaje.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              % Asistencia = asistencias ÷ (asistencias + faltas). Tardanzas = registros marcados como registro
              tardío en el periodo.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
