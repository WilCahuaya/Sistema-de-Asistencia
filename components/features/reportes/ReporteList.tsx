'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MonthPicker } from '@/components/ui/month-picker'
import { BarChart3, FileSpreadsheet, FileText, Calendar, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import {
  getExcelHeaderStyle,
  getExcelCellStyle,
  getExcelAlternateRowStyle,
  getExcelTotalStyle,
  getPDFHeaderStyles,
  getPDFBodyStyles,
  getPDFAlternateRowStyles,
  getPDFTotalRowColor,
  getPDFCellTextColor,
} from '@/lib/utils/exportStyles'

interface ReporteData {
  fcp: {
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
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [reporteData, setReporteData] = useState<ReporteData | null>(null)
  const [responsable, setResponsable] = useState<{ nombre: string; email: string; rol: string } | null>(null)
  const router = useRouter()
  const { selectedRole } = useSelectedRole()
  const fcpIdParaReporte = selectedRole?.fcpId
  const { canViewReports, loading: roleLoading } = useUserRole(fcpIdParaReporte || null)

  useEffect(() => {
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


  const generarReporte = async () => {
    if (!fcpIdParaReporte) {
      alert('Por favor, asegúrate de tener un rol seleccionado')
      return
    }

    console.log('📊 [ReporteList] Generando reporte con:', {
      fcpIdParaReporte,
      selectedRoleFcpId: selectedRole?.fcpId,
      selectedRole: selectedRole?.role
    })

    // Asegurar que las fechas estén configuradas según el mes seleccionado
    const inicio = new Date(selectedYear, selectedMonth, 1)
    const fin = new Date(selectedYear, selectedMonth + 1, 0)
    fin.setHours(23, 59, 59, 999)
    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(fin.toISOString().split('T')[0])

    try {
      setLoading(true)
      const supabase = createClient()

      // Obtener datos del usuario actual (responsable) usando el rol seleccionado
      const { data: { user } } = await supabase.auth.getUser()
      if (user && selectedRole) {
        // Usar el rol seleccionado del contexto
        const rolSeleccionado = selectedRole.role
        
        // Obtener datos del usuario desde la tabla usuarios
        const { data: usuarioData, error: usuarioError } = await supabase
          .from('usuarios')
          .select('nombre_completo, email')
          .eq('id', user.id)
          .single()

        // Si no está en usuarios, obtener desde auth.users metadata
        let nombreCompleto = usuarioData?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || ''
        let emailUsuario = usuarioData?.email || user.email || ''

        // Mapear el rol a formato legible
        const rolFormateado = rolSeleccionado === 'facilitador' ? 'Facilitador' 
          : rolSeleccionado === 'director' ? 'Director' 
          : rolSeleccionado === 'secretario' ? 'Secretario' 
          : rolSeleccionado === 'tutor' ? 'Tutor' 
          : rolSeleccionado.charAt(0).toUpperCase() + rolSeleccionado.slice(1)

        console.log('👤 [ReporteList] Estableciendo responsable:', {
          rolSeleccionado,
          rolFormateado,
          nombreCompleto,
          emailUsuario,
          selectedRole
        })

        setResponsable({
          nombre: nombreCompleto || emailUsuario || 'Usuario',
          email: emailUsuario,
          rol: rolFormateado,
        })
      } else if (user && !selectedRole) {
        console.warn('⚠️ [ReporteList] No hay rol seleccionado, intentando obtener desde fcp_miembros')
        // Fallback: intentar obtener desde fcp_miembros si no hay rol seleccionado
        const { data: usuarioFcpData, error: usuarioFcpError } = await supabase
          .from('fcp_miembros')
          .select(`
            rol,
            usuario:usuarios(nombre_completo, email)
          `)
          .eq('usuario_id', user.id)
          .eq('fcp_id', fcpIdParaReporte)
          .eq('activo', true)
          .limit(1)

        if (!usuarioFcpError && usuarioFcpData && usuarioFcpData.length > 0) {
          const usuarioFcp = usuarioFcpData[0]
          const usuario = usuarioFcp.usuario as any
          const rol = usuarioFcp.rol === 'facilitador' ? 'Facilitador' 
            : usuarioFcp.rol === 'director' ? 'Director' 
            : usuarioFcp.rol === 'secretario' ? 'Secretario' 
            : usuarioFcp.rol === 'tutor' ? 'Tutor' 
            : ''
          if (rol) {
            setResponsable({
              nombre: usuario?.nombre_completo || usuario?.email || user.email || '',
              email: usuario?.email || user.email || '',
              rol,
            })
          }
        }
      }

      // Obtener datos de la FCP usando el fcpId del rol seleccionado
      const { data: fcpData, error: fcpError } = await supabase
        .from('fcps')
        .select('id, razon_social, numero_identificacion')
        .eq('id', fcpIdParaReporte)
        .single()

      if (fcpError) {
        console.error('❌ [ReporteList] Error obteniendo FCP:', fcpError)
        throw fcpError
      }

      // Obtener estudiantes activos de la FCP (incluyendo created_at para filtrar por fecha) usando el fcpId del rol seleccionado
      const { data: estudiantesData, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select(`
          id,
          codigo,
          nombre_completo,
          aula_id,
          created_at,
          aula:aulas(id, nombre)
        `)
        .eq('fcp_id', fcpIdParaReporte)
        .eq('activo', true)

      if (estudiantesError) {
        console.error('❌ [ReporteList] Error obteniendo estudiantes:', estudiantesError)
        throw estudiantesError
      }

      // Obtener asistencias en el rango de fechas usando el fcpId del rol seleccionado
      const { data: asistenciasData, error: asistenciasError } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado, fecha')
        .eq('fcp_id', fcpIdParaReporte)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)

      if (asistenciasError) {
        console.error('❌ [ReporteList] Error obteniendo asistencias:', asistenciasError)
        throw asistenciasError
      }

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

      // Crear un mapa para rastrear días completos únicos por estudiante
      const diasCompletosPorEstudiante = new Map<string, Set<string>>() // estudiante_id -> Set<fecha>

      // Primero, identificar días completos por aula
      const diasCompletosPorAula = new Map<string, Set<string>>() // aula_id -> Set<fecha>
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

      // Identificar días completos (días donde todos los estudiantes del aula están marcados)
      aulasMap.forEach((aula, aulaId) => {
        const totalEstudiantes = aula.estudiantesIds.length
        const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

        // Agrupar TODAS las asistencias por fecha para esta aula (sin filtrar por created_at aquí)
        // El filtrado por created_at se hará solo al verificar días completos
        asistenciasData?.forEach(asist => {
          if (aula.estudiantesIds.includes(asist.estudiante_id)) {
            const estudiante = estudiantesData?.find(e => e.id === asist.estudiante_id)
            if (!estudiante) return
            
            const fecha = asist.fecha
            
            // Contar TODAS las asistencias registradas (sin filtrar por created_at aquí)
            if (!asistenciasPorFecha.has(fecha)) {
              asistenciasPorFecha.set(fecha, new Set())
            }
            asistenciasPorFecha.get(fecha)!.add(asist.estudiante_id)
          }
        })
        
        if (aulaId === Array.from(aulasMap.keys())[0]) {
          console.log('📊 [ReporteList] Primera aula - asistenciasPorFecha:', {
            aula: aula.aulaNombre,
            totalFechas: asistenciasPorFecha.size,
            fechas: Array.from(asistenciasPorFecha.keys()).sort().slice(0, 10)
          })
        }

        // Identificar días completos (solo dentro del rango de fechas)
        asistenciasPorFecha.forEach((estudiantesMarcados, fecha) => {
          // Verificar que la fecha esté en el rango seleccionado
          const [year, month, day] = fecha.split('-').map(Number)
          const fechaDate = new Date(year, month - 1, day)
          const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
          const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
          const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
          const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
          const esDelRango = fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate
          
          // IMPORTANTE: Filtrar estudiantes que existían en esta fecha específica
          // Solo contar estudiantes que fueron creados ANTES o EN esta fecha
          const fechaDateObj = new Date(fecha + 'T23:59:59') // Fin del día
          const estudiantesActivosEnFecha = aula.estudiantesIds.filter(estId => {
            const estudiante = estudiantesData?.find(e => e.id === estId)
            if (!estudiante) return false
            // Si el estudiante tiene created_at, verificar que fue creado antes o en esta fecha
            if (estudiante.created_at) {
              const fechaCreacion = new Date(estudiante.created_at)
              return fechaCreacion <= fechaDateObj
            }
            // Si no tiene created_at, asumimos que existía (para compatibilidad con datos antiguos)
            return true
          })
          
          const totalEstudiantesEnFecha = estudiantesActivosEnFecha.length
          
          // Contar solo estudiantes que existían en esa fecha Y tienen asistencia registrada
          const estudiantesActivosIdsSet = new Set(estudiantesActivosEnFecha)
          const marcados = Array.from(estudiantesMarcados).filter(estId => 
            estudiantesActivosIdsSet.has(estId)
          ).length
          
          // Si todos los estudiantes que existían están marcados y está en el rango, es un día completo
          if (marcados === totalEstudiantesEnFecha && totalEstudiantesEnFecha > 0 && esDelRango) {
            console.log('✅ [ReporteList] Día completo detectado:', {
              fecha,
              aula: aula.aulaNombre,
              marcados,
              totalEstudiantesEnFecha
            })
            if (!diasCompletosPorAula.has(aulaId)) {
              diasCompletosPorAula.set(aulaId, new Set())
            }
            diasCompletosPorAula.get(aulaId)!.add(fecha)
          }
        })
      })

      // Procesar asistencias solo de días completos y dentro del rango
      asistenciasData?.forEach((asist) => {
        const estudiante = estudiantesData?.find(e => e.id === asist.estudiante_id)
        if (!estudiante) return

        const aulaId = estudiante.aula_id
        const fecha = asist.fecha
        
        // Verificar que la fecha esté en el rango seleccionado
        const [year, month, day] = fecha.split('-').map(Number)
        const fechaDate = new Date(year, month - 1, day)
        const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
        const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
        const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
        const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
        const esDelRango = fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate
        
        // Solo procesar si es un día completo para esta aula y está en el rango
        const diasCompletosAula = diasCompletosPorAula.get(aulaId)
        if (!esDelRango || !diasCompletosAula || !diasCompletosAula.has(fecha)) {
          return // Saltar días incompletos o fuera del rango
        }

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
          // Contar días completos únicos por estudiante
          if (!diasCompletosPorEstudiante.has(asist.estudiante_id)) {
            diasCompletosPorEstudiante.set(asist.estudiante_id, new Set())
          }
          const estudianteDiasCompletos = diasCompletosPorEstudiante.get(asist.estudiante_id)!
          if (!estudianteDiasCompletos.has(fecha)) {
            estudianteResumen.total_dias++
            estudianteDiasCompletos.add(fecha)
          }
          
          if (estado === 'presente') {
            estudianteResumen.presentes++
          } else if (estado === 'falto') {
            estudianteResumen.faltas++
          } else if (estado === 'permiso') {
            estudianteResumen.permisos++
          }
        }

        // Actualizar resumen por aula
        const aulaResumen = resumenPorAulaMap.get(aulaId)
        if (aulaResumen) {
          if (estado === 'presente') {
            aulaResumen.presentes++
          } else if (estado === 'falto') {
            aulaResumen.faltas++
          } else if (estado === 'permiso') {
            aulaResumen.permisos++
          }
        }
      })

      // Construir reporte detallado para general
      let reporteDetallado: ReporteData['reporteDetallado'] | undefined = undefined
      let fechasUnicas: string[] | undefined = undefined
      const diasIncompletosGlobales: DiaIncompleto[] = []

      // Obtener TODAS las fechas únicas donde hay asistencias registradas (no solo días completos)
        const fechasSet = new Set<string>()
        
        // Incluir TODAS las fechas con asistencias registradas dentro del rango
        asistenciasData?.forEach((asist) => {
          const fecha = asist.fecha
          // Verificar que la fecha esté en el rango seleccionado
          const [year, month, day] = fecha.split('-').map(Number)
          const fechaDate = new Date(year, month - 1, day)
          const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
          const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
          const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
          const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
          
          if (fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate) {
            fechasSet.add(fecha)
          }
        })
        
        console.log('📅 [ReporteList] Todas las fechas con asistencias:', {
          totalFechas: fechasSet.size,
          fechasEnSet: Array.from(fechasSet).sort()
        })
        
        // Ordenar fechas cronológicamente
        fechasUnicas = Array.from(fechasSet)
          .sort((a, b) => {
            const dateA = new Date(a)
            const dateB = new Date(b)
            return dateA.getTime() - dateB.getTime()
          })
        
        console.log('📅 [ReporteList] Fechas únicas finales (todas las fechas con asistencias):', {
          totalFechas: fechasUnicas.length,
          fechasUnicas: fechasUnicas
        })

        // Detectar días incompletos por aula (reutilizar aulasMap ya creado arriba)
        // Por cada aula, verificar días incompletos en TODAS las fechas del rango
        aulasMap.forEach((aula, aulaId) => {
          const totalEstudiantes = aula.estudiantesIds.length
          const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

          // Agrupar asistencias por fecha para esta aula
          asistenciasData?.forEach(asist => {
            if (aula.estudiantesIds.includes(asist.estudiante_id)) {
              const fecha = asist.fecha
              // Verificar que la fecha esté en el rango
              const [year, month, day] = fecha.split('-').map(Number)
              const fechaDate = new Date(year, month - 1, day)
              const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
              const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
              const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
              const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
              const esDelRango = fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate
              
              if (esDelRango) {
                if (!asistenciasPorFecha.has(fecha)) {
                  asistenciasPorFecha.set(fecha, new Set())
                }
                asistenciasPorFecha.get(fecha)!.add(asist.estudiante_id)
              }
            }
          })

          // Obtener todas las fechas únicas con asistencias registradas para esta aula
          const fechasConAsistencias = new Set<string>()
          asistenciasData?.forEach(asist => {
            if (aula.estudiantesIds.includes(asist.estudiante_id)) {
              const fecha = asist.fecha
              // Verificar que la fecha esté en el rango seleccionado
              const [year, month, day] = fecha.split('-').map(Number)
              const fechaDate = new Date(year, month - 1, day)
              const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
              const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
              const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
              const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
              
              if (fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate) {
                fechasConAsistencias.add(fecha)
              }
            }
          })
          
          console.log('')
          console.log('🔍 [ReporteList] Detección de días incompletos para aula:', {
            aula: aula.aulaNombre,
            totalEstudiantes: aula.estudiantesIds.length,
            fechasConAsistencias: Array.from(fechasConAsistencias).sort(),
            totalFechas: fechasConAsistencias.size,
            asistenciasPorFechaSize: asistenciasPorFecha.size
          })
          
          // Mostrar el contenido de asistenciasPorFecha para diagnóstico
          console.log('📋 [ReporteList] Contenido de asistenciasPorFecha:', {
            totalFechas: asistenciasPorFecha.size,
            fechas: Array.from(asistenciasPorFecha.keys()).sort(),
            detallePorFecha: Array.from(asistenciasPorFecha.entries()).map(([fecha, estudiantes]) => ({
              fecha,
              totalMarcados: estudiantes.size,
              estudiantesIds: Array.from(estudiantes).slice(0, 5).map(id => id.substring(0, 8))
            }))
          })

          // Detectar días incompletos solo en fechas donde hay asistencias registradas
          console.log('🔄 [ReporteList] Iniciando detección de días incompletos para aula:', aula.aulaNombre, {
            totalFechasConAsistencias: fechasConAsistencias.size,
            fechas: Array.from(fechasConAsistencias).sort()
          })
          
          fechasConAsistencias.forEach(fecha => {
            console.log(`\n📅 [ReporteList] Procesando fecha: ${fecha} para aula: ${aula.aulaNombre}`)
            const estudiantesMarcados = asistenciasPorFecha.get(fecha) || new Set<string>()
            console.log(`   📊 Estudiantes marcados en asistenciasPorFecha: ${estudiantesMarcados.size}`)
            
            // Para detectar días incompletos, usar TODOS los estudiantes del aula (como en la página de asistencias)
            // NO filtrar por created_at porque los estudiantes pueden haber sido agregados después
            // pero aún así deberían tener asistencia registrada para fechas anteriores
            const totalEstudiantesEnFecha = aula.estudiantesIds.length
            
            // Contar estudiantes marcados que pertenecen a esta aula
            const estudiantesAulaSet = new Set(aula.estudiantesIds)
            const marcados = Array.from(estudiantesMarcados).filter(estId => 
              estudiantesAulaSet.has(estId)
            ).length
            
            // Debug: Log para TODAS las fechas para diagnóstico
            const esIncompleto = totalEstudiantesEnFecha > 0 && marcados > 0 && marcados < totalEstudiantesEnFecha
            console.log('🔍 [ReporteList] Verificando fecha:', {
              fecha,
              aula: aula.aulaNombre,
              marcados,
              totalEstudiantesEnFecha,
              faltantes: totalEstudiantesEnFecha - marcados,
              estudiantesMarcadosSize: estudiantesMarcados.size,
              estudiantesAulaTotal: aula.estudiantesIds.length,
              estudiantesMarcadosIds: Array.from(estudiantesMarcados).slice(0, 5).map(id => id.substring(0, 8)),
              condicion1: totalEstudiantesEnFecha > 0,
              condicion2: marcados > 0,
              condicion3: marcados < totalEstudiantesEnFecha,
              condicionFinal: esIncompleto,
              esIncompleto: esIncompleto
            })
            
            // Si hay al menos uno marcado pero no todos los que deberían tener asistencia, es un día incompleto
            // Esta es la misma lógica que usa la página de asistencias: faltantes > 0 && total > 0 && marcados > 0
            if (totalEstudiantesEnFecha > 0 && marcados > 0 && marcados < totalEstudiantesEnFecha) {
              const faltantes = totalEstudiantesEnFecha - marcados
              const porcentajeCompleto = ((marcados / totalEstudiantesEnFecha) * 100).toFixed(1)
              
              console.log('')
              console.log('⚠️⚠️⚠️ DÍA INCOMPLETO DETECTADO ⚠️⚠️⚠️')
              console.log(`📅 Fecha: ${fecha}`)
              console.log(`🏫 Aula: ${aula.aulaNombre}`)
              console.log(`👥 Marcados: ${marcados} / ${totalEstudiantesEnFecha} estudiantes`)
              console.log(`❌ Faltantes: ${faltantes} estudiantes`)
              console.log(`📊 Porcentaje completo: ${porcentajeCompleto}%`)
              console.log('')
              
              console.log('📋 Detalle del día incompleto:', {
                fecha,
                aula: aula.aulaNombre,
                marcados,
                totalEstudiantesEnFecha,
                faltantes,
                porcentajeCompleto: porcentajeCompleto + '%',
                estudiantesAulaTotal: aula.estudiantesIds.length,
                estudiantesMarcadosSize: estudiantesMarcados.size
              })
              
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
                  total: totalEstudiantesEnFecha, // Usar el total de estudiantes activos en esa fecha
                })
              }
            }
          })
        })

        // Obtener tutores asignados a cada aula
        const aulasIds = Array.from(new Set(estudiantesData?.map(e => e.aula_id) || []))
        const aulaTutorMap = new Map<string, string>() // aula_id -> tutor_nombre

        // Obtener todos los tutores asignados a aulas de una vez usando el fcpId del rol seleccionado
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
          .eq('fcp_id', fcpIdParaReporte)
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

        // Crear mapa de asistencias por estudiante y fecha (TODAS las asistencias registradas)
        const asistenciasMap = new Map<string, Map<string, boolean>>() // estudiante_id -> fecha -> presente

        asistenciasData?.forEach((asist) => {
          const estudiante = estudiantesData?.find(e => e.id === asist.estudiante_id)
          if (!estudiante) return
          
          const fecha = asist.fecha
          
          // Verificar que la fecha esté en el rango seleccionado
          const [year, month, day] = fecha.split('-').map(Number)
          const fechaDate = new Date(year, month - 1, day)
          const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
          const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
          const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
          const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
          const esDelRango = fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate
          
          // Incluir TODAS las asistencias "presente" dentro del rango (no solo días completos)
          if (esDelRango && asist.estado === 'presente') {
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
        fcp: {
          id: fcpData.id,
          razon_social: (fcpData as any).razon_social || (fcpData as any).numero_identificacion || 'FCP',
          numero_identificacion: (fcpData as any).numero_identificacion,
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
      
      // Mostrar días incompletos de forma destacada en la consola
      console.log('')
      console.log('═══════════════════════════════════════════════════════════')
      console.log('📊📊📊 RESUMEN DE DÍAS INCOMPLETOS 📊📊📊')
      console.log('═══════════════════════════════════════════════════════════')
      console.log(`Total de días incompletos detectados: ${diasIncompletosGlobales.length}`)
      console.log('')
      
      if (diasIncompletosGlobales.length > 0) {
        console.log('⚠️⚠️⚠️ LISTA DE DÍAS INCOMPLETOS ⚠️⚠️⚠️')
        console.log('')
        diasIncompletosGlobales.forEach((dia, index) => {
          const faltantes = dia.total - dia.marcados
          const porcentajeCompleto = ((dia.marcados / dia.total) * 100).toFixed(1)
          console.log(`${index + 1}. ${dia.fechaFormateada} - ${dia.nivel}`)
          console.log(`   📅 Fecha: ${dia.fecha}`)
          console.log(`   👥 Marcados: ${dia.marcados} / ${dia.total} estudiantes`)
          console.log(`   ❌ Faltantes: ${faltantes} estudiantes`)
          console.log(`   📊 Porcentaje completo: ${porcentajeCompleto}%`)
          console.log('')
        })
      } else {
        console.log('✅ No se detectaron días incompletos')
        console.log('   (Todos los días tienen asistencia completa)')
        console.log('')
      }
      
      console.log('═══════════════════════════════════════════════════════════')
      console.log('')
      
      // También mostrar en formato objeto para depuración
      console.log('📋 [ReporteList] Detalle completo (objeto):', {
        total: diasIncompletosGlobales.length,
        diasIncompletos: diasIncompletosGlobales.map(d => ({
          fecha: d.fecha,
          fechaFormateada: d.fechaFormateada,
          nivel: d.nivel,
          aulaId: d.aulaId,
          marcados: d.marcados,
          total: d.total,
          faltantes: d.total - d.marcados,
          porcentajeCompleto: ((d.marcados / d.total) * 100).toFixed(1) + '%'
        }))
      })
      
      console.log('📊 [ReporteList] Objeto reporte antes de setReporteData:', {
        tieneDiasIncompletos: !!reporte.diasIncompletos,
        esArray: Array.isArray(reporte.diasIncompletos),
        longitud: reporte.diasIncompletos?.length || 0,
        diasIncompletos: reporte.diasIncompletos
      })

      setReporteData(reporte)
      
      // Verificar después de setReporteData
      setTimeout(() => {
        console.log('📊 [ReporteList] Estado después de setReporteData (en el siguiente render):', {
          reporteData: reporte
        })
      }, 100)
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
        // Estilos con colores del tema
        const headerStyle = getExcelHeaderStyle()
        const cellStyle = getExcelCellStyle()

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

        // Preparar encabezado (tres columnas)
        const headerRowIndex = 4 // Fila del encabezado de la tabla
        const encabezado = [
          ['Reporte General de Asistencia'],
          [],
          [`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, `AÑO: ${selectedYear}`, `MES: ${monthNames[selectedMonth].toUpperCase()}`],
          ...(responsable ? [[`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, `EMAIL: ${responsable.email.toUpperCase()}`, `ROL: ${responsable.rol.toUpperCase()}`]] : []),
          [],
          // Encabezados de la tabla
          [
            'No',
            'ESTUDIANTE',
            'Cod',
            'Niv',
            'TUTOR',
            ...fechasUnicasArray.map(f => {
              // Parsear fecha manualmente para evitar problemas de zona horaria
              const [year, month, day] = f.split('-').map(Number)
              return day.toString()
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
        const nombreArchivo = `Reporte_General_${reporteData.fcp.razon_social}_${monthNames[month]}_${year}.xlsx`
        XLSX.writeFile(wb, nombreArchivo)
      } else {
        // Fallback: formato antiguo si no hay reporte detallado
        const XLSX = await import('xlsx-js-style')
        const wb = XLSX.utils.book_new()

        const year = new Date(reporteData.fechaInicio).getFullYear()
        const month = new Date(reporteData.fechaInicio).getMonth()
        const monthNames = [
          'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
          'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
        ]
        const resumenGeneral = [
          [`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`],
          [`AÑO: ${year}`],
          [`MES: ${monthNames[month]}`],
          ...(responsable ? [[`RESPONSABLE: ${responsable.nombre.toUpperCase()} (${responsable.rol.toUpperCase()})`], [`EMAIL: ${responsable.email.toUpperCase()}`]] : []),
          [''],
          ['Total Estudiantes:', reporteData.totalEstudiantes],
          ['Total Presentes:', reporteData.totalPresentes],
          ['Total Faltas:', reporteData.totalFaltas],
          ['Total Permisos:', reporteData.totalPermisos],
        ]
        const ws1 = XLSX.utils.aoa_to_sheet(resumenGeneral)
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen General')

        const nombreArchivo = `Reporte_General_${reporteData.fcp.razon_social}_${reporteData.fechaInicio}_${reporteData.fechaFin}.xlsx`
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

      // Información general (tres columnas)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const col1 = 15
      const col2 = pageWidth / 3 + 10
      const col3 = (pageWidth / 3) * 2 + 10
      
      doc.text(`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, col1, y)
      doc.text(`AÑO: ${selectedYear}`, col2, y)
      doc.text(`MES: ${monthNames[selectedMonth].toUpperCase()}`, col3, y)
      y += 6
      if (responsable) {
        doc.text(`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, col1, y)
        doc.text(`EMAIL: ${responsable.email.toUpperCase()}`, col2, y)
        doc.text(`ROL: ${responsable.rol.toUpperCase()}`, col3, y)
        y += 6
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
            // Parsear fecha manualmente para evitar problemas de zona horaria
            const [year, month, day] = f.split('-').map(Number)
            return day.toString()
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
            ...getPDFHeaderStyles(),
            fontSize: 7,
            cellPadding: 1.5,
          },
          bodyStyles: {
            ...getPDFBodyStyles(),
            fontSize: 6.5,
            cellPadding: 1.5,
          },
          alternateRowStyles: getPDFAlternateRowStyles(),
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
        const nombreArchivo = `Reporte_General_PE0530_RESCATANDO_VALORES_ENERO_2026.pdf`
        doc.save(nombreArchivo)
      } else {
        // Formato anterior para reportes sin detalle (no debería llegar aquí)
        const jsPDF = (await import('jspdf')).default
        const doc = new jsPDF()
        let y = 20

        doc.setFontSize(18)
        doc.text('Reporte de Asistencias', 105, y, { align: 'center' })
        y += 10

        // Información del proyecto (tres columnas)
        doc.setFontSize(12)
        const pageWidth = doc.internal.pageSize.getWidth()
        const col1 = 20
        const col2 = pageWidth / 3 + 10
        const col3 = (pageWidth / 3) * 2 + 10
        
        const year = new Date(reporteData.fechaInicio).getFullYear()
        const month = new Date(reporteData.fechaInicio).getMonth()
        doc.text(`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, col1, y)
        doc.text(`AÑO: ${year}`, col2, y)
        doc.text(`MES: ${monthNames[month].toUpperCase()}`, col3, y)
        y += 6
        if (responsable) {
          doc.text(`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, col1, y)
          doc.text(`EMAIL: ${responsable.email.toUpperCase()}`, col2, y)
          doc.text(`ROL: ${responsable.rol.toUpperCase()}`, col3, y)
          y += 6
        }

        const nombreArchivo = `Reporte_General_${reporteData.fcp.razon_social}_${reporteData.fechaInicio}_${reporteData.fechaFin}.pdf`
        doc.save(nombreArchivo)
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      alert('Error al exportar a PDF. Por favor, intenta nuevamente.')
    }
  }

  if (!fcpIdParaReporte) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes un rol seleccionado. Por favor, selecciona un rol para continuar.
          </p>
          <Button onClick={() => router.push('/seleccionar-rol')}>
            Seleccionar Rol
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
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Mes:</label>
              <MonthPicker
                value={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
                onChange={(value) => {
                  const [year, month] = value.split('-')
                  setSelectedYear(parseInt(year))
                  setSelectedMonth(parseInt(month) - 1)
                }}
                className="w-full"
              />
            </div>
          </div>

          <RoleGuard fcpId={fcpIdParaReporte || undefined} allowedRoles={['facilitador', 'director', 'secretario']}>
            <div className="mt-4">
              <Button onClick={generarReporte} disabled={loading || !fcpIdParaReporte}>
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
              {!fcpIdParaReporte && (
                <p className="text-sm text-muted-foreground mt-2">
                  Por favor, asegúrate de tener un rol seleccionado.
                </p>
              )}
            </div>
          </RoleGuard>
        </CardContent>
      </Card>

      {reporteData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reporte Generado</CardTitle>
              <RoleGuard fcpId={fcpIdParaReporte || undefined} allowedRoles={['facilitador', 'director', 'secretario']}>
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
                <div className="text-sm text-muted-foreground mb-4 grid grid-cols-3 gap-x-8 gap-y-2">
                  <p><strong>PROYECTO:</strong> {reporteData.fcp.numero_identificacion || ''} {reporteData.fcp.razon_social}</p>
                  <p><strong>AÑO:</strong> {selectedYear}</p>
                  <p><strong>MES:</strong> {new Date(selectedYear, selectedMonth).toLocaleDateString('es-ES', { month: 'long' }).toUpperCase()}</p>
                  {responsable && (
                    <>
                      <p><strong>RESPONSABLE:</strong> {responsable.nombre.toUpperCase()}</p>
                      <p><strong>EMAIL:</strong> {responsable.email.toUpperCase()}</p>
                      <p><strong>ROL:</strong> {responsable.rol.toUpperCase()}</p>
                    </>
                  )}
                </div>

                {(() => {
                  const diasIncompletos = reporteData.diasIncompletos
                  const tieneDiasIncompletos = diasIncompletos && Array.isArray(diasIncompletos) && diasIncompletos.length > 0
                  
                  console.log('🔍 [ReporteList] Renderizado - Verificando días incompletos:', {
                    tieneDiasIncompletos: !!diasIncompletos,
                    esArray: Array.isArray(diasIncompletos),
                    longitud: diasIncompletos?.length || 0,
                    diasIncompletos: diasIncompletos,
                    condicion: tieneDiasIncompletos
                  })
                  
                  if (!tieneDiasIncompletos) {
                    return null
                  }
                  
                  return (
                  <div className="mb-4 rounded-md bg-warning/20 border border-warning/50 p-4">
                    <h4 className="font-semibold text-warning-foreground mb-2">
                      ⚠️ Días con asistencia incompleta
                    </h4>
                    <p className="text-sm text-warning-foreground mb-2">
                      Los siguientes días no se completó la asistencia de todos los estudiantes. Estos días <strong>no se incluyen</strong> en los totales del reporte:
                    </p>
                    <ul className="text-sm text-warning-foreground space-y-2">
                      {reporteData.diasIncompletos.map((dia, index) => {
                        // Parsear fecha como fecha local para evitar problemas de zona horaria
                        const [year, month, day] = dia.fecha.split('-').map(Number)
                        const fechaDate = new Date(year, month - 1, day)
                        const yearForUrl = fechaDate.getFullYear()
                        const monthForUrl = fechaDate.getMonth()
                        const asistenciasUrl = `/asistencias?aulaId=${dia.aulaId}&month=${monthForUrl}&year=${yearForUrl}`
                        
                        return (
                          <li key={`${dia.fecha}-${dia.nivel}-${index}`} className="flex items-center justify-between gap-3 p-2 rounded-md bg-warning/30 border border-warning/60">
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
                  )
                })()}

                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border border-border p-2 bg-muted/50 text-center w-12 text-foreground">No</th>
                          <th className="border border-border p-2 bg-muted/50 text-left max-w-[150px] text-foreground">ESTUDIANTE</th>
                          <th className="border border-border p-2 bg-muted/50 text-center w-16 text-foreground">Cod</th>
                          <th className="border border-border p-2 bg-muted/50 text-center w-16 text-foreground">Niv</th>
                          <th className="border border-border p-2 bg-muted/50 text-left text-foreground">TUTOR</th>
                          {reporteData.fechasUnicas?.map((fecha) => {
                            // Parsear fecha manualmente para evitar problemas de zona horaria
                            const [year, month, day] = fecha.split('-').map(Number)
                            return (
                              <th
                                key={fecha}
                                className="border border-border p-2 bg-muted/50 text-center min-w-[30px] text-foreground"
                              >
                                {day}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {reporteData.reporteDetallado.map((row, index) => (
                          <tr key={index} className={`border-b border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent/50`}>
                            <td className="border border-border p-2 text-center w-12 text-foreground">{row.no}</td>
                            <td className="border border-border p-2 max-w-[150px] truncate text-foreground" title={row.persona}>{row.persona}</td>
                            <td className="border border-border p-2 text-center font-mono w-16 text-foreground">{row.codigo}</td>
                            <td className="border border-border p-2 text-center w-16 text-foreground">{row.nivel}</td>
                            <td className="border border-border p-2 text-foreground">{row.tutor}</td>
                            {reporteData.fechasUnicas?.map((fecha) => (
                              <td
                                key={fecha}
                                className="border border-border p-2 text-center text-foreground"
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
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-foreground">Código</th>
                            <th className="px-4 py-2 text-left text-foreground">Nombre</th>
                            <th className="px-4 py-2 text-left text-foreground">Aula</th>
                            <th className="px-4 py-2 text-center text-foreground">Presentes</th>
                            <th className="px-4 py-2 text-center text-foreground">Faltas</th>
                            <th className="px-4 py-2 text-center text-foreground">Permisos</th>
                            <th className="px-4 py-2 text-center text-foreground">Total Días</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reporteData.resumenPorEstudiante.map((est, index) => (
                            <tr key={est.estudiante_id} className={`border-b border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent/50`}>
                              <td className="px-4 py-2 font-mono text-foreground">{est.estudiante_codigo}</td>
                              <td className="px-4 py-2 text-foreground">{est.estudiante_nombre}</td>
                              <td className="px-4 py-2 text-foreground">{est.aula_nombre}</td>
                              <td className="px-4 py-2 text-center text-green-600 dark:text-green-400">{est.presentes}</td>
                              <td className="px-4 py-2 text-center text-red-600 dark:text-red-400">{est.faltas}</td>
                              <td className="px-4 py-2 text-center text-yellow-600 dark:text-yellow-400">{est.permisos}</td>
                              <td className="px-4 py-2 text-center text-foreground">{est.total_dias}</td>
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

