'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Calendar, FileSpreadsheet, FileText, Search, BarChart3 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useUserRole } from '@/hooks/useUserRole'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { fetchAsistenciasIntervencionRango } from '@/lib/reportes/asistenciasReporteQueries'
import { toLocalDateString } from '@/lib/utils/dateUtils'
import {
  formatTemporada,
  ESTADO_INTERVENCION_LABEL,
  fechaEnTemporadaIntervencion,
} from '@/lib/utils/aulaIntervencion'
import type { EstadoIntervencion } from '@/lib/utils/aulaIntervencion'
import { compareNombreCompleto } from '@/lib/utils/sortEstudiantes'
import { SucursalReporteSelect } from '@/components/features/reportes/SucursalReporteSelect'
import { useSucursalReporteFilter } from '@/hooks/useSucursalReporteFilter'
import { filtrarAulasPorSucursal } from '@/lib/reportes/sucursalReporte'
import {
  getPDFHeaderStyles,
  getPDFBodyStyles,
  getPDFAlternateRowStyles,
} from '@/lib/utils/exportStyles'
import { getAvailableTableWidth, getProportionalColumnStyles, type PDFTableColumnConfig } from '@/lib/utils/pdfTableUtils'
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
  permisos: number
  porcentaje: number
}

interface DiaIncompleto {
  fecha: string
  fechaFormateada: string
  marcados: number
  total: number
}

interface ReporteData {
  intervencion: IntervencionOption
  fechaInicio: string
  fechaFin: string
  diasCompletos: number
  filas: FilaEstudiante[]
  diasIncompletos: DiaIncompleto[]
  sucursalNombre?: string | null
}

function calcularPorcentaje(presente: number, permiso: number, diasCompletos: number): number {
  if (diasCompletos <= 0) return 0
  return Math.round(((presente + permiso) / diasCompletos) * 1000) / 10
}

function normalizarFecha(f: string | null | undefined): string | null {
  if (!f) return null
  const base = String(f).split('T')[0]
  const parts = base.split('-')
  if (parts.length !== 3) return base
  const [y, m, d] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function minFecha(a: string, b: string): string {
  return a <= b ? a : b
}

function formatearFecha(fechaStr: string): string {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Lima',
  })
}

