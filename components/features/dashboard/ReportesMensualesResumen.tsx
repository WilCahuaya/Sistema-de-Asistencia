'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileSpreadsheet, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
  const [mesActual, setMesActual] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() })

  useEffect(() => {
    cargarResumenes()
  }, [])

  const cargarResumenes = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el usuario es facilitador
      const { data: facilitadorData, error: facilitadorError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      let todasLasFCPs: any[] = []

      if (facilitadorData && facilitadorData.length > 0) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPsData, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        todasLasFCPs = (todasLasFCPsData || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP'
        }))
      } else {
        // Usuarios no facilitadores solo ven sus FCPs
        const { data: userFCPs, error: userFCPsError } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (userFCPsError) throw userFCPsError
        todasLasFCPs = (userFCPs || []).map((item: any) => ({
          id: item.fcp?.id,
          nombre: item.fcp?.razon_social || 'FCP'
        })).filter((fcp: any) => fcp.id) || []
      }

      const resumenesData: FCPResumen[] = []

      // Calcular fechas del mes actual
      const fechaInicio = new Date(mesActual.year, mesActual.month, 1)
      const fechaFin = new Date(mesActual.year, mesActual.month + 1, 0)
      fechaFin.setHours(23, 59, 59, 999)
      const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
      const fechaFinStr = fechaFin.toISOString().split('T')[0]

      // Para cada FCP, calcular el porcentaje de asistencia del mes
      for (const fcp of todasLasFCPs || []) {
        // Obtener todas las aulas de la FCP
        const { data: aulasData, error: aulasError } = await supabase
          .from('aulas')
          .select('id, nombre')
          .eq('fcp_id', fcp.id)
          .eq('activa', true)

        if (aulasError) {
          // Si hay error, agregar la FCP sin datos
          resumenesData.push({
            id: fcp.id,
            nombre: fcp.nombre,
            porcentaje: 0,
            totalAsistenPromed: 0,
            totalOportunidades: 0,
            sinAsistencias: true,
          })
          continue
        }

        // Obtener estudiantes activos
        const { data: estudiantesData, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select('id, aula_id')
          .eq('fcp_id', fcp.id)
          .eq('activo', true)

        if (estudiantesError) {
          resumenesData.push({
            id: fcp.id,
            nombre: fcp.nombre,
            porcentaje: 0,
            totalAsistenPromed: 0,
            totalOportunidades: 0,
            sinAsistencias: true,
          })
          continue
        }

        // Obtener todas las asistencias del mes
        const estudianteIds = estudiantesData?.map((e) => e.id) || []
        
        // Si no hay estudiantes, agregar la FCP sin datos
        if (estudianteIds.length === 0) {
          resumenesData.push({
            id: fcp.id,
            nombre: fcp.nombre,
            porcentaje: 0,
            totalAsistenPromed: 0,
            totalOportunidades: 0,
            sinAsistencias: true,
          })
          continue
        }

        const { data: todasAsistenciasData, error: todasAsistenciasError } = await supabase
          .from('asistencias')
          .select('estudiante_id, fecha, estado')
          .eq('fcp_id', fcp.id)
          .in('estudiante_id', estudianteIds)
          .gte('fecha', fechaInicioStr)
          .lte('fecha', fechaFinStr)

        if (todasAsistenciasError) {
          resumenesData.push({
            id: fcp.id,
            nombre: fcp.nombre,
            porcentaje: 0,
            totalAsistenPromed: 0,
            totalOportunidades: 0,
            sinAsistencias: true,
          })
          continue
        }

        // Si no hay asistencias, agregar la FCP con el flag sinAsistencias
        if (!todasAsistenciasData || todasAsistenciasData.length === 0) {
          resumenesData.push({
            id: fcp.id,
            nombre: fcp.nombre,
            porcentaje: 0,
            totalAsistenPromed: 0,
            totalOportunidades: 0,
            sinAsistencias: true,
          })
          continue
        }

        let totalAsistenPromed = 0
        let totalOportunidadesAsistencia = 0

        // Procesar por aula (igual que ReporteMensual)
        aulasData?.forEach((aula) => {
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

            // Solo contar días completos (todos marcados) o días sin atención (ninguno marcado)
            if ((marcados === registrados || marcados === 0) && esDelMesSeleccionado) {
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

        // Calcular porcentaje
        const porcentaje = totalOportunidadesAsistencia > 0
          ? (totalAsistenPromed / totalOportunidadesAsistencia) * 100
          : 0

        resumenesData.push({
          id: fcp.id,
          nombre: fcp.nombre,
          porcentaje: Number(porcentaje.toFixed(2)),
          totalAsistenPromed,
          totalOportunidades: totalOportunidadesAsistencia,
          sinAsistencias: totalOportunidadesAsistencia === 0,
        })
      }

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

