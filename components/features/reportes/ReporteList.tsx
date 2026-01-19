'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart3, FileSpreadsheet, FileText, Calendar, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'

interface ReporteData {
  ong: {
    id: string
    razon_social: string
    numero_identificacion?: string
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
  // Para reporte general detallado
  reporteDetallado?: Array<{
    no: number
    persona: string
    codigo: string
    nivel: string
    tutor: string
    asistenciasPorFecha: { [fecha: string]: boolean } // true si asistió (presente)
  }>
  fechasUnicas?: string[] // Fechas únicas ordenadas para las columnas
  diasIncompletos?: Array<{
    fecha: string
    fechaFormateada: string
    nivel: string
    aulaId: string
    marcados: number
    total: number
  }>
}

interface DiaIncompleto {
  fecha: string
  fechaFormateada: string
  nivel: string
  aulaId: string
  marcados: number
  total: number
}

export function ReporteList() {
  const [loading, setLoading] = useState(false)
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string }>>([])
  const [reporteData, setReporteData] = useState<ReporteData | null>(null)
  const [responsable, setResponsable] = useState<{ nombre: string; email: string; rol: string } | null>(null)
  const router = useRouter()
  const { canViewReports, loading: roleLoading } = useUserRole(selectedFCP)

  useEffect(() => {
    loadUserFCPs()
    // Inicializar con el mes actual
    const now = new Date()
    setSelectedMonth(now.getMonth())
    setSelectedYear(now.getFullYear())
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    fin.setHours(23, 59, 59, 999)
    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(fin.toISOString().split('T')[0])
  }, [])

  // Actualizar fechas cuando cambia el mes/año
  useEffect(() => {
    const inicio = new Date(selectedYear, selectedMonth, 1)
    const fin = new Date(selectedYear, selectedMonth + 1, 0)
    fin.setHours(23, 59, 59, 999)
    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(fin.toISOString().split('T')[0])
  }, [selectedMonth, selectedYear])

