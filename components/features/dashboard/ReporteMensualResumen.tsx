'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'

interface NivelData {
  nivel: string
  asistenPromed: number
  registrados: number
  porcentaje: number
  diasDeClases?: number
  totalAsistenciasPresente?: number
}

interface ReporteData {
  niveles: NivelData[]
  totalAsistenPromed: number
  totalRegistrados: number
  totalPorcentaje: number
}

export function ReporteMensualResumen() {
  const [loading, setLoading] = useState(true)
  const [reporteData, setReporteData] = useState<ReporteData | null>(null)
  const { selectedRole, loading: roleLoading } = useSelectedRole()

  useEffect(() => {
    const initialize = async () => {
      // Esperar a que el rol seleccionado se cargue
      if (roleLoading) return
      
      // Si hay un rol seleccionado con fcp_id, generar el reporte
      if (selectedRole?.fcpId) {
        await generarReporte(selectedRole.fcpId)
      } else {
        // Si no hay fcp_id (por ejemplo, facilitador del sistema), intentar obtener FCPs
        await loadUserFCPs()
      }
    }
    initialize()
  }, [selectedRole, roleLoading])

  const loadUserFCPs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener la primera FCP activa del usuario
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select(`
          fcp_id,
          fcp:fcps(id, razon_social)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .not('fcp_id', 'is', null)
        .limit(1)

      if (error) throw error

      if (data && data.length > 0 && data[0].fcp_id) {
        await generarReporte(data[0].fcp_id)
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
      setLoading(false)
    }
  }

  const generarReporte = async (fcpId: string) => {
    if (!fcpId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()

      // Obtener todas las aulas activas de la FCP
      const { data: aulas, error: aulasError } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', fcpId)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (aulasError) throw aulasError

      if (!aulas || aulas.length === 0) {
        setReporteData({
          niveles: [],
          totalAsistenPromed: 0,
          totalRegistrados: 0,
          totalPorcentaje: 0,
        })
        setLoading(false)
        return
      }

      // Calcular días del mes
      const primerDia = new Date(year, month, 1)
      const ultimoDia = new Date(year, month + 1, 0)
      const diasDelMes = ultimoDia.getDate()

      // Obtener todas las fechas del mes
      const fechasDelMes: string[] = []
      for (let dia = 1; dia <= diasDelMes; dia++) {
        const fecha = new Date(year, month, dia)
        fechasDelMes.push(fecha.toISOString().split('T')[0])
      }

      // Obtener estudiantes activos por aula
      const { data: estudiantes, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select('id, aula_id, codigo, nombre_completo')
        .eq('fcp_id', fcpId)
        .eq('activo', true)

      if (estudiantesError) throw estudiantesError

      // Agrupar estudiantes por aula
      const estudiantesPorAula: { [aulaId: string]: any[] } = {}
      estudiantes?.forEach(est => {
        if (!estudiantesPorAula[est.aula_id]) {
          estudiantesPorAula[est.aula_id] = []
        }
        estudiantesPorAula[est.aula_id].push(est)
      })

      // Obtener todas las asistencias del mes usando rango de fechas
      const fechaInicioStr = fechasDelMes[0]
      const fechaFinStr = fechasDelMes[fechasDelMes.length - 1]
      const { data: asistencias, error: asistenciasError } = await supabase
        .from('asistencias')
        .select('id, estudiante_id, fecha, estado')
        .eq('fcp_id', fcpId)
        .gte('fecha', fechaInicioStr)
        .lte('fecha', fechaFinStr)

      if (asistenciasError) throw asistenciasError

      // Agrupar asistencias por estudiante y fecha
      const asistenciasPorEstudianteFecha: { [key: string]: string } = {}
      asistencias?.forEach(asist => {
        const key = `${asist.estudiante_id}-${asist.fecha}`
        asistenciasPorEstudianteFecha[key] = asist.estado
      })

      // Calcular estadísticas por nivel (aula)
      const nivelesData: NivelData[] = []
      let totalAsistenPromed = 0
      let totalRegistrados = 0
      let totalOportunidadesAsistencia = 0

      for (const aula of aulas) {
        const estudiantesAula = estudiantesPorAula[aula.id] || []
        const registrados = estudiantesAula.length

        if (registrados === 0) continue

        // Crear un mapa de asistencias por fecha para esta aula
        const estudiantesAulaIds = new Set(estudiantesAula.map(e => e.id))
        const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

        asistencias?.forEach(asistencia => {
          if (estudiantesAulaIds.has(asistencia.estudiante_id)) {
            const fecha = asistencia.fecha
            if (!asistenciasPorFecha.has(fecha)) {
              asistenciasPorFecha.set(fecha, new Set())
            }
            asistenciasPorFecha.get(fecha)!.add(asistencia.estudiante_id)
          }
        })

        // Contar días completos (días donde todos los estudiantes están marcados)
        let diasDeClases = 0
        let totalAsistenciasPresente = 0

        // Verificar que las fechas sean del mes actual
        asistenciasPorFecha.forEach((estudiantesMarcados, fecha) => {
          const marcados = estudiantesMarcados.size
          
          // Verificar que la fecha sea del mes actual
          const [yearStr, monthStr, dayStr] = fecha.split('-').map(Number)
          const fechaDate = new Date(yearStr, monthStr - 1, dayStr)
          const esDelMesActual = fechaDate.getFullYear() === year && fechaDate.getMonth() === month
          
          // Si todos los estudiantes están marcados y es del mes actual, es un día completo
          if (marcados === registrados && esDelMesActual) {
            diasDeClases++
            
            // Contar asistencias "presente" solo de este día completo
            estudiantesAula.forEach(estudiante => {
              const key = `${estudiante.id}-${fecha}`
              const estado = asistenciasPorEstudianteFecha[key]
              if (estado === 'presente') {
                totalAsistenciasPresente++
              }
            })
          }
        })

        // Asisten. Promed = total de asistió / días de atención
        // Ejemplo: 24 = 48 / 2
        const asistenPromed = diasDeClases > 0 
          ? totalAsistenciasPresente / diasDeClases
          : 0
        const oportunidadesAsistencia = diasDeClases * registrados
        const porcentaje = oportunidadesAsistencia > 0
          ? (totalAsistenciasPresente / oportunidadesAsistencia) * 100
          : 0

        nivelesData.push({
          nivel: aula.nombre,
          asistenPromed,
          registrados,
          porcentaje,
          diasDeClases, // Guardar temporalmente para calcular el total
          totalAsistenciasPresente, // Guardar temporalmente para calcular el total
        })

        // Para el total, sumar las asistencias totales, no los promedios
        totalAsistenPromed += totalAsistenciasPresente
        totalRegistrados += registrados
        totalOportunidadesAsistencia += oportunidadesAsistencia
      }

      // Calcular promedio total: total de asistió / días de atención
      // Ejemplo: 24 = 48 / 2
      const totalDiasAtencion = nivelesData.reduce((sum, nivel) => sum + (nivel as any).diasDeClases, 0)
      const promedioTotal = totalDiasAtencion > 0
        ? totalAsistenPromed / totalDiasAtencion
        : 0

      // Calcular porcentaje total
      const totalPorcentaje = totalOportunidadesAsistencia > 0
        ? (totalAsistenPromed / totalOportunidadesAsistencia) * 100
        : 0

      // Limpiar los datos temporales antes de guardar
      const nivelesLimpios = nivelesData.map(({ diasDeClases, totalAsistenciasPresente, ...rest }) => rest)

      setReporteData({
        niveles: nivelesLimpios,
        totalAsistenPromed: promedioTotal,
        totalRegistrados,
        totalPorcentaje,
      })
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reporte Mensual - Mes Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    )
  }

  if (!reporteData || reporteData.niveles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reporte Mensual - Mes Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay datos disponibles para el mes actual.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reporte Mensual - Mes Actual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-2 bg-muted/50 text-left text-foreground">Niveles</th>
                <th className="border border-border p-2 bg-muted/50 text-right text-foreground">Asisten. Promed</th>
                <th className="border border-border p-2 bg-muted/50 text-right text-foreground">Registrados</th>
                <th className="border border-border p-2 bg-muted/50 text-right text-foreground">Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {reporteData.niveles.map((nivel, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-background hover:bg-accent/50' : 'bg-muted/30 hover:bg-accent/50'}>
                  <td className="border border-border p-2 text-foreground">{nivel.nivel}</td>
                  <td className="border border-border p-2 text-right text-foreground">{nivel.asistenPromed.toFixed(2)}</td>
                  <td className="border border-border p-2 text-right text-foreground">{nivel.registrados}</td>
                  <td className="border border-border p-2 text-right text-foreground">{nivel.porcentaje.toFixed(2)}%</td>
                </tr>
              ))}
              <tr className="bg-accent font-bold">
                <td className="border border-border p-2 text-foreground">Total</td>
                <td className="border border-border p-2 text-right text-foreground">{reporteData.totalAsistenPromed.toFixed(2)}</td>
                <td className="border border-border p-2 text-right text-foreground">{reporteData.totalRegistrados}</td>
                <td className="border border-border p-2 text-right text-foreground">{reporteData.totalPorcentaje.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