export function ReporteIntervencionAcumulado({
  fcpId: fcpIdProp,
  soloAulasIds = null,
}: ReporteIntervencionAcumuladoProps) {
  const router = useRouter()
  const { selectedRole } = useSelectedRole()
  const fcpId = fcpIdProp || selectedRole?.fcpId || null
  const { canViewReports, loading: roleLoading, role } = useUserRole(fcpId)

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

  const {
    sucursales,
    selectedSucursalId,
    setSelectedSucursalId,
    aulaMetaMap,
    loading: loadingSucursales,
    mostrarSelector: mostrarSelectorSucursal,
    sucursalNombre: sucursalNombreFiltro,
  } = useSucursalReporteFilter(fcpId, 'INTERVENTION')

  const intervencionesVisibles = useMemo(() => {
    let lista = intervenciones
    if (soloAulasIds && soloAulasIds.length > 0) {
      const permitidas = new Set(soloAulasIds)
      lista = lista.filter((a) => permitidas.has(a.id))
    }
    return filtrarAulasPorSucursal(lista, selectedSucursalId, aulaMetaMap)
  }, [intervenciones, soloAulasIds, selectedSucursalId, aulaMetaMap])

  useEffect(() => {
    if (intervencionesVisibles.length === 0) {
      setSelectedIntervencionId('')
      return
    }
    setSelectedIntervencionId((prev) => {
      if (intervencionesVisibles.some((a) => a.id === prev)) return prev
      return intervencionesVisibles[0].id
    })
  }, [intervencionesVisibles])

  const intervencionSeleccionada = intervencionesVisibles.find((a) => a.id === selectedIntervencionId)

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
      const hoy = toLocalDateString(new Date())
      const inicioTemporada = normalizarFecha(intervencionSeleccionada.fecha_inicio)
      if (!inicioTemporada) {
        toast.warning('Sin fecha de inicio', 'La intervención no tiene fecha de inicio configurada.')
        return
      }
      const finTemporada = normalizarFecha(intervencionSeleccionada.fecha_fin) ?? hoy
      const fechaInicio = inicioTemporada
      const fechaFinTemporada = finTemporada

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

      const stats = new Map<
        string,
        { presente: number; falto: number; permiso: number; diasCompletos: number }
      >()
      for (const id of estudiantesMap.keys()) {
        stats.set(id, { presente: 0, falto: 0, permiso: 0, diasCompletos: 0 })
      }

      const asistencias = await fetchAsistenciasIntervencionRango(
        supabase,
        fcpId,
        intervencionSeleccionada.id,
        fechaInicio,
        fechaFinTemporada
      )

      const registroPorEstudianteFecha = new Map<string, { estado: string }>()
      const marcadosPorFecha = new Map<string, Set<string>>()

      for (const a of asistencias) {
        if (!estudiantesMap.has(a.estudiante_id)) continue
        const fecha = normalizarFecha(a.fecha)
        if (!fecha) continue
        if (!fechaEnTemporadaIntervencion(intervencionSeleccionada, fecha)) continue
        registroPorEstudianteFecha.set(`${a.estudiante_id}|${fecha}`, { estado: a.estado })
        if (!marcadosPorFecha.has(fecha)) marcadosPorFecha.set(fecha, new Set())
        marcadosPorFecha.get(fecha)!.add(a.estudiante_id)
      }

      const rosterIds = [...estudiantesMap.keys()]
      const registrados = rosterIds.length
      const diasIncompletos: DiaIncompleto[] = []
      let diasCompletosGlobales = 0

      // Solo evaluar fechas con al menos un registro (días con atención), como en el calendario
      const fechasConMarcas = [...marcadosPorFecha.keys()]
        .filter(
          (fecha) =>
            fecha >= fechaInicio &&
            fecha <= fechaFinTemporada &&
            fechaEnTemporadaIntervencion(intervencionSeleccionada, fecha)
        )
        .sort()

      for (const fecha of fechasConMarcas) {
        if (registrados === 0) break

        const marcadosSet = marcadosPorFecha.get(fecha) ?? new Set()
        const marcados = rosterIds.filter((id) => marcadosSet.has(id)).length

        if (marcados === registrados) {
          diasCompletosGlobales++
          for (const estudianteId of rosterIds) {
            const rec = registroPorEstudianteFecha.get(`${estudianteId}|${fecha}`)
            if (!rec) continue
            const s = stats.get(estudianteId)!
            s.diasCompletos++
            if (rec.estado === 'presente') s.presente++
            else if (rec.estado === 'falto') s.falto++
            else if (rec.estado === 'permiso') s.permiso++
          }
        } else if (marcados > 0 && marcados < registrados) {
          diasIncompletos.push({
            fecha,
            fechaFormateada: formatearFecha(fecha),
            marcados,
            total: registrados,
          })
        }
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
            permisos: s.permiso,
            porcentaje: calcularPorcentaje(s.presente, s.permiso, s.diasCompletos),
          }
        })
        .sort((a, b) => compareNombreCompleto(a.nombreCompleto, b.nombreCompleto))

      const fechasCompletas = fechasConMarcas.filter((fecha) => {
        const marcadosSet = marcadosPorFecha.get(fecha) ?? new Set()
        return rosterIds.filter((id) => marcadosSet.has(id)).length === registrados
      })
      const fechaFinReporte =
        fechasCompletas.length > 0
          ? fechasCompletas[fechasCompletas.length - 1]
          : minFecha(finTemporada, hoy)

      setReporte({
        intervencion: intervencionSeleccionada,
        fechaInicio,
        fechaFin: fechaFinReporte,
        diasCompletos: diasCompletosGlobales,
        filas,
        diasIncompletos: diasIncompletos.sort((a, b) => a.fecha.localeCompare(b.fecha)),
        sucursalNombre: sucursalNombreFiltro,
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
      [`Días de atención (completos): ${reporte.diasCompletos}`],
      [`Días con asistencia incompleta: ${reporte.diasIncompletos.length}`],
      [],
      ['Estudiante', 'Código', 'Asistencias', 'Faltas', 'Permisos', '% Asistencia'],
      ...reporte.filas.map((f) => [
        f.nombreCompleto,
        f.codigo,
        f.asistencias,
        f.faltas,
        f.permisos,
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

  const exportarPDF = async () => {
    if (!reporte) return

    try {
      const jsPDF = (await import('jspdf')).default
      const autotableModule = await import('jspdf-autotable')

      let autoTable: any = null
      if ((autotableModule as any).autoTable && typeof (autotableModule as any).autoTable === 'function') {
        autoTable = (autotableModule as any).autoTable
      } else if ((autotableModule as any).default && typeof (autotableModule as any).default === 'function') {
        autoTable = (autotableModule as any).default
      }

      if ((autotableModule as any).applyPlugin && typeof (autotableModule as any).applyPlugin === 'function') {
        ;(autotableModule as any).applyPlugin(jsPDF)
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15
      let y = 14

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ASISTENCIA ACUMULADA DE LA INTERVENCIÓN', pageWidth / 2, y, { align: 'center' })
      y += 7

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const tituloIntervencion = reporte.intervencion.codigo_aula
        ? `${reporte.intervencion.nombre} (${reporte.intervencion.codigo_aula})`
        : reporte.intervencion.nombre
      doc.text(`Intervención: ${tituloIntervencion}`, margin, y)
      y += 5
      doc.text(`Periodo: ${reporte.fechaInicio} – ${reporte.fechaFin}`, margin, y)
      y += 5
      doc.text(
        `Estudiantes: ${reporte.filas.length} · Días de atención (completos): ${reporte.diasCompletos}`,
        margin,
        y
      )
      y += 5
      if (reporte.intervencion.fecha_inicio) {
        doc.text(`Temporada: ${formatTemporada(reporte.intervencion)}`, margin, y)
        y += 5
      }

      if (reporte.diasIncompletos.length > 0) {
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(180, 83, 9)
        doc.text('Días con asistencia incompleta (no incluidos en totales):', margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        for (const dia of reporte.diasIncompletos) {
          if (y > 270) {
            doc.addPage()
            y = 14
          }
          doc.text(`• ${dia.fechaFormateada} — Marcados: ${dia.marcados}/${dia.total}`, margin + 2, y)
          y += 4
        }
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(9)
        y += 2
      }

      const headers = ['Estudiante', 'Código', 'Asistencias', 'Faltas', 'Permisos', '% Asistencia']
      const body = reporte.filas.map((f) => [
        f.nombreCompleto,
        f.codigo,
        String(f.asistencias),
        String(f.faltas),
        String(f.permisos),
        `${f.porcentaje.toFixed(1)}%`,
      ])

      const availableWidth = getAvailableTableWidth(doc, margin)
      const columnConfigs: PDFTableColumnConfig[] = [
        { type: 'text', weight: 2.2, halign: 'left' },
        { type: 'text', weight: 1, halign: 'left' },
        { type: 'numeric', weight: 0.8, halign: 'center' },
        { type: 'numeric', weight: 0.7, halign: 'center' },
        { type: 'numeric', weight: 0.8, halign: 'center' },
        { type: 'numeric', weight: 0.9, halign: 'center' },
      ]
      const columnStyles = getProportionalColumnStyles(headers.length, availableWidth, columnConfigs)

      const tableOptions = {
        startY: y,
        head: [headers],
        body,
        theme: 'grid',
        tableWidth: availableWidth,
        margin: { left: margin, right: margin },
        headStyles: getPDFHeaderStyles(),
        bodyStyles: getPDFBodyStyles(),
        alternateRowStyles: getPDFAlternateRowStyles(),
        styles: {
          cellPadding: 2.5,
          overflow: 'linebreak',
          fontSize: 8,
        },
        columnStyles,
      }

      if (typeof (doc as any).autoTable === 'function') {
        ;(doc as any).autoTable(tableOptions)
      } else if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions)
      } else {
        throw new Error('autoTable no está disponible. Verifica la instalación de jspdf-autotable.')
      }

      const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20
      if (finalY < 270) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'italic')
        doc.text(
          'Solo cuentan días completos con atención. % = (asistencias + permisos) ÷ días completos del estudiante.',
          margin,
          finalY + 6,
          { maxWidth: availableWidth }
        )
      }

      const slug = (reporte.intervencion.codigo_aula || reporte.intervencion.nombre)
        .replace(/\s+/g, '_')
        .slice(0, 30)
      doc.save(`asistencia_acumulada_${slug}.pdf`)
      toast.success('PDF descargado')
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error('Error al exportar a PDF', 'Intenta nuevamente.')
    }
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

  if (intervencionesVisibles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No hay intervenciones en la sucursal seleccionada.
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
                  {intervencionesVisibles.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                      {a.codigo_aula ? ` (${a.codigo_aula})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mostrarSelectorSucursal && (
              <SucursalReporteSelect
                sucursales={sucursales}
                value={selectedSucursalId}
                onChange={(value) => {
                  setSelectedSucursalId(value)
                  setReporte(null)
                }}
                loading={loadingSucursales}
                className="grid gap-2 flex-1 min-w-[200px]"
              />
            )}
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
                {reporte.filas.length !== 1 ? 's' : ''} · {reporte.diasCompletos} día
                {reporte.diasCompletos !== 1 ? 's' : ''} de atención
                {reporte.sucursalNombre ? ` · Sucursal: ${reporte.sucursalNombre}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportarExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportarPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reporte.diasIncompletos.length > 0 && (
              <div className="mb-4 rounded-md bg-warning/20 border border-warning/50 p-4">
                <h4 className="font-semibold text-warning-foreground mb-2">
                  Días con asistencia incompleta
                </h4>
                <p className="text-sm text-warning-foreground mb-2">
                  Estos días no se incluyen en asistencias, faltas ni en el % del reporte:
                </p>
                <ul className="text-sm text-warning-foreground space-y-2">
                  {reporte.diasIncompletos.map((dia) => {
                    const [year, month] = dia.fecha.split('-').map(Number)
                    const asistenciasUrl = `/asistencias?fcpId=${fcpId}&aulaId=${reporte.intervencion.id}&month=${month - 1}&year=${year}&date=${dia.fecha}`
                    return (
                      <li
                        key={dia.fecha}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 rounded-md bg-warning/30 border border-warning/60"
                      >
                        <span>
                          <strong>{dia.fechaFormateada}</strong> — Marcados: {dia.marcados}/{dia.total}{' '}
                          estudiantes
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(asistenciasUrl)}
                          className="sm:ml-auto whitespace-nowrap"
                        >
                          <Calendar className="h-4 w-4 mr-1.5" />
                          {role === 'facilitador' ? 'Ver asistencia' : 'Corregir asistencia'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
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
                    <TableHead className="text-right w-24">Permisos</TableHead>
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
                        <TableCell className="text-right tabular-nums">{f.permisos}</TableCell>
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
              Del {reporte.fechaInicio} al {reporte.fechaFin} (temporada de la intervención). Solo cuentan
              días completos con atención (2/2 en el calendario). % = (asistencias + permisos) ÷ días
              completos del estudiante. Los permisos cuentan como asistió.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