  const loadUserFCPs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el usuario es facilitador en alguna ONG
      const { data: usuarioOngData, error: usuarioOngError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (usuarioOngError) throw usuarioOngError

      const isFacilitador = usuarioOngData && usuarioOngData.length > 0

      let ongs: Array<{ id: string; nombre: string }> = []

      if (isFacilitador) {
        // Facilitadores pueden ver todas las ONGs del sistema
        const { data: todasLasONGs, error: ongsError } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (ongsError) throw ongsError
        ongs = (todasLasONGs || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP',
        }))
      } else {
        // Usuarios no facilitadores solo ven sus ONGs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        ongs = data?.map((item: any) => ({
          id: item.fcp.id,
          nombre: item.fcp.razon_social || 'FCP',
        })) || []
      }

      setUserFCPs(ongs)
      if (ongs.length > 0 && !selectedFCP) {
        setSelectedFCP(ongs[0].id)
      }
    } catch (error) {
      console.error('Error loading ONGs:', error)
    }
  }

  const generarReporte = async () => {
    if (!selectedFCP) {
      alert('Por favor, selecciona una ONG')
      return
    }

    // Asegurar que las fechas estén configuradas según el mes seleccionado
    const inicio = new Date(selectedYear, selectedMonth, 1)
    const fin = new Date(selectedYear, selectedMonth + 1, 0)
    fin.setHours(23, 59, 59, 999)
    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(fin.toISOString().split('T')[0])

    try {
      setLoading(true)
      const supabase = createClient()

      // Obtener datos del usuario actual (responsable)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Obtener rol y datos del usuario en la ONG
        const { data: usuarioOngData, error: usuarioOngError } = await supabase
          .from('fcp_miembros')
          .select(`
            rol,
            usuario:usuarios(nombre_completo, email)
          `)
          .eq('usuario_id', user.id)
          .eq('fcp_id', selectedFCP)
          .eq('activo', true)
          .single()

        if (!usuarioOngError && usuarioOngData) {
          const usuario = usuarioOngData.usuario as any
          const rol = usuarioOngData.rol === 'facilitador' ? 'Facilitador' : usuarioOngData.rol === 'director' ? 'Director' : usuarioOngData.rol === 'secretario' ? 'Secretario' : ''
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
        .from('fcps')
        .select('id, razon_social')
        .eq('id', selectedFCP)
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
        .eq('fcp_id', selectedFCP)
        .eq('activo', true)

      if (estudiantesError) throw estudiantesError

      // Obtener asistencias en el rango de fechas
      const { data: asistenciasData, error: asistenciasError } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado, fecha')
        .eq('fcp_id', selectedFCP)
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

      // Construir reporte detallado para general
      let reporteDetallado: ReporteData['reporteDetallado'] | undefined = undefined
      let fechasUnicas: string[] | undefined = undefined
      const diasIncompletosGlobales: DiaIncompleto[] = []

      // Obtener fechas únicas ordenadas
        const fechasSet = new Set<string>()
        asistenciasData?.forEach((asist) => {
          fechasSet.add(asist.fecha)
        })
        fechasUnicas = Array.from(fechasSet).sort()

        // Detectar días incompletos por aula
        const aulasMap = new Map<string, { aulaId: string; aulaNombre: string; estudiantesIds: string[] }>()
        estudiantesData?.forEach(est => {
          const aulaId = est.aula_id
          const aulaNombre = (est.aula as any)?.nombre || 'Sin aula'
          if (!aulasMap.has(aulaId)) {
            aulasMap.set(aulaId, {
              aulaId,
              aulaNombre,
              estudiantesIds: [],
            })
          }
          aulasMap.get(aulaId)!.estudiantesIds.push(est.id)
        })

        // Por cada aula, verificar días incompletos
        aulasMap.forEach((aula, aulaId) => {
          const totalEstudiantes = aula.estudiantesIds.length
          const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

          // Agrupar asistencias por fecha para esta aula
          asistenciasData?.forEach(asist => {
            if (aula.estudiantesIds.includes(asist.estudiante_id)) {
              const fecha = asist.fecha
              if (!asistenciasPorFecha.has(fecha)) {
                asistenciasPorFecha.set(fecha, new Set())
              }
              asistenciasPorFecha.get(fecha)!.add(asist.estudiante_id)
            }
          })

          // Detectar días incompletos
          asistenciasPorFecha.forEach((estudiantesMarcados, fecha) => {
            const marcados = estudiantesMarcados.size
            // Si hay al menos uno marcado pero no todos, es un día incompleto
            if (marcados > 0 && marcados < totalEstudiantes) {
              // Parsear fecha como fecha local para evitar problemas de zona horaria
              const [year, month, day] = fecha.split('-').map(Number)
              const fechaDate = new Date(year, month - 1, day)
              // Verificar que la fecha esté en el rango seleccionado
              const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
              const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
              const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
              const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
              if (fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate) {
                diasIncompletosGlobales.push({
                  fecha,
                  fechaFormateada: fechaDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
                  nivel: aula.aulaNombre,
                  aulaId: aula.aulaId,
                  marcados,
                  total: totalEstudiantes,
                })
              }
            }
          })
        })

        // Obtener tutores asignados a cada aula
        const aulasIds = Array.from(new Set(estudiantesData?.map(e => e.aula_id) || []))
        const aulaTutorMap = new Map<string, string>() // aula_id -> tutor_nombre

        // Obtener todos los tutores asignados a aulas de una vez
        const { data: tutorAulasData } = await supabase
          .from('tutor_aula')
          .select(`
            aula_id,
            fcp_miembro_id,
            fcp_miembro:fcp_miembros(
              usuario_id,
              usuario:usuarios(nombre_completo, email)
            )
          `)
          .eq('fcp_id', selectedFCP)
          .eq('activo', true)
          .in('aula_id', aulasIds)

        // Mapear tutores a aulas
        tutorAulasData?.forEach((ta: any) => {
          const fcpMiembro = ta.fcp_miembro
          const usuario = fcpMiembro?.usuario
          const tutorNombre = usuario?.nombre_completo || usuario?.email || 'Sin tutor asignado'
          aulaTutorMap.set(ta.aula_id, tutorNombre)
        })

        // Para aulas sin tutor, asignar "Sin tutor asignado"
        aulasIds.forEach(aulaId => {
          if (!aulaTutorMap.has(aulaId)) {
            aulaTutorMap.set(aulaId, 'Sin tutor asignado')
          }
        })

        // Crear mapa de asistencias por estudiante y fecha
        const asistenciasMap = new Map<string, Map<string, boolean>>() // estudiante_id -> fecha -> presente

        asistenciasData?.forEach((asist) => {
          if (asist.estado === 'presente') {
            if (!asistenciasMap.has(asist.estudiante_id)) {
              asistenciasMap.set(asist.estudiante_id, new Map())
            }
            asistenciasMap.get(asist.estudiante_id)!.set(asist.fecha, true)
          }
        })

        // Construir reporte detallado
        const estudiantesOrdenados = Array.from(resumenPorEstudianteMap.values())
          .sort((a, b) => a.estudiante_nombre.localeCompare(b.estudiante_nombre))

        reporteDetallado = estudiantesOrdenados.map((est, index) => {
          const estudiante = estudiantesData?.find(e => e.id === est.estudiante_id)
          const aulaId = estudiante?.aula_id || ''
          const tutor = aulaTutorMap.get(aulaId) || 'Sin tutor asignado'
          const nivel = est.aula_nombre

          const asistenciasPorFecha: { [fecha: string]: boolean } = {}
          const asistMap = asistenciasMap.get(est.estudiante_id)
          fechasUnicas.forEach((fecha) => {
            asistenciasPorFecha[fecha] = asistMap?.get(fecha) === true
          })

          return {
            no: index + 1,
            persona: est.estudiante_nombre,
            codigo: est.estudiante_codigo,
            nivel,
            tutor,
            asistenciasPorFecha,
          }
        })

      const reporte: ReporteData = {
        ong: {
          id: ongData.id,
          razon_social: (ongData as any).razon_social || (ongData as any).numero_identificacion || 'FCP',
          numero_identificacion: (ongData as any).numero_identificacion,
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
        reporteDetallado,
        fechasUnicas,
        diasIncompletos: diasIncompletosGlobales.sort((a, b) => a.fecha.localeCompare(b.fecha)),
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
      // Si hay reporte detallado, usar el mismo formato que el PDF
      if (reporteData.reporteDetallado && reporteData.fechasUnicas) {
        const XLSX = await import('xlsx-js-style')

        // Crear workbook
        const wb = XLSX.utils.book_new()

        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]

        const year = selectedYear || new Date().getFullYear()
        const month = selectedMonth !== undefined ? selectedMonth : new Date().getMonth()

        // Estilos comunes
        const headerStyle = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          fill: { fgColor: { rgb: 'DCDCDC' } }, // Gris claro como en PDF
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

        // Preparar datos de la tabla
        const fechasUnicasArray = reporteData.fechasUnicas || []

        // Preparar encabezado (igual que PDF)
        const headerRowIndex = responsable ? 8 : 6 // Fila del encabezado de la tabla
        const encabezado = [
          ['Reporte General de Asistencia'],
          [],
          [`Proyecto: ${reporteData.ong.razon_social}`],
          [`Año: ${year}`],
          [`Mes: ${monthNames[month]} ${year}`],
          ...(responsable ? [[`Responsable: ${responsable.nombre} (${responsable.rol})`], [`Email: ${responsable.email}`]] : []),
          [],
          // Encabezados de la tabla
          [
            'No',
            'ESTUDIANTE',
            'Cod',
            'Niv',
            'TUTOR',
            ...fechasUnicasArray.map(f => {
              // Parsear fecha como fecha local para evitar problemas de zona horaria
              const [y, m, d] = f.split('-').map(Number)
              const date = new Date(y, m - 1, d)
              return date.getDate().toString()
            }),
          ],
        ]

        const rows: any[] = reporteData.reporteDetallado.map((row) => {
          const rowData: any[] = [
            row.no.toString(),
            row.persona,
            row.codigo,
            row.nivel,
            row.tutor,
          ]

          // Agregar asistencias por fecha
          fechasUnicasArray.forEach(fecha => {
            rowData.push(row.asistenciasPorFecha[fecha] ? '1' : '')
          })

          return rowData
        })

        const allData = [...encabezado, ...rows]
        const ws = XLSX.utils.aoa_to_sheet(allData)

        // Aplicar estilos
        // Título
        ws['A1'].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }

        // Encabezado de tabla
        const numCols = 5 + fechasUnicasArray.length // No, ESTUDIANTE, Cod, Niv, TUTOR + fechas
        const headerRange = XLSX.utils.encode_range({ s: { c: 0, r: headerRowIndex }, e: { c: numCols - 1, r: headerRowIndex } })
        applyStyle(ws, headerRange, headerStyle)

        // Celdas de datos
        if (rows.length > 0) {
          const dataStartRow = headerRowIndex + 1
          const dataEndRow = headerRowIndex + rows.length
          const dataRange = XLSX.utils.encode_range({ s: { c: 0, r: dataStartRow }, e: { c: numCols - 1, r: dataEndRow } })
          applyStyle(ws, dataRange, cellStyle)
          
          // Estilo para columnas numéricas (centrar)
          for (let R = dataStartRow; R <= dataEndRow; ++R) {
            // No
            const cellNo = XLSX.utils.encode_cell({ c: 0, r: R })
            if (ws[cellNo]) {
              ws[cellNo].s = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'center' } }
            }
            // Cod
            const cellCod = XLSX.utils.encode_cell({ c: 2, r: R })
            if (ws[cellCod]) {
              ws[cellCod].s = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'center' } }
            }
            // Niv
            const cellNiv = XLSX.utils.encode_cell({ c: 3, r: R })
            if (ws[cellNiv]) {
              ws[cellNiv].s = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'center' } }
            }
            // Fechas (centrar)
            fechasUnicasArray.forEach((_, idx) => {
              const cellFecha = XLSX.utils.encode_cell({ c: 5 + idx, r: R })
              if (ws[cellFecha]) {
                ws[cellFecha].s = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'center' } }
              }
            })
          }
        }

        // Anchos de columna (igual que PDF)
        const colWidths = [
          { wch: 8 }, // No
          { wch: 35 }, // ESTUDIANTE
          { wch: 10 }, // Cod
          { wch: 10 }, // Niv
          { wch: 30 }, // TUTOR
          ...fechasUnicasArray.map(() => ({ wch: 6 })), // Fechas
        ]
        ws['!cols'] = colWidths

        XLSX.utils.book_append_sheet(wb, ws, 'Reporte General')

        // Descargar
        const nombreArchivo = `Reporte_General_${reporteData.ong.razon_social}_${monthNames[month]}_${year}.xlsx`
        XLSX.writeFile(wb, nombreArchivo)
      } else {
        // Fallback: formato antiguo si no hay reporte detallado
        const XLSX = await import('xlsx-js-style')
        const wb = XLSX.utils.book_new()

        const resumenGeneral = [
          ['FCP:', reporteData.ong.razon_social],
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

        const nombreArchivo = `Reporte_General_${reporteData.ong.razon_social}_${reporteData.fechaInicio}_${reporteData.fechaFin}.xlsx`
        XLSX.writeFile(wb, nombreArchivo)
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Error al exportar a Excel. Por favor, intenta nuevamente.')
    }
  }

  const exportarPDF = async () => {
    if (!reporteData) return

    try {
      // Si hay reporte detallado (reporte general), usar formato como reporte por nivel
      if (reporteData.reporteDetallado && reporteData.fechasUnicas) {
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
        
        const doc = new jsPDF('landscape')
        const pageWidth = doc.internal.pageSize.getWidth()

        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]

        let y = 15

        // Título
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('Reporte General de Asistencia', pageWidth / 2, y, { align: 'center' })
        y += 8

      // Información general
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Proyecto: ${reporteData.ong.razon_social}`, 15, y)
      y += 5
      const year = selectedYear || new Date().getFullYear()
      const month = selectedMonth !== undefined ? selectedMonth : new Date().getMonth()
      doc.text(`Año: ${year}`, 15, y)
      y += 5
      doc.text(`Mes: ${monthNames[month]} ${year}`, 15, y)
      if (responsable) {
        y += 5
        doc.text(`Responsable: ${responsable.nombre} (${responsable.rol})`, 15, y)
        y += 3
        doc.setFontSize(9)
        doc.text(`Email: ${responsable.email}`, 15, y)
        doc.setFontSize(10)
      }
      y += 8

        // Preparar datos para la tabla
        const headers: string[] = [
          'No',
          'ESTUDIANTE',
          'Cod',
          'Niv',
          'TUTOR',
          ...reporteData.fechasUnicas.map(f => {
            const date = new Date(f)
            return date.getDate().toString()
          }),
        ]

        const body: any[] = []

        reporteData.reporteDetallado.forEach((row) => {
          const rowData: any[] = [
            row.no.toString(),
            row.persona,
            row.codigo,
            row.nivel,
            row.tutor,
          ]

          // Agregar asistencias por fecha
          if (reporteData.fechasUnicas) {
            reporteData.fechasUnicas.forEach(fecha => {
              rowData.push(row.asistenciasPorFecha[fecha] ? '1' : '')
            })
          }

          body.push(rowData)
        })

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
            fontSize: 7,
            cellPadding: 1.5,
          },
          bodyStyles: {
            fontSize: 6.5,
            textColor: [0, 0, 0],
            cellPadding: 1.5,
          },
          alternateRowStyles: {
            fillColor: [250, 250, 250],
          },
          styles: {
            cellPadding: 1.5,
            overflow: 'linebreak',
            fontSize: 6.5,
          },
          columnStyles: {
            0: { cellWidth: 10 }, // No - más corto
            1: { cellWidth: 'auto', minCellWidth: 35, overflow: 'linebreak' }, // ESTUDIANTE - más corto
            2: { cellWidth: 15, halign: 'center' }, // Cod
            3: { cellWidth: 15, halign: 'center' }, // Niv - más corto
            4: { cellWidth: 35, cellPadding: 1, overflow: 'linebreak' }, // TUTOR
            // Fechas: ancho más pequeño
            ...Object.fromEntries(
              reporteData.fechasUnicas.map((_, idx) => [5 + idx, { cellWidth: 8, halign: 'center' }])
            ),
          },
          tableWidth: 'wrap',
          margin: { top: y, left: 15, right: 15 },
        }

        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(tableOptions)
        } else if (typeof autoTable === 'function') {
          autoTable(doc, tableOptions)
        } else {
          throw new Error('autoTable no está disponible. Verifica la instalación de jspdf-autotable.')
        }

        // Descargar
        const nombreArchivo = `Reporte_General_${reporteData.ong.razon_social}_${monthNames[month]}_${year}.pdf`
        doc.save(nombreArchivo)
      } else {
        // Formato anterior para reportes sin detalle (no debería llegar aquí)
        const jsPDF = (await import('jspdf')).default
        const doc = new jsPDF()
        let y = 20

        doc.setFontSize(18)
        doc.text('Reporte de Asistencias', 105, y, { align: 'center' })
        y += 10

        doc.setFontSize(12)
        doc.text(`FCP: ${reporteData.ong.razon_social}`, 20, y)
        y += 6
        doc.text(`Fecha Inicio: ${reporteData.fechaInicio}`, 20, y)
        y += 6
        doc.text(`Fecha Fin: ${reporteData.fechaFin}`, 20, y)

        const nombreArchivo = `Reporte_General_${reporteData.ong.razon_social}_${reporteData.fechaInicio}_${reporteData.fechaFin}.pdf`
        doc.save(nombreArchivo)
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      alert('Error al exportar a PDF. Por favor, intenta nuevamente.')
    }
  }

  if (userFCPs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes FCPs asociadas. Primero crea o únete a una FCP.
          </p>
          <Button onClick={() => router.push('/ongs')}>
            Ir a FCPs
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Si el usuario no tiene permisos para ver reportes, mostrar mensaje
  if (!roleLoading && !canViewReports) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes permisos para ver reportes. Solo los facilitadores, directores y secretarios pueden acceder a esta funcionalidad.
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">FCP:</label>
              <select
                value={selectedFCP || ''}
                onChange={(e) => setSelectedFCP(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                {userFCPs.map((ong) => (
                  <option key={ong.id} value={ong.id}>
                    {ong.nombre}
                  </option>
                ))}
              </select>
            </div>

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

          <RoleGuard fcpId={selectedFCP} allowedRoles={['facilitador', 'director', 'secretario']}>
            <div className="mt-4">
              <Button onClick={generarReporte} disabled={loading || !selectedFCP}>
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
          </RoleGuard>
        </CardContent>
      </Card>

      {reporteData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reporte Generado</CardTitle>
              <RoleGuard fcpId={selectedFCP} allowedRoles={['facilitador', 'director', 'secretario']}>
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
            {reporteData.reporteDetallado && reporteData.fechasUnicas ? (
              // Reporte General Detallado
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  <p><strong>Proyecto:</strong> {reporteData.ong.razon_social}</p>
                  <p><strong>Año:</strong> {selectedYear}</p>
                  <p><strong>Mes:</strong> {new Date(selectedYear, selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                  {responsable && (
                    <>
                      <p><strong>Responsable:</strong> {responsable.nombre} ({responsable.rol})</p>
                      <p><strong>Email:</strong> {responsable.email}</p>
                    </>
                  )}
                </div>

                {reporteData.diasIncompletos && reporteData.diasIncompletos.length > 0 && (
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

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center w-12">No</th>
                          <th className="border border-gray-300 p-2 bg-blue-600 text-white text-left max-w-[150px]">ESTUDIANTE</th>
                          <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center w-16">Cod</th>
                          <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center w-16">Niv</th>
                          <th className="border border-gray-300 p-2 bg-blue-600 text-white text-left">TUTOR</th>
                          {reporteData.fechasUnicas?.map((fecha) => {
                            const date = new Date(fecha)
                            return (
                              <th
                                key={fecha}
                                className="border border-gray-300 p-2 bg-blue-600 text-white text-center min-w-[30px]"
                              >
                                {date.getDate()}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {reporteData.reporteDetallado.map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                            <td className="border border-gray-300 p-2 text-center w-12">{row.no}</td>
                            <td className="border border-gray-300 p-2 max-w-[150px] truncate" title={row.persona}>{row.persona}</td>
                            <td className="border border-gray-300 p-2 text-center font-mono w-16">{row.codigo}</td>
                            <td className="border border-gray-300 p-2 text-center w-16">{row.nivel}</td>
                            <td className="border border-gray-300 p-2">{row.tutor}</td>
                            {reporteData.fechasUnicas?.map((fecha) => (
                              <td
                                key={fecha}
                                className="border border-gray-300 p-2 text-center"
                              >
                                {row.asistenciasPorFecha[fecha] ? '1' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              // Reporte con resúmenes (formato anterior)
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

