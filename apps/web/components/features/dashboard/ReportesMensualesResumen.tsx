'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { getCurrentMonthYearInAppTimezone, getMonthRangeInAppTimezone } from '@/lib/utils/dateUtils'

interface FCPResumen {
  id: string
  nombre: string
  porcentaje: number
  totalAsistenPromed: number
  totalOportunidades: number
  sinAsistencias: boolean
}

export function ReportesMensualesResumen() {
  const [loading, setLoading] = useState(true)
  const [resumenes, setResumenes] = useState<FCPResumen[]>([])
  const mesActual = getCurrentMonthYearInAppTimezone()
  const { selectedRole } = useSelectedRole()

  useEffect(() => {
    cargarResumenes()
  }, [selectedRole?.role, selectedRole?.fcpId])

  const cargarResumenes = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: facRow } = await supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle()
      let todasLasFCPs: any[] = []

      if (facRow) {
        const { data: fcpsData, error: e } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('facilitador_id', user.id)
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        if (!e && fcpsData) todasLasFCPs = fcpsData.map((f: any) => ({ id: f.id, nombre: f.razon_social || 'FCP' }))
      } else {
        const { data: userFCPs, error: userFCPsError } = await supabase
          .from('fcp_miembros')
          .select('fcp_id, fcp:fcps(id, razon_social)')
          .eq('usuario_id', user.id)
          .eq('activo', true)
          .not('fcp_id', 'is', null)
        if (!userFCPsError && userFCPs) {
          todasLasFCPs = (userFCPs || [])
            .map((item: any) => ({ id: item.fcp?.id, nombre: item.fcp?.razon_social || 'FCP' }))
            .filter((fcp: any) => fcp.id) || []
        }
      }

      if (selectedRole?.fcpId) {
        const sole = todasLasFCPs.find((f: any) => f.id === selectedRole.fcpId)
        todasLasFCPs = sole ? [sole] : []
      }

      const { start: fechaInicioStr, end: fechaFinStr } = getMonthRangeInAppTimezone(mesActual.year, mesActual.month)

      const procesarFCP = async (fcp: { id: string; nombre: string }) => {
        const fallback = (): FCPResumen => ({
          id: fcp.id,
          nombre: fcp.nombre,
          porcentaje: 0,
          totalAsistenPromed: 0,
          totalOportunidades: 0,
          sinAsistencias: true,
        })

        const [aulasRes, estudiantesRes] = await Promise.all([
          supabase.from('aulas').select('id, nombre').eq('fcp_id', fcp.id).eq('activa', true),
          supabase.from('estudiantes').select('id, aula_id').eq('fcp_id', fcp.id).eq('activo', true),
        ])
        if (aulasRes.error || estudiantesRes.error) return fallback()

        const aulasData = aulasRes.data
        const estudiantesData = estudiantesRes.data
        const estudianteIds = estudiantesData?.map((e) => e.id) || []
        if (!aulasData?.length || estudianteIds.length === 0) return fallback()

        const { data: todasAsistenciasData, error: todasAsistenciasError } = await supabase
          .from('asistencias')
          .select('estudiante_id, fecha, estado')
          .eq('fcp_id', fcp.id)
          .in('estudiante_id', estudianteIds)
          .gte('fecha', fechaInicioStr)
          .lte('fecha', fechaFinStr)

        if (todasAsistenciasError || !todasAsistenciasData?.length) return fallback()

        let totalAsistenPromed = 0
        let totalOportunidadesAsistencia = 0

        aulasData.forEach((aula) => {
          const estudiantesAula = estudiantesData?.filter(e => e.aula_id === aula.id) || []
          const registrados = estudiantesAula.length

          if (registrados === 0) return

          // Detectar días completos para esta aula
          const estudiantesAulaIds = new Set(estudiantesAula.map(e => e.id))
          const asistenciasPorFecha = new Map<string, Set<string>>()

          todasAsistenciasData?.forEach(asistencia => {
            if (estudiantesAulaIds.has(asistencia.estudiante_id)) {
              const fecha = asistencia.fecha
              if (!asistenciasPorFecha.has(fecha)) {
                asistenciasPorFecha.set(fecha, new Set())
              }
              asistenciasPorFecha.get(fecha)!.add(asistencia.estudiante_id)
            }
          })

          // Validar días completos y contar días de clases
          let diasDeClases = 0
          asistenciasPorFecha.forEach((estudiantesMarcados, fecha) => {
            const marcados = estudiantesMarcados.size
            const [year, month, day] = fecha.split('-').map(Number)
            const fechaDate = new Date(year, month - 1, day)
            const esDelMesSeleccionado = fechaDate.getFullYear() === mesActual.year && fechaDate.getMonth() === mesActual.month

            // Días completos: solo cuenta cuando TODOS tienen estado (presente/faltó/permiso)
            if (marcados === registrados && registrados > 0 && esDelMesSeleccionado) {
              diasDeClases++
            }
          })

          // Contar asistencias "presente" solo de días completos
          let asistenciasPresenteAula = 0
          asistenciasPorFecha.forEach((estudiantesMarcados, fecha) => {
            const marcados = estudiantesMarcados.size
            const [year, month, day] = fecha.split('-').map(Number)
            const fechaDate = new Date(year, month - 1, day)
            const esDelMesSeleccionado = fechaDate.getFullYear() === mesActual.year && fechaDate.getMonth() === mesActual.month

            if (marcados === registrados && esDelMesSeleccionado) {
              // Día completo: contar asistencias "presente"
              todasAsistenciasData?.forEach(asistencia => {
                if (
                  estudiantesAulaIds.has(asistencia.estudiante_id) &&
                  asistencia.fecha === fecha &&
                  asistencia.estado === 'presente'
                ) {
                  asistenciasPresenteAula++
                }
              })
            }
          })

          const oportunidadesAsistencia = diasDeClases * registrados
          totalAsistenPromed += asistenciasPresenteAula
          totalOportunidadesAsistencia += oportunidadesAsistencia
        })

        const porcentaje = totalOportunidadesAsistencia > 0
          ? (totalAsistenPromed / totalOportunidadesAsistencia) * 100
          : 0

        return {
          id: fcp.id,
          nombre: fcp.nombre,
          porcentaje: Number(porcentaje.toFixed(2)),
          totalAsistenPromed,
          totalOportunidades: totalOportunidadesAsistencia,
          sinAsistencias: totalOportunidadesAsistencia === 0,
        }
      }

      const resumenesData = await Promise.all((todasLasFCPs || []).map(procesarFCP))

      // Ordenar: primero las que tienen asistencias (por porcentaje descendente), luego las que no tienen
      resumenesData.sort((a, b) => {
        if (a.sinAsistencias && !b.sinAsistencias) return 1
        if (!a.sinAsistencias && b.sinAsistencias) return -1
        return b.porcentaje - a.porcentaje
      })
      setResumenes(resumenesData)
    } catch (error) {
      console.error('Error loading resumenes:', error)
    } finally {
      setLoading(false)
    }
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando reportes mensuales...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reportes Mensuales - {monthNames[mesActual.month]} {mesActual.year}</CardTitle>
            <CardDescription>
              Resumen de asistencia por FCP del mes actual
            </CardDescription>
          </div>
          <Link href="/reportes?view=participantes-mes&auto=true">
            <Button variant="outline" size="sm">
              Ver Detalles
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {resumenes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No hay datos de asistencia para el mes actual
          </p>
        ) : (
          <div className="space-y-4">
            {resumenes.map((resumen) => (
              <div
                key={resumen.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{resumen.nombre}</p>
                  {resumen.sinAsistencias ? (
                    <p className="text-sm text-muted-foreground">
                      0 / 0 asistencias
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {resumen.totalAsistenPromed} / {resumen.totalOportunidades} asistencias
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${
                    resumen.sinAsistencias ? 'text-red-600' :
                    resumen.porcentaje >= 90 ? 'text-green-600' :
                    resumen.porcentaje >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {resumen.porcentaje.toFixed(2)}%
                  </p>
                  <Link href={`/reportes?view=mensual&fcp=${resumen.id}&auto=true&year=${mesActual.year}&month=${mesActual.month + 1}`}>
                    <Button variant="ghost" size="sm" className="mt-1">
                      Ver Reporte
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

