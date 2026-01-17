'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, FileText, Calendar } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useRouter } from 'next/navigation'

interface ReporteMensualProps {
  ongId: string | null
}

interface NivelData {
  nivel: string
  asistenPromed: number // Suma de asistencias "presente" en el mes
  registrados: number // Total de estudiantes activos en el nivel
  porcentaje: number // (asistenPromed / registrados) * 100
}

interface DiaIncompleto {
  fecha: string
  fechaFormateada: string
  nivel: string
  aulaId: string
  marcados: number
  total: number
}

interface ReporteData {
  ong: { id: string; nombre: string }
  year: number
  month: number
  niveles: NivelData[]
  totalAsistenPromed: number
  totalRegistrados: number
  totalPorcentaje: number
  diasIncompletos: DiaIncompleto[]
}

export function ReporteMensual({ ongId: ongIdProp }: ReporteMensualProps) {
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedONG, setSelectedONG] = useState<string | null>(ongIdProp || null)
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])
  const [reporteData, setReporteData] = useState<ReporteData | null>(null)
  const [facilitadorNombre, setFacilitadorNombre] = useState<string>('')
  const [responsable, setResponsable] = useState<{ nombre: string; email: string; rol: string } | null>(null)
  const { canViewReports, loading: roleLoading } = useUserRole(selectedONG)
  const router = useRouter()

  useEffect(() => {
    if (ongIdProp) {
      setSelectedONG(ongIdProp)
    } else {
      loadUserONGs()
    }
  }, [ongIdProp])

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

  const loadFacilitador = async (ongId: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener el primer facilitador de la ONG
      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          usuario:usuarios(nombre_completo, email)
        `)
        .eq('ong_id', ongId)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading facilitador:', error)
        return
      }

      if (data) {
        const usuario = data.usuario as any
        const nombre = usuario?.nombre_completo || usuario?.email || ''
        setFacilitadorNombre(nombre)
      } else {
        setFacilitadorNombre('')
      }
    } catch (error) {
      console.error('Error loading facilitador:', error)
      setFacilitadorNombre('')
    }
  }

  const generarReporte = async () => {
    if (!selectedONG) {
      alert('Por favor, selecciona una ONG')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // Obtener datos del usuario actual (responsable)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Obtener rol y datos del usuario en la ONG
        const { data: usuarioOngData, error: usuarioOngError } = await supabase
          .from('usuario_ong')
          .select(`
            rol,
            usuario:usuarios(nombre_completo, email)
          `)
          .eq('usuario_id', user.id)
          .eq('ong_id', selectedONG)
          .eq('activo', true)
          .single()

        if (!usuarioOngError && usuarioOngData) {
          const usuario = usuarioOngData.usuario as any
          const rol = usuarioOngData.rol === 'facilitador' ? 'Facilitador' : usuarioOngData.rol === 'secretario' ? 'Secretario' : ''
          if (rol && (rol === 'Facilitador' || rol === 'Secretario')) {
            setResponsable({
              nombre: usuario?.nombre_completo || usuario?.email || user.email || '',
              email: usuario?.email || user.email || '',
              rol,
            })
          }
        }
      }

      // Obtener datos de la ONG
      const { data: ongData, error: ongError } = await supabase
        .from('ongs')
        .select('id, nombre')
        .eq('id', selectedONG)
        .single()

      if (ongError) throw ongError

      // Calcular fechas del mes
      const fechaInicio = new Date(selectedYear, selectedMonth, 1)
      const fechaFin = new Date(selectedYear, selectedMonth + 1, 0)
      fechaFin.setHours(23, 59, 59, 999)
      const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
      const fechaFinStr = fechaFin.toISOString().split('T')[0]

      // Cargar facilitador
      await loadFacilitador(selectedONG)

      // Obtener todas las aulas de la ONG
      const { data: aulasData, error: aulasError } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('ong_id', selectedONG)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (aulasError) throw aulasError

      // Obtener estudiantes activos por aula
      const { data: estudiantesData, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select('id, aula_id')
        .eq('ong_id', selectedONG)
        .eq('activo', true)

      if (estudiantesError) throw estudiantesError

      // Obtener TODAS las asistencias del mes (para detectar días incompletos)
      const { data: todasAsistenciasData, error: todasAsistenciasError } = await supabase
        .from('asistencias')
        .select('estudiante_id, fecha, estado')
        .eq('ong_id', selectedONG)
        .gte('fecha', fechaInicioStr)
        .lte('fecha', fechaFinStr)

      if (todasAsistenciasError) throw todasAsistenciasError

      // Obtener asistencias "presente" para el cálculo del reporte
      const asistenciasPresente = todasAsistenciasData?.filter(a => a.estado === 'presente') || []

      // Calcular datos por nivel y detectar días incompletos
      const niveles: NivelData[] = []
      let totalAsistenPromed = 0
      let totalRegistrados = 0
      const diasIncompletosGlobales: DiaIncompleto[] = []

      aulasData?.forEach((aula) => {
        const estudiantesAula = estudiantesData?.filter(e => e.aula_id === aula.id) || []
        const registrados = estudiantesAula.length

        // Contar asistencias "presente" para estudiantes de este aula
        const asistenciasAula = asistenciasPresente?.filter(a => 
          estudiantesAula.some(e => e.id === a.estudiante_id)
        ) || []
        const asistenPromed = asistenciasAula.length

        // Detectar días incompletos para esta aula
        const estudiantesAulaIds = new Set(estudiantesAula.map(e => e.id))
        const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

        todasAsistenciasData?.forEach(asistencia => {
          if (estudiantesAulaIds.has(asistencia.estudiante_id)) {
            const fecha = asistencia.fecha
            if (!asistenciasPorFecha.has(fecha)) {
              asistenciasPorFecha.set(fecha, new Set())
            }
            asistenciasPorFecha.get(fecha)!.add(asistencia.estudiante_id)
          }
        })

        // Validar días completos
        asistenciasPorFecha.forEach((estudiantesMarcados, fecha) => {
          const marcados = estudiantesMarcados.size
          // Si hay al menos uno marcado pero no todos, es un día incompleto
          if (marcados > 0 && marcados < registrados) {
            // Parsear fecha como fecha local para evitar problemas de zona horaria
            const [year, month, day] = fecha.split('-').map(Number)
            const fechaDate = new Date(year, month - 1, day)
            if (fechaDate.getFullYear() === selectedYear && fechaDate.getMonth() === selectedMonth) {
              diasIncompletosGlobales.push({
                fecha,
                fechaFormateada: fechaDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
                nivel: aula.nombre,
                aulaId: aula.id,
                marcados,
                total: registrados,
              })
            }
          }
        })

        const porcentaje = registrados > 0 ? (asistenPromed / registrados) * 100 : 0

        niveles.push({
          nivel: aula.nombre,
          asistenPromed,
          registrados,
          porcentaje,
        })

        totalAsistenPromed += asistenPromed
        totalRegistrados += registrados
      })

      // Calcular porcentaje total
      const totalPorcentaje = totalRegistrados > 0 ? (totalAsistenPromed / totalRegistrados) * 100 : 0

      setReporteData({
        ong: {
          id: ongData.id,
          nombre: ongData.nombre,
        },
        year: selectedYear,
        month: selectedMonth,
        niveles,
        totalAsistenPromed,
        totalRegistrados,
        totalPorcentaje,
        diasIncompletos: diasIncompletosGlobales.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      })
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Error al generar el reporte. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const exportarPDF = async () => {
    if (!reporteData) return

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
        (autotableModule as any).applyPlugin(jsPDF)
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]

      let y = 20

      // Título
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('RESUMEN MENSUAL DE PROYECTO', pageWidth / 2, y, { align: 'center' })
      y += 10

      // Información del proyecto
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Proyecto: ${reporteData.ong.nombre}`, 20, y)
      y += 6
      doc.text(`N° Proyecto: ${reporteData.ong.id.substring(0, 8).toUpperCase()}`, 20, y)
      y += 6
      doc.text(`Mes: ${monthNames[reporteData.month]} ${reporteData.year}`, 20, y)
      y += 6
      doc.text(`Facilitador: ${facilitadorNombre || ''}`, 20, y)
      if (responsable) {
        y += 6
        doc.text(`Responsable: ${responsable.nombre} (${responsable.rol})`, 20, y)
        y += 3
        doc.setFontSize(9)
        doc.text(`Email: ${responsable.email}`, 20, y)
        doc.setFontSize(10)
      }
      y += 10

      // Sección I
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('I. ASISTENCIA CONTACTO ESENCIAL', 20, y)
      y += 8

      // Preparar datos para la tabla
      const headers: string[] = ['Niveles', 'Asisten. Promed', 'Registrados', 'Porcentaje']
      const body: any[] = []

      reporteData.niveles.forEach((nivel) => {
        body.push([
          nivel.nivel,
          nivel.asistenPromed.toString(),
          nivel.registrados.toString(),
          `${nivel.porcentaje.toFixed(2)}%`,
        ])
      })

      // Fila de totales
      body.push([
        'Total',
        reporteData.totalAsistenPromed.toString(),
        reporteData.totalRegistrados.toString(),
        `${reporteData.totalPorcentaje.toFixed(2)}%`,
      ])

      // Generar tabla con autoTable
      const tableOptions = {
        startY: y,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        styles: {
          cellPadding: 3,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 60 }, // Niveles
          1: { cellWidth: 40, halign: 'right' }, // Asisten. Promed
          2: { cellWidth: 40, halign: 'right' }, // Registrados
          3: { cellWidth: 40, halign: 'right' }, // Porcentaje
        },
        didParseCell: function (data: any) {
          // Resaltar fila de totales
          try {
            const cellText = (data.cell?.text?.toString() || data.cell?.text || '').toString().trim()
            if (cellText === 'Total') {
              data.cell.styles.fillColor = [230, 230, 230]
              data.cell.styles.fontStyle = 'bold'
              return
            }

            if (data.table && data.table.body) {
              const rowIndex = data.rowIndex
              if (rowIndex !== undefined && rowIndex >= 0) {
                const row = data.table.body[rowIndex]
                if (row) {
                  const cells = Array.isArray(row) ? row : (row.cells || Object.values(row))
                  if (Array.isArray(cells)) {
                    const hasTotal = cells.some((cell: any) => {
                      const text = (cell?.text?.toString() || cell?.text || cell?.toString() || '').toString().trim()
                      return text === 'Total'
                    })

                    if (hasTotal) {
                      data.cell.styles.fillColor = [230, 230, 230]
                      data.cell.styles.fontStyle = 'bold'
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Error en didParseCell:', e)
          }
        },
        margin: { top: y, left: 20, right: 20 },
      }

      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(tableOptions)
      } else if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions)
      } else {
        throw new Error('autoTable no está disponible. Verifica la instalación de jspdf-autotable.')
      }

      // Descargar
      const nombreArchivo = `Resumen_Mensual_${reporteData.ong.nombre}_${monthNames[reporteData.month]}_${reporteData.year}.pdf`
      doc.save(nombreArchivo)
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      alert('Error al exportar a PDF. Por favor, intenta nuevamente.')
    }
  }

  const exportarExcel = async () => {
    if (!reporteData) return

    try {
      const XLSX = await import('xlsx-js-style')
      const wb = XLSX.utils.book_new()

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]

      // Estilos comunes
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '4472C4' } }, // Azul
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      }

      const cellStyle = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { vertical: 'center' },
      }

      const totalStyle = {
        ...cellStyle,
        font: { bold: true },
        fill: { fgColor: { rgb: 'E7E6E6' } }, // Gris claro
      }

      // Helper para aplicar estilos a un rango
      const applyStyle = (ws: any, range: string, style: any) => {
        const cellRange = XLSX.utils.decode_range(range)
        for (let R = cellRange.s.r; R <= cellRange.e.r; ++R) {
          for (let C = cellRange.s.c; C <= cellRange.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ c: C, r: R })
            if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' }
            ws[cellAddress].s = style
          }
        }
      }

      // Datos del reporte
      const datos = [
        ['RESUMEN MENSUAL DE PROYECTO'],
        [],
        [`Proyecto: ${reporteData.ong.nombre}`],
        [`N° Proyecto: ${reporteData.ong.id.substring(0, 8).toUpperCase()}`],
        [`Mes: ${monthNames[reporteData.month]} ${reporteData.year}`],
        [`Facilitador: ${facilitadorNombre || ''}`],
        ...(responsable ? [[`Responsable: ${responsable.nombre} (${responsable.rol})`], [`Email: ${responsable.email}`]] : []),
        [],
        ['I. ASISTENCIA CONTACTO ESENCIAL'],
        [],
        ['Niveles', 'Asisten. Promed', 'Registrados', 'Porcentaje'],
        ...reporteData.niveles.map(nivel => [
          nivel.nivel,
          nivel.asistenPromed,
          nivel.registrados,
          `${nivel.porcentaje.toFixed(2)}%`,
        ]),
        [
          'Total',
          reporteData.totalAsistenPromed,
          reporteData.totalRegistrados,
          `${reporteData.totalPorcentaje.toFixed(2)}%`,
        ],
      ]

      // Calcular el índice del encabezado después de construir el array
      // Contamos las filas hasta llegar al encabezado 'Niveles'
      // 1: Título, 2: vacía, 3-6: info (5 filas), +2 si hay responsable, +2: vacía y sección, +1: vacía = 10 o 12
      const headerRowIndex = 10 + (responsable ? 2 : 0) // Índice de la fila de encabezado (0-based)

      const ws = XLSX.utils.aoa_to_sheet(datos)
      
      // Aplicar estilos
      // Título
      ws['A1'].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }
      // Subtítulo (I. ASISTENCIA CONTACTO ESENCIAL)
      const subtituloRowIndex = 8 + (responsable ? 2 : 0)
      const subtituloCell = XLSX.utils.encode_cell({ c: 0, r: subtituloRowIndex })
      if (ws[subtituloCell]) {
        ws[subtituloCell].s = { font: { bold: true, sz: 12 } }
      }
      
      // Encabezado de tabla
      const headerRange = XLSX.utils.encode_range({ s: { c: 0, r: headerRowIndex }, e: { c: 3, r: headerRowIndex } })
      applyStyle(ws, headerRange, headerStyle)
      
      // Celdas de datos
      const dataStartRow = headerRowIndex + 1
      const dataEndRow = headerRowIndex + reporteData.niveles.length
      if (reporteData.niveles.length > 0) {
        const dataRange = XLSX.utils.encode_range({ s: { c: 0, r: dataStartRow }, e: { c: 3, r: dataEndRow } })
        applyStyle(ws, dataRange, cellStyle)
      }
      
      // Fila de totales
      const totalRow = headerRowIndex + 1 + reporteData.niveles.length
      const totalRange = XLSX.utils.encode_range({ s: { c: 0, r: totalRow }, e: { c: 3, r: totalRow } })
      applyStyle(ws, totalRange, totalStyle)
      
      // Anchos de columna
      ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 15 }]
      
      XLSX.utils.book_append_sheet(wb, ws, 'Resumen Mensual')

      const nombreArchivo = `Resumen_Mensual_${reporteData.ong.nombre}_${monthNames[reporteData.month]}_${reporteData.year}.xlsx`
      XLSX.writeFile(wb, nombreArchivo)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Error al exportar a Excel. Por favor, intenta nuevamente.')
    }
  }

  if (!selectedONG && userONGs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            Cargando ONGs...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!roleLoading && !canViewReports) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes permisos para ver reportes. Solo los facilitadores y secretarios pueden acceder a esta funcionalidad.
          </p>
        </CardContent>
      </Card>
    )
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurar Reporte Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!ongIdProp && (
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
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Mes:</label>
              <Input
                type="month"
                value={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-')
                  setSelectedYear(parseInt(year))
                  setSelectedMonth(parseInt(month) - 1)
                }}
                className="w-full"
              />
            </div>
          </div>

          <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
            <div className="mt-4">
              <Button onClick={generarReporte} disabled={loading || !selectedONG}>
                {loading ? (
                  <>
                    <Calendar className="mr-2 h-4 w-4 animate-pulse" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </>
                )}
              </Button>
            </div>
          </RoleGuard>
        </CardContent>
      </Card>

      {reporteData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reporte Mensual Generado</CardTitle>
              <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
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
              </RoleGuard>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground mb-4">
                <p><strong>Proyecto:</strong> {reporteData.ong.nombre}</p>
                <p><strong>N° Proyecto:</strong> {reporteData.ong.id.substring(0, 8).toUpperCase()}</p>
                <p><strong>Mes:</strong> {monthNames[reporteData.month]} {reporteData.year}</p>
                <p><strong>Facilitador:</strong> {facilitadorNombre || ''}</p>
                {responsable && (
                  <>
                    <p><strong>Responsable:</strong> {responsable.nombre} ({responsable.rol})</p>
                    <p><strong>Email:</strong> {responsable.email}</p>
                  </>
                )}
              </div>

              {reporteData.diasIncompletos.length > 0 && (
                <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    ⚠️ Días con asistencia incompleta
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                    Los siguientes días no se completó la asistencia de todos los estudiantes. Estos días <strong>no se incluyen</strong> en los totales del reporte:
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                      {reporteData.diasIncompletos.map((dia, index) => {
                        // Parsear fecha como fecha local para evitar problemas de zona horaria
                        const [year, month, day] = dia.fecha.split('-').map(Number)
                        const fechaDate = new Date(year, month - 1, day)
                        const yearForUrl = fechaDate.getFullYear()
                        const monthForUrl = fechaDate.getMonth()
                        const asistenciasUrl = `/asistencias?aulaId=${dia.aulaId}&month=${monthForUrl}&year=${yearForUrl}`
                      
                      return (
                        <li key={`${dia.fecha}-${dia.nivel}-${index}`} className="flex items-center justify-between gap-3 p-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
                          <span className="flex-1">
                            • <strong>{dia.fechaFormateada}</strong> - Nivel: <strong>{dia.nivel}</strong> - Marcados: {dia.marcados}/{dia.total} estudiantes
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(asistenciasUrl)}
                            className="ml-auto text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
                          >
                            <Calendar className="h-4 w-4 mr-1.5" />
                            Corregir asistencia
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-4">I. ASISTENCIA CONTACTO ESENCIAL</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 p-2 bg-gray-100 dark:bg-gray-800 text-left">Niveles</th>
                        <th className="border border-gray-300 p-2 bg-gray-100 dark:bg-gray-800 text-right">Asisten. Promed</th>
                        <th className="border border-gray-300 p-2 bg-gray-100 dark:bg-gray-800 text-right">Registrados</th>
                        <th className="border border-gray-300 p-2 bg-gray-100 dark:bg-gray-800 text-right">Porcentaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporteData.niveles.map((nivel, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                          <td className="border border-gray-300 p-2">{nivel.nivel}</td>
                          <td className="border border-gray-300 p-2 text-right">{nivel.asistenPromed}</td>
                          <td className="border border-gray-300 p-2 text-right">{nivel.registrados}</td>
                          <td className="border border-gray-300 p-2 text-right">{nivel.porcentaje.toFixed(2)}%</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                        <td className="border border-gray-300 p-2">Total</td>
                        <td className="border border-gray-300 p-2 text-right">{reporteData.totalAsistenPromed}</td>
                        <td className="border border-gray-300 p-2 text-right">{reporteData.totalRegistrados}</td>
                        <td className="border border-gray-300 p-2 text-right">{reporteData.totalPorcentaje.toFixed(2)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

