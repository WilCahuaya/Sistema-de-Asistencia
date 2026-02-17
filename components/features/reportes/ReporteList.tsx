'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonthPicker } from '@/components/ui/month-picker'
import { BarChart3, FileSpreadsheet, FileText, Calendar, Download, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { toast } from '@/lib/toast'
import { toLocalDateString } from '@/lib/utils/dateUtils'
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
import {
  getAvailableTableWidth,
  getFontSizeForColumns,
  getProportionalColumnStyles,
  type PDFTableColumnConfig,
} from '@/lib/utils/pdfTableUtils'

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
    asistenciasPorFecha: { [fecha: string]: 'presente' | 'falto' | 'permiso' | undefined } // estado por día
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
  const [esFacilitador, setEsFacilitador] = useState<boolean>(false)
  const [fcpIdParaFacilitador, setFcpIdParaFacilitador] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string }>>([])
  const router = useRouter()
  const { selectedRole } = useSelectedRole()
  const fcpIdParaReporte = selectedRole?.fcpId
  // Determinar el fcpId a usar: el seleccionado o el del facilitador (se actualizará después del useEffect)
  const [fcpIdFinal, setFcpIdFinal] = useState<string | null>(fcpIdParaReporte || null)
  const { canViewReports, loading: roleLoading, isFacilitador: isFacilitadorFromHook } = useUserRole(fcpIdFinal)

  // Scroll horizontal: Shift+scroll o click sostenido (igual que en Asistencias)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Resize horizontal de la tabla (igual que en Asistencias y Estudiantes)
  const cardRef = useRef<HTMLDivElement>(null)
  const defaultWidthRef = useRef<number | null>(null)
  const [tableWidth, setTableWidth] = useState<number | null>(null)
  const [isResizingTable, setIsResizingTable] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSearch, setMobileSearch] = useState('')
  const [mobilePage, setMobilePage] = useState(1)
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)

  // Efecto para obtener el ancho por defecto del contenedor
  useEffect(() => {
    const updateDefaultWidth = () => {
      const container = document.querySelector('div.mx-auto.max-w-7xl') || document.querySelector('div.mb-8.mx-auto.max-w-7xl')
      if (container) {
        const rect = (container as HTMLElement).getBoundingClientRect()
        if (defaultWidthRef.current === null || defaultWidthRef.current !== rect.width) {
          defaultWidthRef.current = rect.width
          if (!tableWidth) setTableWidth(null)
        }
      } else {
        const fallbackWidth = Math.min(1280, window.innerWidth - 64)
        if (defaultWidthRef.current === null || defaultWidthRef.current !== fallbackWidth) {
          defaultWidthRef.current = fallbackWidth
          if (!tableWidth) setTableWidth(null)
        }
      }
    }
    updateDefaultWidth()
    const timer = setTimeout(updateDefaultWidth, 50)
    window.addEventListener('resize', updateDefaultWidth)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateDefaultWidth)
    }
  }, [tableWidth])

  // Efecto para manejar el resize de la tabla
  useEffect(() => {
    if (!isResizingTable) return
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      if (cardRef.current) {
        const diff = e.pageX - resizeStartX
        const newWidth = Math.max(800, Math.min(window.innerWidth * 2, resizeStartWidth + diff))
        setTableWidth(newWidth)
      }
    }
    const handleMouseUp = () => setIsResizingTable(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingTable, resizeStartX, resizeStartWidth])

  // Listener nativo con passive: false para poder llamar preventDefault en Shift+scroll
  useEffect(() => {
    const el = tableContainerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [reporteData?.reporteDetallado])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setMobilePage(1)
    setMobileSearch('')
    setExpandedCardId(null)
  }, [reporteData])

  // Verificar si el usuario es facilitador y obtener su primera FCP si no hay fcpId seleccionado
  useEffect(() => {
    const verificarFacilitador = async () => {
      if (fcpIdParaReporte) {
        setEsFacilitador(false)
        setUserFCPs([])
        setFcpIdParaFacilitador(null)
        setFcpIdFinal(fcpIdParaReporte)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setEsFacilitador(false)
        setUserFCPs([])
        setFcpIdParaFacilitador(null)
        setFcpIdFinal(null)
        return
      }

      // Facilitador: tabla facilitadores. FCPs vía fcps.facilitador_id.
      const { data: facRow } = await supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle()
      const esFac = !!facRow

      if ((selectedRole?.role === 'facilitador' || esFac) && !fcpIdParaReporte) {
        if (esFac) {
          const { data: fcpsData } = await supabase
            .from('fcps')
            .select('id, razon_social, numero_identificacion')
            .eq('facilitador_id', user.id)
            .eq('activa', true)
            .order('razon_social', { ascending: true })
          const fcps = (fcpsData || []).map((f: any) => ({
            id: f.id,
            nombre: f.razon_social || f.numero_identificacion || 'FCP',
            numero_identificacion: f.numero_identificacion,
          }))
          setUserFCPs(fcps)
          setEsFacilitador(true)
          if (fcps.length > 0) {
            setFcpIdParaFacilitador(fcps[0].id)
            setFcpIdFinal(fcps[0].id)
          } else {
            setFcpIdParaFacilitador(null)
            setFcpIdFinal(null)
          }
        } else {
          setEsFacilitador(false)
          setUserFCPs([])
          setFcpIdParaFacilitador(null)
          setFcpIdFinal(null)
        }
      } else {
        setEsFacilitador(false)
        setUserFCPs([])
        setFcpIdParaFacilitador(null)
        setFcpIdFinal(null)
      }
    }

    verificarFacilitador()
  }, [fcpIdParaReporte])

  useEffect(() => {
    // Inicializar con el mes actual
    const now = new Date()
    setSelectedMonth(now.getMonth())
    setSelectedYear(now.getFullYear())
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setFechaInicio(toLocalDateString(inicio))
    setFechaFin(toLocalDateString(fin))
  }, [])

  // Actualizar fechas cuando cambia el mes/año (usar fecha local para evitar UTC y mostrar datos del mes siguiente)
  useEffect(() => {
    const inicio = new Date(selectedYear, selectedMonth, 1)
    const fin = new Date(selectedYear, selectedMonth + 1, 0)
    setFechaInicio(toLocalDateString(inicio))
    setFechaFin(toLocalDateString(fin))
  }, [selectedMonth, selectedYear])


  const generarReporte = async () => {
    const fcpIdAUsar = fcpIdFinal ?? fcpIdParaReporte ?? fcpIdParaFacilitador
    
    if (!fcpIdAUsar) {
      toast.warning('Selecciona FCP o rol', 'Asegúrate de tener un rol seleccionado o selecciona una FCP.')
      return
    }

    console.log('📊 [ReporteList] Generando reporte con:', {
      fcpIdFinal,
      fcpIdParaReporte,
      fcpIdParaFacilitador,
      fcpIdAUsar,
      selectedRoleFcpId: selectedRole?.fcpId,
      selectedRole: selectedRole?.role,
      esFacilitador
    })

    // Asegurar que las fechas estén configuradas según el mes seleccionado (fecha local, no UTC)
    const inicio = new Date(selectedYear, selectedMonth, 1)
    const fin = new Date(selectedYear, selectedMonth + 1, 0)
    const fechaInicioStr = toLocalDateString(inicio)
    const fechaFinStr = toLocalDateString(fin)
    setFechaInicio(fechaInicioStr)
    setFechaFin(fechaFinStr)

    console.log('📅 [ReporteList] Generando reporte para:', {
      selectedYear,
      selectedMonth,
      mesNombre: new Date(selectedYear, selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      esMesAnterior: inicio < new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    })

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
          .eq('fcp_id', fcpIdAUsar)
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

      // Obtener datos de la FCP usando el fcpId (del rol seleccionado o del facilitador)
      const { data: fcpData, error: fcpError } = await supabase
        .from('fcps')
        .select('id, razon_social, numero_identificacion')
        .eq('id', fcpIdAUsar)
        .single()

      if (fcpError) {
        console.error('❌ [ReporteList] Error obteniendo FCP:', fcpError)
        throw fcpError
      }

      // Determinar si estamos consultando un mes anterior
      const fechaActual = new Date()
      const mesActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      const mesConsultado = new Date(selectedYear, selectedMonth, 1)
      const esMesAnterior = mesConsultado < mesActual

      console.log('📅 [ReporteList] Mes consultado:', {
        mesConsultado: `${selectedYear}-${selectedMonth + 1}`,
        mesActual: `${fechaActual.getFullYear()}-${fechaActual.getMonth() + 1}`,
        esMesAnterior
      })

      // Obtener asistencias en el rango de fechas usando el fcpId
      // IMPORTANTE: Incluir aula_id de la asistencia para preservar el aula histórica
      // IMPORTANTE: Usar fechaInicioStr y fechaFinStr que se calcularon del mes seleccionado
      const { data: asistenciasData, error: asistenciasError } = await supabase
        .from('asistencias')
        .select(`
          estudiante_id, 
          estado, 
          fecha,
          aula_id,
          aula:aulas(id, nombre),
          estudiante:estudiantes(id, codigo, nombre_completo, aula_id, created_at)
        `)
        .eq('fcp_id', fcpIdAUsar)
        .gte('fecha', fechaInicioStr)
        .lte('fecha', fechaFinStr)

      if (asistenciasError) {
        console.error('❌ [ReporteList] Error obteniendo asistencias:', asistenciasError)
        throw asistenciasError
      }

      // Obtener estudiantes activos de la FCP
      // IMPORTANTE: Para meses anteriores, cargar estudiantes basándose en las asistencias del mes
      // Para meses actuales/futuros, cargar estudiantes basándose en su aula_id actual
      let estudiantesData: any[] = []

      if (esMesAnterior) {
        // Para meses anteriores, obtener estudiantes únicos de las asistencias
        // Esto asegura que solo incluyamos estudiantes que realmente estaban en esa aula en ese mes
        const estudiantesMap = new Map<string, any>()
        asistenciasData?.forEach((asist: any) => {
          if (asist.estudiante && !estudiantesMap.has(asist.estudiante_id)) {
            estudiantesMap.set(asist.estudiante_id, {
              id: asist.estudiante.id,
              codigo: asist.estudiante.codigo,
              nombre_completo: asist.estudiante.nombre_completo,
              aula_id: asist.aula_id, // Usar aula_id de la asistencia (histórica)
              created_at: asist.estudiante.created_at,
              aula: asist.aula // Usar aula de la asistencia (histórica)
            })
          }
        })
        estudiantesData = Array.from(estudiantesMap.values())
        
        console.log('📊 [ReporteList] Estudiantes cargados de mes anterior (basados en asistencias):', {
          total: estudiantesData.length,
          muestra: estudiantesData.slice(0, 3).map(e => ({ nombre: e.nombre_completo, aula: e.aula?.nombre }))
        })
      } else {
        // Para meses actuales/futuros, cargar todos los estudiantes activos de la FCP
        const { data: estudiantesDataQuery, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select(`
            id,
            codigo,
            nombre_completo,
            aula_id,
            created_at,
            aula:aulas(id, nombre)
          `)
          .eq('fcp_id', fcpIdAUsar)
          .eq('activo', true)

        if (estudiantesError) {
          console.error('❌ [ReporteList] Error obteniendo estudiantes:', estudiantesError)
          throw estudiantesError
        }

        estudiantesData = estudiantesDataQuery || []
        
        console.log('📊 [ReporteList] Estudiantes cargados (mes actual/futuro):', {
          total: estudiantesData.length
        })
      }

      console.log('📊 [ReporteList] Asistencias obtenidas:', {
        total: asistenciasData?.length || 0,
        fechaInicio: fechaInicioStr,
        fechaFin: fechaFinStr,
        fechasUnicas: [...new Set(asistenciasData?.map((a: any) => a.fecha) || [])].sort(),
        estudiantesUnicos: [...new Set(asistenciasData?.map((a: any) => a.estudiante_id) || [])].length,
        aulasUnicas: [...new Set(asistenciasData?.map((a: any) => a.aula_id).filter((id: string) => id) || [])].length,
        estudiantesCargados: estudiantesData.length
      })

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

      // Inicializar mapas con aulas encontradas en las asistencias (usar aula_id de la asistencia)
      // Primero, identificar todas las aulas únicas de las asistencias
      const aulasEnAsistencias = new Map<string, { id: string; nombre: string }>()
      asistenciasData?.forEach((asist: any) => {
        if (asist.aula_id && asist.aula) {
          if (!aulasEnAsistencias.has(asist.aula_id)) {
            aulasEnAsistencias.set(asist.aula_id, {
              id: asist.aula_id,
              nombre: asist.aula.nombre || 'Sin aula'
            })
          }
        }
      })

      // Inicializar resumen por aula usando aulas de las asistencias
      aulasEnAsistencias.forEach((aula, aulaId) => {
        resumenPorAulaMap.set(aulaId, {
          aula_id: aulaId,
          aula_nombre: aula.nombre,
          total_estudiantes: 0,
          presentes: 0,
          faltas: 0,
          permisos: 0,
        })
      })

      // Inicializar resumen por estudiante usando el aula_id de sus asistencias
      // Agrupar estudiantes por aula según sus asistencias
      const estudiantesPorAula = new Map<string, Set<string>>() // aula_id -> Set<estudiante_id>
      asistenciasData?.forEach((asist: any) => {
        if (asist.aula_id && asist.estudiante_id) {
          if (!estudiantesPorAula.has(asist.aula_id)) {
            estudiantesPorAula.set(asist.aula_id, new Set())
          }
          estudiantesPorAula.get(asist.aula_id)!.add(asist.estudiante_id)
        }
      })

      // Actualizar total_estudiantes por aula
      estudiantesPorAula.forEach((estudiantesIds, aulaId) => {
        const aulaResumen = resumenPorAulaMap.get(aulaId)
        if (aulaResumen) {
          aulaResumen.total_estudiantes = estudiantesIds.size
        }
      })

      // Inicializar resumen por estudiante usando el aula_id de sus asistencias del mes consultado
      // IMPORTANTE: Solo incluir estudiantes que tienen asistencias en el mes consultado
      // El reporte debe mostrar solo los estudiantes que asistieron en ese mes específico
      const estudiantesConAsistencias = new Set<string>()
      asistenciasData?.forEach((asist: any) => {
        if (asist.estudiante_id) {
          estudiantesConAsistencias.add(asist.estudiante_id)
        }
      })

      estudiantesConAsistencias.forEach((estudianteId) => {
        const est = estudiantesData?.find(e => e.id === estudianteId)
        if (!est) return

        // Obtener el aula del estudiante según el mes consultado
        let aulaNombre = 'Sin aula'
        let aulaIdEstudiante: string | null = null
        
        if (esMesAnterior) {
          // Para meses anteriores, usar siempre el aula_id de las asistencias (histórica)
          const asistenciasDelEstudiante = asistenciasData?.filter((a: any) => a.estudiante_id === est.id) || []
          
          if (asistenciasDelEstudiante.length > 0) {
            // Usar el aula_id de la primera asistencia del mes (todas deberían tener el mismo aula_id del mes)
            const primeraAsistenciaDelMes = asistenciasDelEstudiante[0]
            if (primeraAsistenciaDelMes?.aula_id && primeraAsistenciaDelMes?.aula) {
              aulaIdEstudiante = primeraAsistenciaDelMes.aula_id
              aulaNombre = primeraAsistenciaDelMes.aula.nombre || 'Sin aula'
            }
          }
        } else {
          // Para meses actuales/futuros, usar el aula_id actual del estudiante
          // Esto asegura que si un estudiante cambió de aula, se muestre su aula actual
          if (est.aula_id && est.aula) {
            aulaIdEstudiante = est.aula_id
            aulaNombre = (est.aula as any)?.nombre || 'Sin aula'
          }
        }
        
        console.log('👤 [ReporteList] Estudiante en reporte:', {
          estudiante: est.nombre_completo,
          aulaMostrada: aulaNombre,
          aulaIdMostrada: aulaIdEstudiante,
          aulaActual: (est.aula as any)?.nombre,
          aulaIdActual: est.aula_id,
          mesConsultado: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
          esMesAnterior
        })

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

      // Primero, identificar días completos por aula usando aula_id de las asistencias
      const diasCompletosPorAula = new Map<string, Set<string>>() // aula_id -> Set<fecha>
      const aulasMap = new Map<string, { aulaId: string; aulaNombre: string; estudiantesIds: string[] }>()
      
      // IMPORTANTE: Agrupar estudiantes por aula según el mes consultado
      // Para meses anteriores: usar aula_id de las asistencias (histórica)
      // Para meses actuales/futuros: usar aula_id actual del estudiante
      if (esMesAnterior) {
        // Para meses anteriores, agrupar estudiantes por aula_id de sus asistencias
        asistenciasData?.forEach((asist: any) => {
          if (asist.aula_id) {
            const aulaId = asist.aula_id
            const aulaNombre = asist.aula?.nombre || 'Sin aula'
            
            if (!aulasMap.has(aulaId)) {
              aulasMap.set(aulaId, {
                aulaId,
                aulaNombre,
                estudiantesIds: [],
              })
            }
            
            // Agregar estudiante solo si no está ya en la lista
            if (!aulasMap.get(aulaId)!.estudiantesIds.includes(asist.estudiante_id)) {
              aulasMap.get(aulaId)!.estudiantesIds.push(asist.estudiante_id)
            }
          }
        })
      } else {
        // Para meses actuales/futuros, agrupar estudiantes por su aula_id actual
        estudiantesData?.forEach((est: any) => {
          if (est.aula_id) {
            const aulaId = est.aula_id
            const aulaNombre = (est.aula as any)?.nombre || 'Sin aula'
            
            if (!aulasMap.has(aulaId)) {
              aulasMap.set(aulaId, {
                aulaId,
                aulaNombre,
                estudiantesIds: [],
              })
            }
            
            // Agregar estudiante solo si no está ya en la lista
            if (!aulasMap.get(aulaId)!.estudiantesIds.includes(est.id)) {
              aulasMap.get(aulaId)!.estudiantesIds.push(est.id)
            }
          }
        })
      }

      console.log('🏫 [ReporteList] Aulas agrupadas:', {
        totalAulas: aulasMap.size,
        aulas: Array.from(aulasMap.entries()).map(([aulaId, aula]) => ({
          aulaId: aulaId.substring(0, 8),
          aulaNombre: aula.aulaNombre,
          totalEstudiantes: aula.estudiantesIds.length
        }))
      })

      // Identificar días completos (días donde todos los estudiantes del aula están marcados)
      aulasMap.forEach((aula, aulaId) => {
        const totalEstudiantes = aula.estudiantesIds.length
        const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

        // Agrupar TODAS las asistencias por fecha para esta aula
        // IMPORTANTE: Usar aula_id de la asistencia para agrupar correctamente
        asistenciasData?.forEach((asist: any) => {
          // Solo incluir asistencias que pertenecen a esta aula (según aula_id de la asistencia)
          if (asist.aula_id === aulaId && aula.estudiantesIds.includes(asist.estudiante_id)) {
            const fecha = asist.fecha
            
            // Contar TODAS las asistencias registradas
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
          
          // IMPORTANTE: Para detectar días completos, usar TODOS los estudiantes del aula
          // NO filtrar por created_at porque los estudiantes pueden haber sido agregados después
          // pero aún así deberían tener asistencia registrada para fechas anteriores
          // Esto es consistente con la lógica de detección de días incompletos
          const totalEstudiantesEnFecha = aula.estudiantesIds.length
          
          // Contar estudiantes marcados que pertenecen a esta aula
          const estudiantesAulaSet = new Set(aula.estudiantesIds)
          const marcados = Array.from(estudiantesMarcados).filter(estId => 
            estudiantesAulaSet.has(estId)
          ).length
          
          // Si todos los estudiantes del aula están marcados y está en el rango, es un día completo
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
      // IMPORTANTE: Usar aula_id de la asistencia, no del estudiante
      asistenciasData?.forEach((asist: any) => {
        const estudiante = estudiantesData?.find(e => e.id === asist.estudiante_id)
        if (!estudiante) return

        // Usar aula_id de la asistencia para preservar el aula histórica
        const aulaId = asist.aula_id || estudiante.aula_id // Fallback al aula actual si no hay aula_id en asistencia
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
          // IMPORTANTE: Solo actualizar el aula_nombre usando el aula_id de la asistencia para meses anteriores
          // Para meses actuales, mantener el aula_nombre que se estableció usando el aula_id actual del estudiante
          if (esMesAnterior && asist.aula_id && asist.aula) {
            const aulaNombreDeAsistencia = asist.aula.nombre || 'Sin aula'
            // Solo actualizar si es diferente (puede haber múltiples asistencias del mismo estudiante)
            if (estudianteResumen.aula_nombre !== aulaNombreDeAsistencia) {
              estudianteResumen.aula_nombre = aulaNombreDeAsistencia
            }
          }
          // Para meses actuales, NO sobrescribir el aula_nombre (ya está correcto desde la inicialización)
          
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
        // Usar aula.estudiantesIds como total: lista de estudiantes en el aula según el reporte.
        // Así evitamos falsos positivos cuando periodos/RPC devuelve más de lo que muestra Asistencias.
        aulasMap.forEach((aula, aulaId) => {
          const asistenciasPorFecha = new Map<string, Set<string>>() // fecha -> Set<estudiante_id>

          // Agrupar asistencias por fecha para esta aula (cualquier estado: presente, falto, permiso)
          asistenciasData?.forEach((asist: any) => {
            if (asist.aula_id === aulaId) {
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
          asistenciasData?.forEach((asist: any) => {
            if (asist.aula_id === aulaId) {
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

            // Total = estudiantes en el aula (según aulasMap del reporte)
            const estudiantesAulaSet = new Set(aula.estudiantesIds)
            const totalEstudiantesEnFecha = aula.estudiantesIds.length

            // Marcados = estudiantes del aula que tienen asistencia en esta fecha
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

        // Obtener tutores asignados a cada aula usando aulas de las asistencias
        const aulasIds = Array.from(new Set(
          asistenciasData?.map((a: any) => a.aula_id).filter((id: string) => id) || []
        ))
        const aulaTutorMap = new Map<string, string>() // aula_id -> tutor_nombre

        // Obtener todos los tutores asignados a aulas de una vez usando el fcpId del rol seleccionado
        const { data: tutorAulasData } = await supabase
          .from('tutor_aula')
          .select(`
            aula_id,
            fcp_miembro_id,
            fcp_miembro:fcp_miembros(
              nombre_display,
              email_pendiente,
              usuario:usuarios(nombre_completo, email)
            )
          `)
          .eq('fcp_id', fcpIdAUsar)
          .eq('activo', true)
          .in('aula_id', aulasIds)

        // Mapear tutores a aulas (incluye invitaciones pendientes: nombre_display/email_pendiente)
        tutorAulasData?.forEach((ta: any) => {
          const fm = ta.fcp_miembro
          if (!fm) return
          const usuario = fm.usuario
          const tutorNombre = (fm.nombre_display?.trim() || usuario?.nombre_completo?.trim() || usuario?.email || fm.email_pendiente) || 'Sin tutor asignado'
          aulaTutorMap.set(ta.aula_id, tutorNombre)
        })

        // Para aulas sin tutor, asignar "Sin tutor asignado"
        aulasIds.forEach(aulaId => {
          if (!aulaTutorMap.has(aulaId)) {
            aulaTutorMap.set(aulaId, 'Sin tutor asignado')
          }
        })

        // Crear mapa de asistencias por estudiante y fecha (presente, falto, permiso)
        const asistenciasMap = new Map<string, Map<string, 'presente' | 'falto' | 'permiso'>>()

        asistenciasData?.forEach((asist: any) => {
          const estudiante = estudiantesData?.find(e => e.id === asist.estudiante_id)
          if (!estudiante) return

          const estado = asist.estado as 'presente' | 'falto' | 'permiso'
          if (!estado || !['presente', 'falto', 'permiso'].includes(estado)) return

          // IMPORTANTE: Solo actualizar el aula_nombre usando el aula_id de la asistencia para meses anteriores
          const estudianteResumen = resumenPorEstudianteMap.get(asist.estudiante_id)
          if (estudianteResumen && esMesAnterior && asist.aula_id && asist.aula) {
            const aulaNombreDeAsistencia = asist.aula.nombre || 'Sin aula'
            if (estudianteResumen.aula_nombre !== aulaNombreDeAsistencia) {
              estudianteResumen.aula_nombre = aulaNombreDeAsistencia
            }
          }

          const fecha = asist.fecha
          const [year, month, day] = fecha.split('-').map(Number)
          const fechaDate = new Date(year, month - 1, day)
          const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
          const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio)
          const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
          const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin)
          const esDelRango = fechaDate >= fechaInicioDate && fechaDate <= fechaFinDate

          if (esDelRango) {
            if (!asistenciasMap.has(asist.estudiante_id)) {
              asistenciasMap.set(asist.estudiante_id, new Map())
            }
            asistenciasMap.get(asist.estudiante_id)!.set(fecha, estado)
          }
        })

        // Construir reporte detallado
        const estudiantesOrdenados = Array.from(resumenPorEstudianteMap.values())
          .sort((a, b) => a.estudiante_nombre.localeCompare(b.estudiante_nombre))

        reporteDetallado = estudiantesOrdenados.map((est, index) => {
          const estudiante = estudiantesData?.find(e => e.id === est.estudiante_id)
          // Obtener aula_id de las asistencias del estudiante en el mes consultado para preservar el aula histórica
          // IMPORTANTE: Usar el aula_id de las asistencias del mes, no el aula_id actual del estudiante
          const asistenciasDelEstudiante = asistenciasData?.filter((a: any) => a.estudiante_id === est.estudiante_id) || []
          const primeraAsistenciaDelMes = asistenciasDelEstudiante[0]
          const aulaId = primeraAsistenciaDelMes?.aula_id || estudiante?.aula_id || ''
          const tutor = aulaTutorMap.get(aulaId) || 'Sin tutor asignado'
          const nivel = est.aula_nombre // Ya está usando el aula_nombre correcto del resumenPorEstudianteMap

          const asistenciasPorFecha: { [fecha: string]: 'presente' | 'falto' | 'permiso' | undefined } = {}
          const asistMap = asistenciasMap.get(est.estudiante_id)
          fechasUnicas.forEach((fecha) => {
            asistenciasPorFecha[fecha] = asistMap?.get(fecha)
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
      toast.error('Error al generar el reporte', 'Intenta nuevamente.')
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

          // Agregar asistencias por fecha (presente=1, falto=F, permiso=P)
          fechasUnicasArray.forEach(fecha => {
            const e = row.asistenciasPorFecha[fecha]
            rowData.push(e === 'presente' ? '1' : e === 'falto' ? 'F' : e === 'permiso' ? 'P' : '')
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
      toast.error('Error al exportar a Excel', 'Intenta nuevamente.')
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
        
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()

        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]

        let y = 12

        // Título
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Reporte General de Asistencia', pageWidth / 2, y, { align: 'center' })
        y += 4

      // Información general (tres columnas)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const col1 = 15
      const col2 = pageWidth / 3 + 10
      const col3 = (pageWidth / 3) * 2 + 10
      
      doc.text(`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, col1, y)
      doc.text(`AÑO: ${selectedYear}`, col2, y)
      doc.text(`MES: ${monthNames[selectedMonth].toUpperCase()}`, col3, y)
      y += 4
      if (responsable) {
        doc.text(`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, col1, y)
        doc.text(`EMAIL: ${responsable.email.toUpperCase()}`, col2, y)
        doc.text(`ROL: ${responsable.rol.toUpperCase()}`, col3, y)
        y += 4
      }
      y += 4

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

          // Agregar asistencias por fecha (presente=1, falto=F, permiso=P)
          if (reporteData.fechasUnicas) {
            reporteData.fechasUnicas.forEach(fecha => {
              const e = row.asistenciasPorFecha[fecha]
              rowData.push(e === 'presente' ? '1' : e === 'falto' ? 'F' : e === 'permiso' ? 'P' : '')
            })
          }

          body.push(rowData)
        })

        // Configuración de columnas: No(numeric), ESTUDIANTE(text), Cod(numeric), Niv(numeric), TUTOR(text), fechas(compact)
        const numCols = headers.length
        const availableWidth = getAvailableTableWidth(doc, 15)
        const fontSize = getFontSizeForColumns(numCols)
        const columnConfigs: PDFTableColumnConfig[] = [
          { type: 'compact', halign: 'center' },
          { type: 'text', weight: 1.5, halign: 'left' },
          { type: 'compact', halign: 'center' },
          { type: 'compact', halign: 'center' },
          { type: 'text', weight: 1.2, halign: 'left' },
          ...reporteData.fechasUnicas.map(() => ({ type: 'compact' as const, weight: 0.5, halign: 'center' as const })),
        ]
        const columnStyles = getProportionalColumnStyles(numCols, availableWidth, columnConfigs)

        const tableOptions = {
          startY: y,
          head: [headers],
          body: body,
          theme: 'grid',
          tableWidth: availableWidth,
          margin: { left: 15, right: 15 },
          headStyles: {
            ...getPDFHeaderStyles(),
            fontSize,
            cellPadding: 1.5,
          },
          bodyStyles: {
            ...getPDFBodyStyles(),
            fontSize: Math.max(5, fontSize - 0.5),
            cellPadding: 1.5,
          },
          alternateRowStyles: getPDFAlternateRowStyles(),
          styles: {
            cellPadding: 1.5,
            overflow: 'linebreak',
            fontSize: Math.max(5, fontSize - 0.5),
          },
          columnStyles,
        }

        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(tableOptions)
        } else if (typeof autoTable === 'function') {
          autoTable(doc, tableOptions)
        } else {
          throw new Error('autoTable no está disponible. Verifica la instalación de jspdf-autotable.')
        }

        const nombreArchivo = `Reporte_General_${(reporteData.fcp.razon_social || 'FCP').replace(/\s+/g, '_')}_${monthNames[selectedMonth]}_${selectedYear}.pdf`
        doc.save(nombreArchivo)
      } else {
        // Formato anterior para reportes sin detalle (no debería llegar aquí)
        const jsPDF = (await import('jspdf')).default
        const doc = new jsPDF()
        let y = 12

        doc.setFontSize(12)
        doc.text('Reporte de Asistencias', 105, y, { align: 'center' })
        y += 4

        // Información del proyecto (tres columnas)
        doc.setFontSize(8)
        const pageWidth = doc.internal.pageSize.getWidth()
        const col1 = 20
        const col2 = pageWidth / 3 + 10
        const col3 = (pageWidth / 3) * 2 + 10
        
        const year = new Date(reporteData.fechaInicio).getFullYear()
        const month = new Date(reporteData.fechaInicio).getMonth()
        doc.text(`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, col1, y)
        doc.text(`AÑO: ${year}`, col2, y)
        doc.text(`MES: ${monthNames[month].toUpperCase()}`, col3, y)
        y += 4
        if (responsable) {
          doc.text(`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, col1, y)
          doc.text(`EMAIL: ${responsable.email.toUpperCase()}`, col2, y)
          doc.text(`ROL: ${responsable.rol.toUpperCase()}`, col3, y)
          y += 4
        }

        const nombreArchivo = `Reporte_General_${reporteData.fcp.razon_social}_${reporteData.fechaInicio}_${reporteData.fechaFin}.pdf`
        doc.save(nombreArchivo)
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error('Error al exportar a PDF', 'Intenta nuevamente.')
    }
  }

  // Si no hay fcpId y no es facilitador, mostrar mensaje
  if (!fcpIdFinal && !esFacilitador && !roleLoading) {
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
            {esFacilitador && userFCPs.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">FCP:</label>
                <Select
                  value={fcpIdFinal ?? ''}
                  onValueChange={(value) => {
                    setFcpIdFinal(value || null)
                    setFcpIdParaFacilitador(value || null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar FCP" />
                  </SelectTrigger>
                  <SelectContent>
                    {userFCPs.map((fcp) => (
                      <SelectItem key={fcp.id} value={fcp.id}>
                        {fcp.numero_identificacion ? `${fcp.numero_identificacion} – ` : ''}{fcp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

          <RoleGuard fcpId={fcpIdFinal || undefined} allowedRoles={['facilitador', 'director', 'secretario']}>
            <div className="mt-4">
              <Button onClick={generarReporte} disabled={loading || !fcpIdFinal}>
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
              {!fcpIdFinal && (
                <p className="text-sm text-muted-foreground mt-2">
                  Por favor, asegúrate de tener un rol seleccionado.
                </p>
              )}
            </div>
          </RoleGuard>
        </CardContent>
      </Card>

      {reporteData && (
        <div className="flex justify-center w-full">
        <Card
          ref={cardRef}
          className="relative"
          style={
            reporteData.reporteDetallado && reporteData.fechasUnicas
              ? {
                  width: tableWidth ? `${tableWidth}px` : defaultWidthRef.current ? `${defaultWidthRef.current}px` : '100%',
                  maxWidth: tableWidth ? `${tableWidth}px` : defaultWidthRef.current ? `${defaultWidthRef.current}px` : '100%',
                  overflow: 'visible',
                }
              : undefined
          }
        >
          {reporteData.reporteDetallado && reporteData.fechasUnicas && (
            <div
              className="absolute top-0 right-0 w-4 h-full cursor-col-resize hover:bg-primary/60 opacity-0 hover:opacity-100 transition-opacity z-50"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsResizingTable(true)
                setResizeStartX(e.pageX)
                if (cardRef.current) {
                  const currentWidth = cardRef.current.offsetWidth
                  setResizeStartWidth(currentWidth)
                  if (defaultWidthRef.current === null) defaultWidthRef.current = currentWidth
                } else {
                  setResizeStartWidth(defaultWidthRef.current || Math.min(1280, window.innerWidth - 64))
                }
              }}
              style={{ cursor: 'col-resize' }}
              title="Arrastra para expandir la tabla horizontalmente"
            />
          )}
          <CardHeader>
            <div className="flex flex-col gap-4 sm:gap-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle>Reporte Generado</CardTitle>
                </div>
              <RoleGuard fcpId={fcpIdFinal || undefined} allowedRoles={['facilitador', 'director', 'secretario']}>
                <div className="flex flex-shrink-0 flex-wrap gap-2">
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
              {reporteData.reporteDetallado && reporteData.fechasUnicas && (
                <span className="text-xs text-muted-foreground">
                  {tableWidth ? `Ancho tabla: ${tableWidth}px | ` : ''}
                  Arrastra el borde derecho de la tarjeta para expandir la tabla
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {reporteData.reporteDetallado && reporteData.fechasUnicas ? (
              // Reporte General Detallado
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4 grid grid-cols-1 gap-y-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
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

                {isMobile ? (
                  // Vista móvil: cards con paginación y búsqueda
                  (() => {
                    const rows = reporteData.reporteDetallado || []
                    const filtered = mobileSearch.trim()
                      ? rows.filter(
                          (r) =>
                            r.persona.toLowerCase().includes(mobileSearch.toLowerCase()) ||
                            (r.codigo || '').toLowerCase().includes(mobileSearch.toLowerCase()) ||
                            (r.nivel || '').toLowerCase().includes(mobileSearch.toLowerCase())
                        )
                      : rows
                    const perPage = 8
                    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
                    const displayRows = filtered.slice((mobilePage - 1) * perPage, mobilePage * perPage)
                    const totalDias = reporteData.fechasUnicas?.length || 0
                    return (
                      <div className="space-y-4">
                        <div className="relative">
                          <Input
                            placeholder="Buscar por nombre, código o nivel..."
                            value={mobileSearch}
                            onChange={(e) => {
                              setMobileSearch(e.target.value)
                              setMobilePage(1)
                            }}
                            className="pl-9"
                          />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-3">
                          {displayRows.map((row, idx) => {
                            const fechasConRegistro = reporteData.fechasUnicas?.filter((f) => row.asistenciasPorFecha[f]) || []
                            const presentes = fechasConRegistro.filter((f) => row.asistenciasPorFecha[f] === 'presente').length
                            const faltas = fechasConRegistro.filter((f) => row.asistenciasPorFecha[f] === 'falto').length
                            const permisos = fechasConRegistro.filter((f) => row.asistenciasPorFecha[f] === 'permiso').length
                            const isExpanded = expandedCardId === row.no
                            return (
                              <Card key={row.no}>
                                <div
                                  className="p-4 cursor-pointer"
                                  onClick={() => setExpandedCardId(isExpanded ? null : row.no)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-mono text-xs text-muted-foreground">{row.codigo}</p>
                                      <p className="font-medium truncate">{row.persona}</p>
                                      <p className="text-sm text-muted-foreground">{row.nivel} · {row.tutor}</p>
                                      <p className="text-sm mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                        <span className="text-green-600 dark:text-green-400">{presentes} presente{presentes !== 1 ? 's' : ''}</span>
                                        <span className="text-red-600 dark:text-red-400">{faltas} falta{faltas !== 1 ? 's' : ''}</span>
                                        <span className="text-amber-600 dark:text-amber-400">{permisos} permiso{permisos !== 1 ? 's' : ''}</span>
                                      </p>
                                    </div>
                                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                                  </div>
                                  {isExpanded && (
                                    fechasConRegistro.length > 0 ? (
                                    <div className="mt-4 pt-3 border-t grid grid-cols-7 gap-1">
                                      {fechasConRegistro.map((fecha) => {
                                        const [y, m, d] = fecha.split('-').map(Number)
                                        const estado = row.asistenciasPorFecha[fecha]!
                                        const bgClass = estado === 'presente' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                          : estado === 'falto' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        const simbolo = estado === 'presente' ? '✓' : estado === 'falto' ? '✗' : 'P'
                                        return (
                                          <div
                                            key={fecha}
                                            className={`text-center py-1 rounded text-xs ${bgClass}`}
                                            title={`${fecha}: ${estado}`}
                                          >
                                            <span className="block font-medium">{d}</span>
                                            <span>{simbolo}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-4 pt-3 border-t text-sm text-muted-foreground">Sin días registrados</p>
                                  )
                                  )}
                                </div>
                              </Card>
                            )
                          })}
                        </div>
                        {filtered.length > perPage && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                              {(mobilePage - 1) * perPage + 1} - {Math.min(mobilePage * perPage, filtered.length)} de {filtered.length}
                            </p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" disabled={mobilePage <= 1} onClick={() => setMobilePage((p) => Math.max(1, p - 1))}>
                                Anterior
                              </Button>
                              <Button variant="outline" size="sm" disabled={mobilePage >= totalPages} onClick={() => setMobilePage((p) => Math.min(totalPages, p + 1))}>
                                Siguiente
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()
                ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <p className="mb-2 px-4 pt-4 text-xs text-muted-foreground md:hidden">Desliza para ver más columnas →</p>
                  <div
                    ref={tableContainerRef}
                    className="table-responsive overflow-x-auto select-none"
                    style={{
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    title="Shift + scroll o arrastra con el mouse para desplazamiento horizontal"
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        setIsDragging(true)
                        const rect = tableContainerRef.current?.getBoundingClientRect()
                        setStartX(e.pageX - (rect?.left || 0))
                        setScrollLeft(tableContainerRef.current?.scrollLeft || 0)
                        e.preventDefault()
                        e.stopPropagation()
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isDragging && tableContainerRef.current) {
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = tableContainerRef.current.getBoundingClientRect()
                        const x = e.pageX - rect.left
                        const walk = (x - startX) * 2
                        tableContainerRef.current.scrollLeft = scrollLeft - walk
                      }
                    }}
                    onMouseUp={() => {
                      if (isDragging) setIsDragging(false)
                    }}
                    onMouseLeave={() => {
                      if (isDragging) setIsDragging(false)
                    }}
                  >
                    <table className="w-full border-collapse border border-border text-sm table-auto" style={{ minWidth: 'max-content' }}>
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border border-border p-2 bg-muted/50 text-center min-w-[2rem] text-foreground">No</th>
                          <th className="border border-border p-2 bg-muted/50 text-left min-w-[140px] max-w-[220px] text-foreground">ESTUDIANTE</th>
                          <th className="border border-border p-2 bg-muted/50 text-center min-w-[6rem] text-foreground">Cod</th>
                          <th className="border border-border p-2 bg-muted/50 text-center min-w-[7.5rem] whitespace-nowrap text-foreground">Niv</th>
                          <th className="border border-border p-2 bg-muted/50 text-left min-w-[140px] text-foreground">TUTOR</th>
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
                            <td className="border border-border p-2 text-center min-w-[2rem] text-foreground">{row.no}</td>
                            <td className="border border-border p-2 min-w-[140px] max-w-[220px] truncate text-foreground" title={row.persona}>{row.persona}</td>
                            <td className="border border-border p-2 text-center font-mono min-w-[6rem] text-foreground">{row.codigo}</td>
                            <td className="border border-border p-2 text-center min-w-[7.5rem] whitespace-nowrap text-foreground">{row.nivel}</td>
                            <td className="border border-border p-2 min-w-[140px] text-foreground">{row.tutor}</td>
                            {reporteData.fechasUnicas?.map((fecha) => {
                              const estado = row.asistenciasPorFecha[fecha]
                              const celda = estado === 'presente' ? '1' : estado === 'falto' ? 'F' : estado === 'permiso' ? 'P' : ''
                              return (
                                <td
                                  key={fecha}
                                  className="border border-border p-2 text-center text-foreground"
                                >
                                  {celda}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
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

                {/* Resumen por Estudiante */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Resumen por Estudiante</h3>
                  {isMobile ? (
                    (() => {
                      const estList = reporteData.resumenPorEstudiante
                      const filteredEst = mobileSearch.trim()
                        ? estList.filter(
                            (e) =>
                              e.estudiante_nombre.toLowerCase().includes(mobileSearch.toLowerCase()) ||
                              (e.estudiante_codigo || '').toLowerCase().includes(mobileSearch.toLowerCase()) ||
                              (e.aula_nombre || '').toLowerCase().includes(mobileSearch.toLowerCase())
                          )
                        : estList
                      const perPage = 8
                      const totalPages = Math.max(1, Math.ceil(filteredEst.length / perPage))
                      const displayEst = filteredEst.slice((mobilePage - 1) * perPage, mobilePage * perPage)
                      return (
                        <div className="space-y-4">
                          <div className="relative">
                            <Input
                              placeholder="Buscar por nombre, código o aula..."
                              value={mobileSearch}
                              onChange={(e) => {
                                setMobileSearch(e.target.value)
                                setMobilePage(1)
                              }}
                              className="pl-9"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-3">
                            {displayEst.map((est) => (
                              <Card key={est.estudiante_id}>
                                <CardContent className="p-4">
                                  <p className="font-mono text-sm text-muted-foreground">{est.estudiante_codigo}</p>
                                  <p className="font-medium">{est.estudiante_nombre}</p>
                                  <p className="text-sm text-muted-foreground">{est.aula_nombre}</p>
                                  <div className="flex gap-3 mt-2 text-sm">
                                    <span className="text-green-600 dark:text-green-400">{est.presentes} presentes</span>
                                    <span className="text-red-600 dark:text-red-400">{est.faltas} faltas</span>
                                    <span className="text-yellow-600 dark:text-yellow-400">{est.permisos} permisos</span>
                                    <span className="text-muted-foreground">{est.total_dias} días</span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          {filteredEst.length > perPage && (
                            <div className="flex items-center justify-between pt-4 border-t">
                              <p className="text-sm text-muted-foreground">
                                {(mobilePage - 1) * perPage + 1} - {Math.min(mobilePage * perPage, filteredEst.length)} de {filteredEst.length}
                              </p>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={mobilePage <= 1} onClick={() => setMobilePage((p) => Math.max(1, p - 1))}>Anterior</Button>
                                <Button variant="outline" size="sm" disabled={mobilePage >= totalPages} onClick={() => setMobilePage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()
                  ) : (
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
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}

