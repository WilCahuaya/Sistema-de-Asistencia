'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart3, FileSpreadsheet, FileText, Calendar, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

interface ReporteData {
  ong: {
    id: string
    nombre: string
  }
  fechaInicio: string
  fechaFin: string
  totalEstudiantes: number
  totalPresentes: number
  totalFaltas: number
  totalPermisos: number
  resumenPorAula: Array<{
    aula_id: string
    aula_nombre: string
    total_estudiantes: number
    presentes: number
    faltas: number
    permisos: number
  }>
  resumenPorEstudiante: Array<{
    estudiante_id: string
    estudiante_codigo: string
    estudiante_nombre: string
    aula_nombre: string
    presentes: number
    faltas: number
    permisos: number
    total_dias: number
  }>
}

type TipoReporte = 'semanal' | 'mensual' | 'general'

export function ReporteList() {
  const [loading, setLoading] = useState(false)
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('semanal')
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])
  const [reporteData, setReporteData] = useState<ReporteData | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadUserONGs()
    setFechasDefault()
  }, [])

  useEffect(() => {
    if (tipoReporte) {
      setFechasDefault()
    }
  }, [tipoReporte])

  const setFechasDefault = () => {
    const now = new Date()
    let inicio: Date
    let fin: Date = new Date(now)

    switch (tipoReporte) {
      case 'semanal':
        inicio = new Date(now)
        inicio.setDate(now.getDate() - now.getDay()) // Lunes de esta semana
        inicio.setHours(0, 0, 0, 0)
        fin.setHours(23, 59, 59, 999)
        break
      case 'mensual':
        inicio = new Date(now.getFullYear(), now.getMonth(), 1)
        fin = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        fin.setHours(23, 59, 59, 999)
        break
      case 'general':
        // Desde el inicio del año hasta hoy
        inicio = new Date(now.getFullYear(), 0, 1)
        fin = new Date(now)
        fin.setHours(23, 59, 59, 999)
        break
      default:
        inicio = new Date(now)
        fin = new Date(now)
    }

    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(fin.toISOString().split('T')[0])
  }

  const loadUserONGs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          ong_id,
          ong:ongs(id, nombre)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (error) throw error

      const ongs = data?.map((item: any) => ({
        id: item.ong.id,
        nombre: item.ong.nombre,
      })) || []

      setUserONGs(ongs)
      if (ongs.length > 0 && !selectedONG) {
        setSelectedONG(ongs[0].id)
      }
    } catch (error) {
      console.error('Error loading ONGs:', error)
    }
  }

  const generarReporte = async () => {
    if (!selectedONG || !fechaInicio || !fechaFin) {
      alert('Por favor, completa todos los campos requeridos')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // Obtener datos de la ONG
      const { data: ongData, error: ongError } = await supabase
        .from('ongs')
        .select('id, nombre')
        .eq('id', selectedONG)
        .single()

      if (ongError) throw ongError

      // Obtener estudiantes activos de la ONG
      const { data: estudiantesData, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select(`
          id,
          codigo,
          nombre_completo,
          aula_id,
          aula:aulas(id, nombre)
        `)
        .eq('ong_id', selectedONG)
        .eq('activo', true)

      if (estudiantesError) throw estudiantesError

      // Obtener asistencias en el rango de fechas
      const { data: asistenciasData, error: asistenciasError } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado, fecha')
        .eq('ong_id', selectedONG)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)

      if (asistenciasError) throw asistenciasError

      // Calcular estadísticas
      const totalEstudiantes = estudiantesData?.length || 0
      let totalPresentes = 0
      let totalFaltas = 0
      let totalPermisos = 0

      const resumenPorAulaMap = new Map<string, {
        aula_id: string
        aula_nombre: string
        total_estudiantes: number
        presentes: number
        faltas: number
        permisos: number
      }>()

      const resumenPorEstudianteMap = new Map<string, {
        estudiante_id: string
        estudiante_codigo: string
        estudiante_nombre: string
        aula_nombre: string
        presentes: number
        faltas: number
        permisos: number
        total_dias: number
      }>()

      // Inicializar mapas con estudiantes
      estudiantesData?.forEach((est) => {
        const aulaId = est.aula_id
        const aulaNombre = (est.aula as any)?.nombre || 'Sin aula'

        // Inicializar resumen por aula
        if (!resumenPorAulaMap.has(aulaId)) {
          resumenPorAulaMap.set(aulaId, {
            aula_id: aulaId,
            aula_nombre: aulaNombre,
            total_estudiantes: 0,
            presentes: 0,
            faltas: 0,
            permisos: 0,
          })
        }
        const aulaResumen = resumenPorAulaMap.get(aulaId)!
        aulaResumen.total_estudiantes++

        // Inicializar resumen por estudiante
        resumenPorEstudianteMap.set(est.id, {
          estudiante_id: est.id,
          estudiante_codigo: est.codigo,
          estudiante_nombre: est.nombre_completo,
          aula_nombre: aulaNombre,
          presentes: 0,
          faltas: 0,
          permisos: 0,
          total_dias: 0,
        })
      })

      // Procesar asistencias
      asistenciasData?.forEach((asist) => {
        const estado = asist.estado
        if (estado === 'presente') {
          totalPresentes++
        } else if (estado === 'falto') {
          totalFaltas++
        } else if (estado === 'permiso') {
          totalPermisos++
        }

        // Actualizar resumen por estudiante
        const estudianteResumen = resumenPorEstudianteMap.get(asist.estudiante_id)
        if (estudianteResumen) {
          estudianteResumen.total_dias++
          if (estado === 'presente') {
            estudianteResumen.presentes++
          } else if (estado === 'falto') {
            estudianteResumen.faltas++
          } else if (estado === 'permiso') {
            estudianteResumen.permisos++
          }
        }

        // Actualizar resumen por aula
        const estudiante = estudiantesData?.find(e => e.id === asist.estudiante_id)
        if (estudiante) {
          const aulaResumen = resumenPorAulaMap.get(estudiante.aula_id)
          if (aulaResumen) {
            if (estado === 'presente') {
              aulaResumen.presentes++
            } else if (estado === 'falto') {
              aulaResumen.faltas++
            } else if (estado === 'permiso') {
              aulaResumen.permisos++
            }
          }
        }
      })

      const reporte: ReporteData = {
        ong: {
          id: ongData.id,
          nombre: ongData.nombre,
        },
        fechaInicio,
        fechaFin,
        totalEstudiantes,
        totalPresentes,
        totalFaltas,
        totalPermisos,
        resumenPorAula: Array.from(resumenPorAulaMap.values()),
        resumenPorEstudiante: Array.from(resumenPorEstudianteMap.values()).sort((a, b) =>
          a.estudiante_nombre.localeCompare(b.estudiante_nombre)
        ),
      }

      setReporteData(reporte)
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Error al generar el reporte. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = async () => {
    if (!reporteData) return

    try {
      const XLSX = await import('xlsx')

      // Crear workbook
      const wb = XLSX.utils.book_new()

      // Hoja 1: Resumen General
      const resumenGeneral = [
        ['ONG:', reporteData.ong.nombre],
        ['Fecha Inicio:', reporteData.fechaInicio],
        ['Fecha Fin:', reporteData.fechaFin],
        [''],
        ['Total Estudiantes:', reporteData.totalEstudiantes],
        ['Total Presentes:', reporteData.totalPresentes],
        ['Total Faltas:', reporteData.totalFaltas],
        ['Total Permisos:', reporteData.totalPermisos],
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(resumenGeneral)
      XLSX.utils.book_append_sheet(wb, ws1, 'Resumen General')

      // Hoja 2: Resumen por Aula
      const resumenAula = [
        ['Aula', 'Total Estudiantes', 'Presentes', 'Faltas', 'Permisos'],
        ...reporteData.resumenPorAula.map(a => [
          a.aula_nombre,
          a.total_estudiantes,
          a.presentes,
          a.faltas,
          a.permisos,
        ]),
      ]
      const ws2 = XLSX.utils.aoa_to_sheet(resumenAula)
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Aula')

      // Hoja 3: Resumen por Estudiante
      const resumenEstudiante = [
        ['Código', 'Nombre', 'Aula', 'Presentes', 'Faltas', 'Permisos', 'Total Días'],
        ...reporteData.resumenPorEstudiante.map(e => [
          e.estudiante_codigo,
          e.estudiante_nombre,
          e.aula_nombre,
          e.presentes,
          e.faltas,
          e.permisos,
          e.total_dias,
        ]),
      ]
      const ws3 = XLSX.utils.aoa_to_sheet(resumenEstudiante)
      XLSX.utils.book_append_sheet(wb, ws3, 'Resumen por Estudiante')

      // Descargar
      const tipoReporteNombre = tipoReporte === 'semanal' ? 'Semanal' : tipoReporte === 'mensual' ? 'Mensual' : 'General'
      const nombreArchivo = `Reporte_${tipoReporteNombre}_${reporteData.ong.nombre}_${reporteData.fechaInicio}_${reporteData.fechaFin}.xlsx`
      XLSX.writeFile(wb, nombreArchivo)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Error al exportar a Excel. Por favor, intenta nuevamente.')
    }
  }

  const exportarPDF = async () => {
    if (!reporteData) return

    try {
      const jsPDF = (await import('jspdf')).default

      const doc = new jsPDF()
      let y = 20

      // Título
      doc.setFontSize(18)
      doc.text('Reporte de Asistencias', 105, y, { align: 'center' })
      y += 10

      // Información general
      doc.setFontSize(12)
      doc.text(`ONG: ${reporteData.ong.nombre}`, 20, y)
      y += 6
      doc.text(`Fecha Inicio: ${reporteData.fechaInicio}`, 20, y)
      y += 6
      doc.text(`Fecha Fin: ${reporteData.fechaFin}`, 20, y)
      y += 10

      // Resumen general
      doc.setFontSize(14)
      doc.text('Resumen General', 20, y)
      y += 8
      doc.setFontSize(10)
      doc.text(`Total Estudiantes: ${reporteData.totalEstudiantes}`, 30, y)
      y += 6
      doc.text(`Total Presentes: ${reporteData.totalPresentes}`, 30, y)
      y += 6
      doc.text(`Total Faltas: ${reporteData.totalFaltas}`, 30, y)
      y += 6
      doc.text(`Total Permisos: ${reporteData.totalPermisos}`, 30, y)
      y += 10

      // Resumen por Aula
      doc.setFontSize(14)
      doc.text('Resumen por Aula', 20, y)
      y += 8
      doc.setFontSize(10)
      reporteData.resumenPorAula.forEach(aula => {
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(`${aula.aula_nombre}: ${aula.presentes} presentes, ${aula.faltas} faltas, ${aula.permisos} permisos`, 30, y)
        y += 6
      })
      y += 10

      // Resumen por Estudiante (solo los primeros 30 para no hacer el PDF muy largo)
      doc.setFontSize(14)
      doc.text('Resumen por Estudiante (primeros 30)', 20, y)
      y += 8
      doc.setFontSize(8)
      reporteData.resumenPorEstudiante.slice(0, 30).forEach(est => {
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(`${est.estudiante_codigo} - ${est.estudiante_nombre}: ${est.presentes}P / ${est.faltas}F / ${est.permisos}Perm`, 30, y)
        y += 5
      })

      // Descargar
      const tipoReporteNombre = tipoReporte === 'semanal' ? 'Semanal' : tipoReporte === 'mensual' ? 'Mensual' : 'General'
      const nombreArchivo = `Reporte_${tipoReporteNombre}_${reporteData.ong.nombre}_${reporteData.fechaInicio}_${reporteData.fechaFin}.pdf`
      doc.save(nombreArchivo)
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      alert('Error al exportar a PDF. Por favor, intenta nuevamente.')
    }
  }

  if (userONGs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes ONGs asociadas. Primero crea o únete a una ONG.
          </p>
          <Button onClick={() => router.push('/ongs')}>
            Ir a ONGs
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurar Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Reporte:</label>
              <select
                value={tipoReporte}
                onChange={(e) => setTipoReporte(e.target.value as TipoReporte)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">ONG:</label>
              <select
                value={selectedONG || ''}
                onChange={(e) => setSelectedONG(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                {userONGs.map((ong) => (
                  <option key={ong.id} value={ong.id}>
                    {ong.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Fecha Inicio:</label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Fecha Fin:</label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={generarReporte} disabled={loading || !selectedONG || !fechaInicio || !fechaFin}>
              {loading ? (
                <>
                  <Calendar className="mr-2 h-4 w-4 animate-pulse" />
                  Generando...
                </>
              ) : (
                <>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generar Reporte
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {reporteData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reporte Generado</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportarExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" onClick={exportarPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Resumen General */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Resumen General</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{reporteData.totalEstudiantes}</div>
                      <p className="text-xs text-muted-foreground">Total Estudiantes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{reporteData.totalPresentes}</div>
                      <p className="text-xs text-muted-foreground">Presentes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{reporteData.totalFaltas}</div>
                      <p className="text-xs text-muted-foreground">Faltas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-yellow-600">{reporteData.totalPermisos}</div>
                      <p className="text-xs text-muted-foreground">Permisos</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Resumen por Aula */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Resumen por Aula</h3>
                <div className="space-y-2">
                  {reporteData.resumenPorAula.map((aula) => (
                    <Card key={aula.aula_id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{aula.aula_nombre}</p>
                            <p className="text-sm text-muted-foreground">{aula.total_estudiantes} estudiantes</p>
                          </div>
                          <div className="flex gap-4">
                            <Badge className="bg-green-500">{aula.presentes} Presentes</Badge>
                            <Badge className="bg-red-500">{aula.faltas} Faltas</Badge>
                            <Badge className="bg-yellow-500">{aula.permisos} Permisos</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Resumen por Estudiante (tabla) */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Resumen por Estudiante</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Código</th>
                          <th className="px-4 py-2 text-left">Nombre</th>
                          <th className="px-4 py-2 text-left">Aula</th>
                          <th className="px-4 py-2 text-center">Presentes</th>
                          <th className="px-4 py-2 text-center">Faltas</th>
                          <th className="px-4 py-2 text-center">Permisos</th>
                          <th className="px-4 py-2 text-center">Total Días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporteData.resumenPorEstudiante.map((est, index) => (
                          <tr key={est.estudiante_id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                            <td className="px-4 py-2 font-mono">{est.estudiante_codigo}</td>
                            <td className="px-4 py-2">{est.estudiante_nombre}</td>
                            <td className="px-4 py-2">{est.aula_nombre}</td>
                            <td className="px-4 py-2 text-center text-green-600">{est.presentes}</td>
                            <td className="px-4 py-2 text-center text-red-600">{est.faltas}</td>
                            <td className="px-4 py-2 text-center text-yellow-600">{est.permisos}</td>
                            <td className="px-4 py-2 text-center">{est.total_dias}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

