'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MonthPicker } from '@/components/ui/month-picker'
import { FileSpreadsheet, FileText, Calendar, Download, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useRouter } from 'next/navigation'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
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

interface ReporteAsistenciaPorNivelProps {
  fcpId: string | null
}

interface AulaData {
  id: string
  nombre: string
  tutor?: {
    id: string
    nombre_completo?: string
    email: string
  }
}

interface AsistenciaPorFecha {
  [fecha: string]: {
    presente: number
    permiso: number
    falto: number
    total: number
  }
}

interface TutorData {
  tutorId: string | null
  tutorNombre: string
  aulaId: string
  aulaNombre: string
  asistencias: AsistenciaPorFecha
  totalPresente: number
  totalPermiso: number
  totalFalto: number
  totalRegistros: number // Cantidad de estudiantes del salón
  diasDeAtencion: number // Días completos de atención
  asistenPromed: number // Asis.Pro.m = totalPresente / diasDeAtencion
}

interface NivelGroup {
  nivel: string // Nombre del aula
  aulas: TutorData[]
  totalPresente: number
  totalPermiso: number
  totalFalto: number
  totalRegistros: number
  totalDiasAtencion: number // Total de días de atención del nivel
  asistenPromed: number // Asis.Pro.m = totalPresente / totalDiasAtencion
  diasIncompletos: Array<{ fecha: string; aulaId: string; tutorNombre: string; marcados: number; total: number }> // Días donde no todos los estudiantes están marcados
}

interface DiaIncompleto {
  fecha: string
  fechaFormateada: string
  nivel: string
  tutorNombre: string
  marcados: number
  total: number
  aulaId: string
}

export function ReporteAsistenciaPorNivel({ fcpId: fcpIdProp }: ReporteAsistenciaPorNivelProps) {
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedFCP, setSelectedFCP] = useState<string | null>(fcpIdProp || null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [reporteData, setReporteData] = useState<{
    fcp: { id: string; razon_social: string; numero_identificacion?: string }
    year: number
    month: number
    niveles: NivelGroup[]
    fechasUnicas: string[] // Solo fechas completas (todos marcados o día sin atención)
    diasIncompletos: DiaIncompleto[] // Días que no se completaron
  } | null>(null)
  const [responsable, setResponsable] = useState<{ nombre: string; email: string; rol: string } | null>(null)
  const [isFacilitador, setIsFacilitador] = useState(false)
  const { canViewReports, loading: roleLoading } = useUserRole(selectedFCP)
  const router = useRouter()
  const { selectedRole } = useSelectedRole()

  // Scroll horizontal y resize (igual que Reporte General)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const defaultWidthRef = useRef<number | null>(null)
  const [tableWidth, setTableWidth] = useState<number | null>(null)
  const [isResizingTable, setIsResizingTable] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSearch, setMobileSearch] = useState('')
  const [mobilePage, setMobilePage] = useState(1)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  useEffect(() => {
    const initialize = async () => {
      await checkIfFacilitador()
      if (fcpIdProp) {
        setSelectedFCP(fcpIdProp)
      }
      await loadUserFCPs()
    }
    initialize()
  }, [fcpIdProp, selectedRole?.role, selectedRole?.fcpId])

  // Ancho por defecto y resize
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

  useEffect(() => {
    const el = tableContainerRef.current
    if (!el || !reporteData) return
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [reporteData])

  const checkIfFacilitador = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: facRow } = await supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle()
      setIsFacilitador(!!facRow)
    } catch (error) {
      console.error('Error checking facilitador:', error)
    }
  }

  const loadUserFCPs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: facRow } = await supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle()
      const isFacilitadorCheck = !!facRow
      setIsFacilitador(isFacilitadorCheck)

      let fcps: Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }> = []

      if (isFacilitadorCheck) {
        const { data: fcpsData, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('facilitador_id', user.id)
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        if (fcpsError) throw fcpsError
        fcps = (fcpsData || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP',
          numero_identificacion: fcp.numero_identificacion,
          razon_social: fcp.razon_social,
        }))
      } else {
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select('fcp_id, fcp:fcps(id, razon_social, numero_identificacion)')
          .eq('usuario_id', user.id)
          .eq('activo', true)
          .not('fcp_id', 'is', null)
        if (error) throw error
        fcps = data?.map((item: any) => ({
          id: item.fcp.id,
          nombre: item.fcp.razon_social || item.fcp.numero_identificacion || 'FCP',
          numero_identificacion: item.fcp.numero_identificacion,
          razon_social: item.fcp.razon_social,
        })) || []
      }

      if (selectedRole?.fcpId) {
        const sole = fcps.find((f: any) => f.id === selectedRole.fcpId)
        fcps = sole ? [sole] : []
      }

      setUserFCPs(fcps)
      if (fcps.length > 0 && !selectedFCP && !isFacilitadorCheck && !fcpIdProp) {
        if (selectedRole?.fcpId && fcps.some((f: any) => f.id === selectedRole.fcpId)) setSelectedFCP(selectedRole.fcpId)
        else setSelectedFCP(fcps[0].id)
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
    }
  }

  const generarReporte = async () => {
    // Usar el fcpId del rol seleccionado si está disponible, de lo contrario usar selectedFCP
    const fcpIdParaReporte = selectedRole?.fcpId || selectedFCP
    
    if (!fcpIdParaReporte) {
      toast.warning('Selecciona FCP o rol', 'Selecciona una FCP o asegúrate de tener un rol seleccionado.')
      return
    }

    console.log('📊 [ReporteAsistenciaPorNivel] Generando reporte con:', {
      fcpIdParaReporte,
      selectedFCP,
      selectedRoleFcpId: selectedRole?.fcpId,
      selectedRole: selectedRole?.role
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
          : String(rolSeleccionado).charAt(0).toUpperCase() + String(rolSeleccionado).slice(1)

        console.log('👤 [ReporteAsistenciaPorNivel] Estableciendo responsable:', {
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
        console.warn('⚠️ [ReporteAsistenciaPorNivel] No hay rol seleccionado, intentando obtener desde fcp_miembros')
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
        console.error('❌ [ReporteAsistenciaPorNivel] Error obteniendo FCP:', fcpError)
        throw fcpError
      }

      // Obtener todas las aulas de la FCP con sus tutores usando el fcpId del rol seleccionado
      const { data: aulasData, error: aulasError } = await supabase
        .from('aulas')
        .select(`
          id,
          nombre,
          tutor_aula!inner(
            fcp_miembro:fcp_miembros!inner(
              usuario_id,
              usuario:usuarios(id, email, nombre_completo)
            )
          )
        `)
        .eq('fcp_id', fcpIdParaReporte)
        .eq('activa', true)
        .eq('tutor_aula.activo', true)

      if (aulasError && aulasError.code !== 'PGRST116') {
        throw aulasError
      }

      // Obtener TODAS las aulas de la FCP (con o sin tutores) usando el fcpId del rol seleccionado
      const { data: todasLasAulas, error: todasLasAulasError } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', fcpIdParaReporte)
        .eq('activa', true)

      if (todasLasAulasError) {
        console.error('❌ [ReporteAsistenciaPorNivel] Error obteniendo todas las aulas:', todasLasAulasError)
        throw todasLasAulasError
      }

      // Crear un mapa de aulas con tutores desde la consulta inicial
      const aulasConTutorMap = new Map<string, AulaData>()
      if (aulasData && aulasData.length > 0) {
        aulasData.forEach((a: any) => {
          const tutorAula = Array.isArray(a.tutor_aula) ? a.tutor_aula[0] : a.tutor_aula
          const fcpMiembro = tutorAula?.fcp_miembro
          const usuario = fcpMiembro?.usuario
          
          aulasConTutorMap.set(a.id, {
            id: a.id,
            nombre: a.nombre,
            tutor: usuario ? {
              id: usuario.id,
              nombre_completo: usuario.nombre_completo || undefined,
              email: usuario.email,
            } : undefined,
          })
        })
      }

      // Combinar todas las aulas: primero las que tienen tutor, luego las que no tienen tutor
      const aulas: AulaData[] = []
      const aulasIdsProcesadas = new Set<string>()

      // Agregar aulas con tutores primero
      aulasConTutorMap.forEach((aula) => {
        aulas.push(aula)
        aulasIdsProcesadas.add(aula.id)
      })

      // Agregar aulas sin tutores
      if (todasLasAulas) {
        todasLasAulas.forEach((aula: any) => {
          if (!aulasIdsProcesadas.has(aula.id)) {
            aulas.push({
              id: aula.id,
              nombre: aula.nombre,
            })
          }
        })
      }

      console.log('📚 Aulas cargadas en reporte:', {
        total: aulas.length,
        aulas: aulas.map(a => ({ 
          id: a.id, 
          nombre: a.nombre, 
          tutor: a.tutor?.nombre_completo || a.tutor?.email || 'Sin tutor' 
        })),
        aulasPorNombre: aulas.reduce((acc, aula) => {
          if (!acc[aula.nombre]) acc[aula.nombre] = []
          acc[aula.nombre].push({ id: aula.id, tutor: aula.tutor?.nombre_completo || aula.tutor?.email || 'Sin tutor' })
          return acc
        }, {} as Record<string, Array<{ id: string; tutor: string }>>),
      })

      // Calcular rango de fechas del mes
      const firstDay = new Date(selectedYear, selectedMonth, 1)
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
      const fechaInicio = firstDay.toISOString().split('T')[0]
      const fechaFin = lastDay.toISOString().split('T')[0]

      // Determinar si estamos consultando un mes anterior
      const fechaActual = new Date()
      const mesActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      const mesConsultado = new Date(selectedYear, selectedMonth, 1)
      const esMesAnterior = mesConsultado < mesActual

      console.log('📅 [ReporteAsistenciaPorNivel] Mes consultado:', {
        mesConsultado: `${selectedYear}-${selectedMonth + 1}`,
        mesActual: `${fechaActual.getFullYear()}-${fechaActual.getMonth() + 1}`,
        esMesAnterior
      })

      // IMPORTANTE: Incluir aula_id de la asistencia para preservar el aula histórica
      // Primero obtener asistencias para determinar qué estudiantes y aulas incluir
      const { data: asistenciasData, error: asistenciasError } = await supabase
        .from('asistencias')
        .select(`
          estudiante_id, 
          fecha, 
          estado,
          aula_id,
          aula:aulas(id, nombre),
          estudiante:estudiantes(id, codigo, nombre_completo, aula_id, created_at)
        `)
        .eq('fcp_id', fcpIdParaReporte)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)

      if (asistenciasError) throw asistenciasError

      // Obtener estudiantes según el mes consultado
      let estudiantesData: any[] = []
      let estudianteIds: string[] = []

      if (esMesAnterior) {
        // Para meses anteriores, obtener estudiantes únicos de las asistencias
        const estudiantesMap = new Map<string, any>()
        asistenciasData?.forEach((asist: any) => {
          if (asist.estudiante && !estudiantesMap.has(asist.estudiante_id)) {
            estudiantesMap.set(asist.estudiante_id, {
              id: asist.estudiante.id,
              codigo: asist.estudiante.codigo,
              nombre_completo: asist.estudiante.nombre_completo,
              aula_id: asist.aula_id, // Usar aula_id de la asistencia (histórica)
              created_at: asist.estudiante.created_at
            })
          }
        })
        estudiantesData = Array.from(estudiantesMap.values())
        estudianteIds = estudiantesData.map(e => e.id)
        
        console.log('📊 [ReporteAsistenciaPorNivel] Estudiantes cargados de mes anterior (basados en asistencias):', {
          total: estudiantesData.length
        })
      } else {
        // Para meses actuales/futuros, cargar todos los estudiantes activos de la FCP
        const { data: estudiantesDataQuery, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select('id, codigo, nombre_completo, aula_id, created_at')
          .eq('fcp_id', fcpIdParaReporte)
          .eq('activo', true)
          .in('aula_id', aulas.map(a => a.id))

        if (estudiantesError) throw estudiantesError

        estudiantesData = estudiantesDataQuery || []
        estudianteIds = estudiantesData.map(e => e.id)
        
        console.log('📊 [ReporteAsistenciaPorNivel] Estudiantes cargados (mes actual/futuro):', {
          total: estudiantesData.length
        })
      }
      
      console.log('🔍 [ReporteAsistenciaPorNivel] Debug:', {
        fcpIdParaReporte,
        selectedFCP,
        selectedRoleFcpId: selectedRole?.fcpId,
        estudiantesCount: estudiantesData?.length || 0,
        estudianteIds: estudianteIds.slice(0, 3), // Primeros 3 IDs
        fechaInicio,
        fechaFin,
        year: selectedYear,
        month: selectedMonth,
        esMesAnterior
      })

      console.log('📊 Asistencias en reporte:', {
        count: asistenciasData?.length || 0,
        fechasUnicas: [...new Set(asistenciasData?.map(a => a.fecha) || [])].sort((a, b) => {
          const dateA = new Date(a)
          const dateB = new Date(b)
          return dateA.getTime() - dateB.getTime()
        }),
        muestra: asistenciasData?.slice(0, 5).map(a => ({ estudiante_id: a.estudiante_id, fecha: a.fecha, estado: a.estado })),
        asistenciasPorEstudiante: estudiantesData?.map(e => ({
          id: e.id,
          codigo: e.codigo,
          nombre: e.nombre_completo,
          aula_id: e.aula_id,
          asistenciasCount: asistenciasData?.filter(a => a.estudiante_id === e.id).length || 0,
          fechas: [...new Set(asistenciasData?.filter(a => a.estudiante_id === e.id).map(a => a.fecha) || [])].sort(),
        })),
      })

      if (asistenciasError) {
        console.error('❌ [ReporteAsistenciaPorNivel] Error obteniendo asistencias:', asistenciasError)
        throw asistenciasError
      }

      // Agrupar asistencias por aula y tutor
      const nivelesMap = new Map<string, NivelGroup>()
      // Incluir TODAS las fechas con asistencias registradas (no solo días completos)
      const fechasSet = new Set<string>()

      const diasIncompletosGlobales: DiaIncompleto[] = []
      
      // Primero, agregar TODAS las fechas con asistencias registradas al fechasSet
      asistenciasData?.forEach(asist => {
        const fecha = asist.fecha
        // Verificar que la fecha esté en el rango del mes seleccionado
        const [year, month, day] = fecha.split('-').map(Number)
        if (year === selectedYear && month - 1 === selectedMonth) {
          fechasSet.add(fecha)
        }
      })
      
      console.log('📅 [ReporteAsistenciaPorNivel] Todas las fechas con asistencias:', {
        totalFechas: fechasSet.size,
        fechas: Array.from(fechasSet).sort()
      })

      // IMPORTANTE: Para meses anteriores, obtener aulas únicas de las asistencias (históricas)
      // Para meses actuales/futuros, usar las aulas cargadas normalmente
      let aulasParaProcesar: any[] = []
      
      if (esMesAnterior) {
        // Para meses anteriores, obtener aulas únicas de las asistencias
        const aulasMap = new Map<string, any>()
        asistenciasData?.forEach((a: any) => {
          if (a.aula_id && a.aula && !aulasMap.has(a.aula_id)) {
            // Buscar el tutor de esta aula en la lista de aulas cargadas
            const aulaOriginal = aulas.find(au => au.id === a.aula_id)
            aulasMap.set(a.aula_id, {
              id: a.aula_id,
              nombre: a.aula.nombre || 'Sin aula',
              tutor: aulaOriginal?.tutor || null
            })
          }
        })
        aulasParaProcesar = Array.from(aulasMap.values())
      } else {
        aulasParaProcesar = aulas
      }

      aulasParaProcesar.forEach(aula => {
        // IMPORTANTE: Agrupar estudiantes por aula según el mes consultado
        // Para meses anteriores: usar aula_id de las asistencias (histórica)
        // Para meses actuales/futuros: usar aula_id actual del estudiante
        let estudiantesDeAula: any[] = []
        
        if (esMesAnterior) {
          // Para meses anteriores, filtrar asistencias que pertenecen a esta aula según aula_id de la asistencia
          const asistenciasDeAula = asistenciasData?.filter((a: any) => a.aula_id === aula.id) || []
          const estudiantesIdsEnAula = new Set(asistenciasDeAula.map((a: any) => a.estudiante_id))
          estudiantesDeAula = estudiantesData?.filter(e => estudiantesIdsEnAula.has(e.id)) || []
        } else {
          // Para meses actuales/futuros, filtrar estudiantes por su aula_id actual
          estudiantesDeAula = estudiantesData?.filter(e => e.aula_id === aula.id) || []
        }
        
        const totalEstudiantes = estudiantesDeAula.length
        
        // IMPORTANTE: Usar aula_id de la asistencia para filtrar asistencias correctamente
        const asistenciasDeAula = asistenciasData?.filter((a: any) => a.aula_id === aula.id) || []
        const asistenciasPorFecha: AsistenciaPorFecha = {}
        const diasIncompletosAula: Array<{ fecha: string; aulaId: string; tutorNombre: string; marcados: number; total: number }> = []
        const tutorNombre = aula.tutor?.nombre_completo || aula.tutor?.email || 'Sin tutor asignado'
        const tutorId = aula.tutor?.id || null
        
        let totalPresente = 0
        let totalPermiso = 0
        let totalFalto = 0
        let diasDeAtencion = 0 // Contar días completos de atención

        // 1. Primero procesar TODAS las asistencias por fecha usando aula_id de la asistencia
        estudiantesDeAula.forEach(estudiante => {
          // Filtrar asistencias que pertenecen a esta aula según aula_id de la asistencia
          const asistenciasEstudiante = asistenciasDeAula.filter((a: any) => a.estudiante_id === estudiante.id) || []
          
          asistenciasEstudiante.forEach(asistencia => {
            const fecha = asistencia.fecha
            
            // Contar TODAS las asistencias registradas (sin filtrar por created_at aquí)
            if (!asistenciasPorFecha[fecha]) {
              asistenciasPorFecha[fecha] = {
                presente: 0,
                permiso: 0,
                falto: 0,
                total: 0,
              }
            }

            asistenciasPorFecha[fecha].total++
            if (asistencia.estado === 'presente') {
              asistenciasPorFecha[fecha].presente++
            } else if (asistencia.estado === 'permiso') {
              asistenciasPorFecha[fecha].permiso++
            } else if (asistencia.estado === 'falto') {
              asistenciasPorFecha[fecha].falto++
            }
          })
        })

        // 2. Generar todas las fechas del mes para detectar días incompletos
        const diasDelMes = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const todasLasFechasDelMes: string[] = []
        for (let dia = 1; dia <= diasDelMes; dia++) {
          const fechaDate = new Date(selectedYear, selectedMonth, dia)
          todasLasFechasDelMes.push(fechaDate.toISOString().split('T')[0])
        }

        // 3. Procesar todas las fechas del mes (no solo las que tienen asistencias)
        todasLasFechasDelMes.forEach(fecha => {
          // Para detectar días incompletos, usar TODOS los estudiantes del aula (como en la página de asistencias)
          // NO filtrar por created_at porque los estudiantes pueden haber sido agregados después
          // pero aún así deberían tener asistencia registrada para fechas anteriores
          const totalEstudiantesEnFecha = estudiantesDeAula.length
          
          // Contar estudiantes que tienen asistencia registrada en esta fecha
          const marcadosEnFecha = estudiantesDeAula.filter(e => {
            // Verificar si tiene asistencia registrada en esta fecha
            const tieneAsistencia = asistenciasData?.some(a => 
              a.estudiante_id === e.id && a.fecha === fecha
            )
            return tieneAsistencia
          }).length
          
          // Si hay al menos uno marcado pero no todos los que deberían tener asistencia, es un día incompleto
          if (marcadosEnFecha > 0 && marcadosEnFecha < totalEstudiantesEnFecha && totalEstudiantesEnFecha > 0) {
            console.log('⚠️ [ReporteAsistenciaPorNivel] Día incompleto detectado:', {
              fecha,
              aula: aula.nombre,
              marcados: marcadosEnFecha,
              totalEstudiantes,
              totalEstudiantesEnFecha,
              tutorNombre
            })
            
            diasIncompletosAula.push({
              fecha,
              aulaId: aula.id,
              tutorNombre,
              marcados: marcadosEnFecha,
              total: totalEstudiantesEnFecha, // Usar el total de estudiantes activos en esa fecha
            })
            
            // También agregar a la lista global
            // Parsear fecha como fecha local para evitar problemas de zona horaria
            const [year, month, day] = fecha.split('-').map(Number)
            const fechaDate = new Date(year, month - 1, day)
            if (fechaDate.getFullYear() === selectedYear && fechaDate.getMonth() === selectedMonth) {
              diasIncompletosGlobales.push({
                fecha,
                fechaFormateada: fechaDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
                nivel: aula.nombre,
                tutorNombre,
                marcados: marcadosEnFecha,
                total: totalEstudiantesEnFecha, // Usar el total de estudiantes activos en esa fecha
                aulaId: aula.id,
              })
            }
            
            // NO marcar para eliminar - mostrar todas las fechas con asistencias
            // fechasParaEliminar.push(fecha)
            
            // Agregar a totales incluso si es un día incompleto (para mostrar todas las asistencias)
            const asistenciaFechaIncompleta = asistenciasPorFecha[fecha]
            if (asistenciaFechaIncompleta) {
              // Recalcular usando todos los estudiantes del aula
              let presente = 0
              let permiso = 0
              let falto = 0
              estudiantesDeAula.forEach(est => {
                const asist = asistenciasData?.find(a => a.estudiante_id === est.id && a.fecha === fecha)
                if (asist) {
                  if (asist.estado === 'presente') presente++
                  else if (asist.estado === 'permiso') permiso++
                  else if (asist.estado === 'falto') falto++
                }
              })
              totalPresente += presente
              totalPermiso += permiso
              totalFalto += falto
            }
          } else if (marcadosEnFecha === totalEstudiantesEnFecha && totalEstudiantesEnFecha > 0) {
            // Día completo: todos los estudiantes que existían están marcados
            console.log('✅ [ReporteAsistenciaPorNivel] Día completo detectado:', {
              fecha,
              aula: aula.nombre,
              marcados: marcadosEnFecha,
              totalEstudiantesEnFecha,
              tutorNombre,
              asistenciasPorFechaTotal: asistenciasPorFecha[fecha]?.total
            })
            // fechasSet ya contiene todas las fechas, no necesitamos agregarla aquí
            diasDeAtencion++ // Contar como día de atención
            
            // Agregar a totales solo si es un día completo
            // IMPORTANTE: Usar solo las asistencias de estudiantes que existían en esa fecha
            const asistenciaFecha = asistenciasPorFecha[fecha]
            if (asistenciaFecha) {
              // Verificar que el total de asistenciasPorFecha coincida con marcadosEnFecha
              // Si no coincide, recalcular usando solo estudiantes que existían
              if (asistenciaFecha.total !== marcadosEnFecha) {
                console.warn('⚠️ [ReporteAsistenciaPorNivel] Discrepancia detectada:', {
                  fecha,
                  aula: aula.nombre,
                  asistenciasPorFechaTotal: asistenciaFecha.total,
                  marcadosEnFecha
                })
                // Recalcular usando todos los estudiantes del aula
                let presente = 0
                let permiso = 0
                let falto = 0
                estudiantesDeAula.forEach(est => {
                  const asist = asistenciasData?.find(a => a.estudiante_id === est.id && a.fecha === fecha)
                  if (asist) {
                    if (asist.estado === 'presente') presente++
                    else if (asist.estado === 'permiso') permiso++
                    else if (asist.estado === 'falto') falto++
                  }
                })
                totalPresente += presente
                totalPermiso += permiso
                totalFalto += falto
              } else {
                totalPresente += asistenciaFecha.presente
                totalPermiso += asistenciaFecha.permiso
                totalFalto += asistenciaFecha.falto
              }
            }
          }
          // Si marcadosEnFecha === 0 y totalEstudiantesEnFecha === 0, es un día sin estudiantes (no se cuenta)
          // Si marcadosEnFecha === 0 pero totalEstudiantesEnFecha > 0, es un día sin clases (no se cuenta como día de atención)
        })
        
        // 3. NO eliminar días incompletos - mostrar TODAS las fechas con asistencias registradas
        // Los días incompletos se marcan para alertas, pero se muestran en el reporte
        // fechasParaEliminar.forEach(fecha => {
        //   delete asistenciasPorFecha[fecha]
        // })

        // Calcular Asis.Pro.m = totalPresente / diasDeAtencion
        // Ejemplo: 2 = 20 / 10
        const asistenPromed = diasDeAtencion > 0
          ? totalPresente / diasDeAtencion
          : 0

        if (!nivelesMap.has(aula.nombre)) {
          nivelesMap.set(aula.nombre, {
            nivel: aula.nombre,
            aulas: [],
            totalPresente: 0,
            totalPermiso: 0,
            totalFalto: 0,
            totalRegistros: 0,
            totalDiasAtencion: 0,
            asistenPromed: 0,
          })
        }

        const nivelGroup = nivelesMap.get(aula.nombre)!
        nivelGroup.aulas.push({
          tutorId,
          tutorNombre,
          aulaId: aula.id,
          aulaNombre: aula.nombre,
          asistencias: asistenciasPorFecha,
          totalPresente,
          totalPermiso,
          totalFalto,
          totalRegistros: totalEstudiantes, // Reg.Pro.m = cantidad de estudiantes del salón
          diasDeAtencion,
          asistenPromed,
        })

        nivelGroup.totalPresente += totalPresente
        nivelGroup.totalPermiso += totalPermiso
        nivelGroup.totalFalto += totalFalto
        nivelGroup.totalRegistros += totalEstudiantes // Sumar estudiantes, no registros
        nivelGroup.totalDiasAtencion += diasDeAtencion
      })

      // Filtrar y ordenar fechas: solo las del mes seleccionado, ordenadas por fecha
      const fechasUnicas = Array.from(fechasSet)
        .filter(fecha => {
          // Parsear fecha manualmente para evitar problemas de zona horaria
          const [year, month, day] = fecha.split('-').map(Number)
          return year === selectedYear && month - 1 === selectedMonth
        })
        .sort((a, b) => {
          // Ordenar cronológicamente
          const dateA = new Date(a)
          const dateB = new Date(b)
          return dateA.getTime() - dateB.getTime()
        })
      
      console.log('📅 [ReporteAsistenciaPorNivel] Fechas detectadas:', {
        totalFechasEnSet: fechasSet.size,
        fechasUnicas: fechasUnicas.length,
        fechasUnicasArray: fechasUnicas,
        todasLasFechasEnSet: Array.from(fechasSet).sort()
      })

      setReporteData({
        fcp: {
          id: fcpData.id,
          razon_social: fcpData.razon_social || fcpData.numero_identificacion || 'FCP',
          numero_identificacion: fcpData.numero_identificacion,
        },
        year: selectedYear,
        month: selectedMonth,
        niveles: Array.from(nivelesMap.values()).map(nivel => ({
          ...nivel,
          // Calcular promedio del nivel: totalPresente / totalDiasAtencion
          asistenPromed: nivel.totalDiasAtencion > 0
            ? nivel.totalPresente / nivel.totalDiasAtencion
            : 0
        })).sort((a, b) => a.nivel.localeCompare(b.nivel)),
        fechasUnicas, // Solo fechas completas
        diasIncompletos: diasIncompletosGlobales.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      })
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
      const XLSX = await import('xlsx-js-style')

      // Crear workbook
      const wb = XLSX.utils.book_new()

      // Preparar datos para Excel
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]

      // Estilos con colores del tema
      const headerStyle = getExcelHeaderStyle()
      const cellStyle = getExcelCellStyle()
      const subtotalStyle = getExcelTotalStyle()

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

      const header = [
        'Nive',
        'TUTOR',
        ...reporteData.fechasUnicas.map(f => {
          // Parsear fecha manualmente para evitar problemas de zona horaria
          const [year, month, day] = f.split('-').map(Number)
          return day.toString()
        }),
        'Asis.Pro.m',
        'Reg.Pro.m',
        '% Asistió',
        '% Permiso',
        '% Faltó',
      ]

      const rows: any[] = []
      const subtotalRows: number[] = [] // Índices de filas de subtotal

      reporteData.niveles.forEach(nivel => {
        nivel.aulas.forEach((aula, index) => {
          const row: any[] = [
            index === 0 ? nivel.nivel : '', // Solo mostrar nivel en la primera fila
            aula.tutorNombre,
          ]

          // Agregar asistencias por fecha
          reporteData.fechasUnicas.forEach(fecha => {
            const asistenciaFecha = aula.asistencias[fecha]
            if (asistenciaFecha) {
              row.push(asistenciaFecha.presente)
            } else {
              row.push('')
            }
          })

          // Totales
          row.push(Number(aula.asistenPromed.toFixed(2))) // Asis.Pro.m = totalPresente / diasDeAtencion
          row.push(aula.totalRegistros) // Reg.Pro.m = cantidad de estudiantes del salón
          
          // Porcentajes basados en el total de registros (presente + permiso + falto)
          const totalRegistrosAsistencia = aula.totalPresente + aula.totalPermiso + aula.totalFalto
          const porcentajeAsistio = totalRegistrosAsistencia > 0
            ? ((aula.totalPresente / totalRegistrosAsistencia) * 100).toFixed(2)
            : '0.00'
          const porcentajePermiso = totalRegistrosAsistencia > 0
            ? ((aula.totalPermiso / totalRegistrosAsistencia) * 100).toFixed(2)
            : '0.00'
          const porcentajeFalto = totalRegistrosAsistencia > 0
            ? ((aula.totalFalto / totalRegistrosAsistencia) * 100).toFixed(2)
            : '0.00'
          row.push(`${porcentajeAsistio}%`)
          row.push(`${porcentajePermiso}%`)
          row.push(`${porcentajeFalto}%`)

          rows.push(row)
        })

        // Fila de subtotal
        const subtotalRow: any[] = [
          nivel.nivel,
          'Subtotal',
        ]

        reporteData.fechasUnicas.forEach(fecha => {
          const totalFecha = nivel.aulas.reduce((sum, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sum + (asistenciaFecha?.presente || 0)
          }, 0)
          subtotalRow.push(totalFecha)
        })

        subtotalRow.push(Number(nivel.asistenPromed.toFixed(2))) // Asis.Pro.m = totalPresente / totalDiasAtencion
        subtotalRow.push(nivel.totalRegistros) // Reg.Pro.m = cantidad de estudiantes del nivel
        
        const totalRegistrosAsistenciaNivel = nivel.totalPresente + nivel.totalPermiso + nivel.totalFalto
        const porcentajeAsistioNivel = totalRegistrosAsistenciaNivel > 0
          ? ((nivel.totalPresente / totalRegistrosAsistenciaNivel) * 100).toFixed(2)
          : '0.00'
        const porcentajePermisoNivel = totalRegistrosAsistenciaNivel > 0
          ? ((nivel.totalPermiso / totalRegistrosAsistenciaNivel) * 100).toFixed(2)
          : '0.00'
        const porcentajeFaltoNivel = totalRegistrosAsistenciaNivel > 0
          ? ((nivel.totalFalto / totalRegistrosAsistenciaNivel) * 100).toFixed(2)
          : '0.00'
        subtotalRow.push(`${porcentajeAsistioNivel}%`)
        subtotalRow.push(`${porcentajePermisoNivel}%`)
        subtotalRow.push(`${porcentajeFaltoNivel}%`)

        subtotalRows.push(rows.length) // Guardar índice de fila de subtotal
        rows.push(subtotalRow)
      })

      // Calcular totales generales
      const totalGeneralPresente = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPresente, 0)
      const totalGeneralPermiso = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPermiso, 0)
      const totalGeneralFalto = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalFalto, 0)
      const totalGeneralRegistros = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalRegistros, 0)
      const totalGeneralDiasAtencion = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalDiasAtencion, 0)
      const totalGeneralAsistenPromed = totalGeneralDiasAtencion > 0
        ? totalGeneralPresente / totalGeneralDiasAtencion
        : 0

      // Fila de Total General
      const totalGeneralRow: any[] = [
        'Total General',
        '',
      ]

      reporteData.fechasUnicas.forEach(fecha => {
        const totalFecha = reporteData.niveles.reduce((sum, nivel) => {
          const totalFechaNivel = nivel.aulas.reduce((sumAula, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sumAula + (asistenciaFecha?.presente || 0)
          }, 0)
          return sum + totalFechaNivel
        }, 0)
        totalGeneralRow.push(totalFecha)
      })

      totalGeneralRow.push(Number(totalGeneralAsistenPromed.toFixed(2))) // Asis.Pro.m = totalPresente / totalDiasAtencion
      totalGeneralRow.push(totalGeneralRegistros) // Reg.Pro.m = cantidad total de estudiantes
      
      const totalGeneralRegistrosAsistencia = totalGeneralPresente + totalGeneralPermiso + totalGeneralFalto
      const porcentajeAsistioGeneral = totalGeneralRegistrosAsistencia > 0
        ? ((totalGeneralPresente / totalGeneralRegistrosAsistencia) * 100).toFixed(2)
        : '0.00'
      const porcentajePermisoGeneral = totalGeneralRegistrosAsistencia > 0
        ? ((totalGeneralPermiso / totalGeneralRegistrosAsistencia) * 100).toFixed(2)
        : '0.00'
      const porcentajeFaltoGeneral = totalGeneralRegistrosAsistencia > 0
        ? ((totalGeneralFalto / totalGeneralRegistrosAsistencia) * 100).toFixed(2)
        : '0.00'
      totalGeneralRow.push(`${porcentajeAsistioGeneral}%`)
      totalGeneralRow.push(`${porcentajePermisoGeneral}%`)
      totalGeneralRow.push(`${porcentajeFaltoGeneral}%`)

      const totalGeneralRowIndex = rows.length
      rows.push(totalGeneralRow)

      // Número de filas del encabezado (título, info, fila vacía, header)
      const headerRows = responsable ? 7 : 5
      const headerRowIndex = headerRows - 1 // Índice de la fila de encabezado (0-based)

      // Preparar datos con encabezado (tres columnas)
      const encabezado = [
        [`Reporte de Asistencia por Nivel`],
        [],
        [`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, `AÑO: ${reporteData.year}`, `MES: ${monthNames[reporteData.month].toUpperCase()}`],
        ...(responsable ? [[`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, `EMAIL: ${responsable.email.toUpperCase()}`, `ROL: ${responsable.rol.toUpperCase()}`]] : []),
        [],
        header,
        ...rows,
      ]
      const ws = XLSX.utils.aoa_to_sheet(encabezado)
      
      // Aplicar estilos
      // Título
      ws['A1'].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }
      
      // Encabezado de tabla
      const headerRange = XLSX.utils.encode_range({ s: { c: 0, r: headerRowIndex }, e: { c: header.length - 1, r: headerRowIndex } })
      applyStyle(ws, headerRange, headerStyle)
      
      // Celdas de datos
      if (rows.length > 0) {
        const dataStartRow = headerRowIndex + 1
        const dataEndRow = headerRowIndex + rows.length
        const dataRange = XLSX.utils.encode_range({ s: { c: 0, r: dataStartRow }, e: { c: header.length - 1, r: dataEndRow } })
        applyStyle(ws, dataRange, cellStyle)
      }
      
      // Filas de subtotal
      subtotalRows.forEach((subtotalIndex) => {
        const subtotalRow = headerRowIndex + 1 + subtotalIndex
        const subtotalRange = XLSX.utils.encode_range({ s: { c: 0, r: subtotalRow }, e: { c: header.length - 1, r: subtotalRow } })
        applyStyle(ws, subtotalRange, subtotalStyle)
      })
      
      // Fila de Total General
      const totalGeneralRowExcel = headerRowIndex + 1 + totalGeneralRowIndex
      const totalGeneralRange = XLSX.utils.encode_range({ s: { c: 0, r: totalGeneralRowExcel }, e: { c: header.length - 1, r: totalGeneralRowExcel } })
      const totalGeneralStyle = {
        ...cellStyle,
        font: { bold: true },
        fill: { fgColor: { rgb: 'B4C6E7' } }, // Azul claro para diferenciarlo del subtotal
      }
      applyStyle(ws, totalGeneralRange, totalGeneralStyle)
      
      // Anchos de columna
      const colWidths = [
        { wch: 15 }, // Nivel
        { wch: 30 }, // TUTOR
        ...reporteData.fechasUnicas.map(() => ({ wch: 8 })), // Fechas
        { wch: 12 }, // Asis.Pro.m
        { wch: 12 }, // Reg.Pro.m
        { wch: 12 }, // % Asistió
        { wch: 12 }, // % Permiso
        { wch: 12 }, // % Faltó
      ]
      ws['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte por Nivel')

      // Descargar
      const nombreArchivo = `Reporte_Asistencia_por_Nivel_${reporteData.fcp.razon_social}_${monthNames[reporteData.month]}_${reporteData.year}.xlsx`
      XLSX.writeFile(wb, nombreArchivo)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error('Error al exportar a Excel', 'Intenta nuevamente.')
    }
  }

  const exportarPDF = async () => {
    if (!reporteData) return

    try {
      // Importar jsPDF
      const jsPDF = (await import('jspdf')).default
      
      // Importar jspdf-autotable (puede ser default o named export)
      const autotableModule = await import('jspdf-autotable')
      
      // Extraer autoTable del módulo (puede estar como named export o default)
      let autoTable: any = null
      if ((autotableModule as any).autoTable && typeof (autotableModule as any).autoTable === 'function') {
        autoTable = (autotableModule as any).autoTable
      } else if ((autotableModule as any).default && typeof (autotableModule as any).default === 'function') {
        autoTable = (autotableModule as any).default
      }
      
      // Intentar aplicar el plugin si existe applyPlugin
      if ((autotableModule as any).applyPlugin && typeof (autotableModule as any).applyPlugin === 'function') {
        (autotableModule as any).applyPlugin(jsPDF)
      }
      
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      
      // Log para debugging (remover en producción si es necesario)
      console.log('autoTable disponible:', typeof autoTable === 'function')
      console.log('doc.autoTable disponible:', typeof (doc as any).autoTable === 'function')
      const pageWidth = doc.internal.pageSize.getWidth()

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]

      let y = 12

      // Título
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Reporte de Asistencia por Nivel', pageWidth / 2, y, { align: 'center' })
      y += 4

      // Información general (dos columnas)
      doc.setFontSize(8)
      doc.setFont(undefined, 'normal')
      const col1 = 15
      const col2 = pageWidth / 3 + 10
      const col3 = (pageWidth / 3) * 2 + 10
      
      doc.text(`PROYECTO: ${reporteData.fcp.numero_identificacion || ''} ${reporteData.fcp.razon_social}`, col1, y)
      doc.text(`AÑO: ${reporteData.year}`, col2, y)
      doc.text(`MES: ${monthNames[reporteData.month].toUpperCase()}`, col3, y)
      y += 4
      if (responsable) {
        doc.text(`RESPONSABLE: ${responsable.nombre.toUpperCase()}`, col1, y)
        doc.text(`EMAIL: ${responsable.email.toUpperCase()}`, col2, y)
        doc.text(`ROL: ${responsable.rol.toUpperCase()}`, col3, y)
        y += 4
      }
      y += 4

      // Advertencia de días incompletos si existen
      if (reporteData.diasIncompletos.length > 0) {
        doc.setFontSize(9)
        doc.setTextColor(255, 140, 0) // Naranja
        doc.text('⚠️ Días con asistencia incompleta (no incluidos en totales):', 15, y)
        y += 5
        doc.setFontSize(8)
        const warningLines: string[] = []
        reporteData.diasIncompletos.slice(0, 5).forEach((dia) => {
          warningLines.push(`• ${dia.fechaFormateada} - ${dia.nivel} (${dia.marcados}/${dia.total})`)
        })
        if (reporteData.diasIncompletos.length > 5) {
          warningLines.push(`... y ${reporteData.diasIncompletos.length - 5} día(s) más`)
        }
        doc.text(warningLines, 20, y)
        y += warningLines.length * 4 + 3
        doc.setTextColor(0, 0, 0) // Volver a negro
      }

      // Preparar datos para la tabla
      const headers: string[] = [
        'Nivel',
        'TUTOR',
        ...reporteData.fechasUnicas.map(f => {
          // Parsear fecha manualmente para evitar problemas de zona horaria
          const [year, month, day] = f.split('-').map(Number)
          return day.toString()
        }),
        'Asis.Pro.m',
        'Reg.Pro.m',
        '% Asistió',
        '% Permiso',
        '% Faltó',
      ]

      const body: any[] = []

      reporteData.niveles.forEach((nivel) => {
        nivel.aulas.forEach((aula, aulaIndex) => {
          const row: any[] = [
            aulaIndex === 0 ? nivel.nivel : '', // Solo mostrar nivel en la primera fila
            aula.tutorNombre,
          ]

          // Agregar asistencias por fecha
          reporteData.fechasUnicas.forEach(fecha => {
            const asistenciaFecha = aula.asistencias[fecha]
            row.push(asistenciaFecha ? asistenciaFecha.presente.toString() : '')
          })

          // Totales
          row.push(aula.asistenPromed.toFixed(2)) // Asis.Pro.m = totalPresente / diasDeAtencion
          row.push(aula.totalRegistros.toString()) // Reg.Pro.m = cantidad de estudiantes del salón
          
          // Porcentajes basados en el total de registros (presente + permiso + falto)
          const totalRegistrosAsistencia = aula.totalPresente + aula.totalPermiso + aula.totalFalto
          const porcentajeAsistio = totalRegistrosAsistencia > 0
            ? ((aula.totalPresente / totalRegistrosAsistencia) * 100).toFixed(2)
            : '0.00'
          const porcentajePermiso = totalRegistrosAsistencia > 0
            ? ((aula.totalPermiso / totalRegistrosAsistencia) * 100).toFixed(2)
            : '0.00'
          const porcentajeFalto = totalRegistrosAsistencia > 0
            ? ((aula.totalFalto / totalRegistrosAsistencia) * 100).toFixed(2)
            : '0.00'
          row.push(`${porcentajeAsistio}%`)
          row.push(`${porcentajePermiso}%`)
          row.push(`${porcentajeFalto}%`)

          body.push(row)
        })

        // Fila de subtotal
        const subtotalRow: any[] = [
          nivel.nivel,
          'Subtotal',
        ]

        reporteData.fechasUnicas.forEach(fecha => {
          const totalFecha = nivel.aulas.reduce((sum, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sum + (asistenciaFecha?.presente || 0)
          }, 0)
          subtotalRow.push(totalFecha.toString())
        })

        subtotalRow.push(nivel.asistenPromed.toFixed(2)) // Asis.Pro.m = totalPresente / totalDiasAtencion
        subtotalRow.push(nivel.totalRegistros.toString()) // Reg.Pro.m = cantidad de estudiantes del nivel

        const totalRegistrosAsistenciaNivel = nivel.totalPresente + nivel.totalPermiso + nivel.totalFalto
        const porcentajeAsistioNivel = totalRegistrosAsistenciaNivel > 0
          ? ((nivel.totalPresente / totalRegistrosAsistenciaNivel) * 100).toFixed(2)
          : '0.00'
        const porcentajePermisoNivel = totalRegistrosAsistenciaNivel > 0
          ? ((nivel.totalPermiso / totalRegistrosAsistenciaNivel) * 100).toFixed(2)
          : '0.00'
        const porcentajeFaltoNivel = totalRegistrosAsistenciaNivel > 0
          ? ((nivel.totalFalto / totalRegistrosAsistenciaNivel) * 100).toFixed(2)
          : '0.00'
        subtotalRow.push(`${porcentajeAsistioNivel}%`)
        subtotalRow.push(`${porcentajePermisoNivel}%`)
        subtotalRow.push(`${porcentajeFaltoNivel}%`)

        body.push(subtotalRow)
      })

      // Calcular totales generales
      const totalGeneralPresente = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPresente, 0)
      const totalGeneralPermiso = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPermiso, 0)
      const totalGeneralFalto = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalFalto, 0)
      const totalGeneralRegistros = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalRegistros, 0)

      // Fila de Total General
      const totalGeneralRow: any[] = [
        'Total General',
        '',
      ]

      reporteData.fechasUnicas.forEach(fecha => {
        const totalFecha = reporteData.niveles.reduce((sum, nivel) => {
          const totalFechaNivel = nivel.aulas.reduce((sumAula, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sumAula + (asistenciaFecha?.presente || 0)
          }, 0)
          return sum + totalFechaNivel
        }, 0)
        totalGeneralRow.push(totalFecha.toString())
      })

      const totalGeneralDiasAtencion = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalDiasAtencion, 0)
      const totalGeneralAsistenPromed = totalGeneralDiasAtencion > 0
        ? totalGeneralPresente / totalGeneralDiasAtencion
        : 0
      totalGeneralRow.push(totalGeneralAsistenPromed.toFixed(2)) // Asis.Pro.m = totalPresente / totalDiasAtencion
      totalGeneralRow.push(totalGeneralRegistros.toString()) // Reg.Pro.m = cantidad total de estudiantes

      const totalGeneralRegistrosAsistencia = totalGeneralPresente + totalGeneralPermiso + totalGeneralFalto
      const porcentajeAsistioGeneral = totalGeneralRegistrosAsistencia > 0
        ? ((totalGeneralPresente / totalGeneralRegistrosAsistencia) * 100).toFixed(2)
        : '0.00'
      const porcentajePermisoGeneral = totalGeneralRegistrosAsistencia > 0
        ? ((totalGeneralPermiso / totalGeneralRegistrosAsistencia) * 100).toFixed(2)
        : '0.00'
      const porcentajeFaltoGeneral = totalGeneralRegistrosAsistencia > 0
        ? ((totalGeneralFalto / totalGeneralRegistrosAsistencia) * 100).toFixed(2)
        : '0.00'
      totalGeneralRow.push(`${porcentajeAsistioGeneral}%`)
      totalGeneralRow.push(`${porcentajePermisoGeneral}%`)
      totalGeneralRow.push(`${porcentajeFaltoGeneral}%`)

      body.push(totalGeneralRow)

      const numCols = headers.length
      const availableWidth = getAvailableTableWidth(doc, 15)
      const fontSize = getFontSizeForColumns(numCols)
      const columnConfigs: PDFTableColumnConfig[] = [
        { type: 'text', weight: 0.8, halign: 'left' },
        { type: 'text', weight: 1.2, halign: 'left' },
        ...reporteData.fechasUnicas.map(() => ({ type: 'compact' as const, weight: 0.4, halign: 'center' as const })),
        { type: 'numeric', weight: 0.6, halign: 'center' },
        { type: 'numeric', weight: 0.6, halign: 'center' },
        { type: 'numeric', weight: 0.5, halign: 'center' },
        { type: 'numeric', weight: 0.5, halign: 'center' },
        { type: 'numeric', weight: 0.5, halign: 'center' },
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
        didParseCell: function (data: any) {
          // Resaltar filas de subtotal y total general
          // En versión 5.x, verificar el texto de la celda actual o el contenido de la fila
          try {
            const cellText = (data.cell?.text?.toString() || data.cell?.text || '').toString().trim()
            
            // Si la celda contiene "Subtotal", aplicar estilos a toda la fila
            if (cellText === 'Subtotal') {
              data.cell.styles.fillColor = getPDFTotalRowColor()
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.textColor = getPDFCellTextColor()
              return
            }
            
            // Si la celda contiene "Total General", aplicar estilos más destacados
            if (cellText === 'Total General') {
              data.cell.styles.fillColor = getPDFTotalRowColor()
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.textColor = getPDFCellTextColor()
              return
            }
            
            // Intentar verificar si alguna celda de la fila contiene "Subtotal" o "Total General"
            // En versión 5.x, data puede tener diferentes estructuras
            if (data.table && data.table.body) {
              const rowIndex = data.rowIndex
              if (rowIndex !== undefined && rowIndex >= 0) {
                const row = data.table.body[rowIndex]
                if (row) {
                  // row puede ser un array de celdas o un objeto con celdas
                  const cells = Array.isArray(row) ? row : (row.cells || Object.values(row))
                  if (Array.isArray(cells)) {
                    const hasSubtotal = cells.some((cell: any) => {
                      const text = (cell?.text?.toString() || cell?.text || cell?.toString() || '').toString().trim()
                      return text === 'Subtotal'
                    })
                    
                    const hasTotalGeneral = cells.some((cell: any) => {
                      const text = (cell?.text?.toString() || cell?.text || cell?.toString() || '').toString().trim()
                      return text === 'Total General'
                    })
                    
                    if (hasSubtotal) {
                      data.cell.styles.fillColor = getPDFTotalRowColor()
                      data.cell.styles.fontStyle = 'bold'
                      data.cell.styles.textColor = getPDFCellTextColor()
                    } else if (hasTotalGeneral) {
                      data.cell.styles.fillColor = getPDFTotalRowColor()
                      data.cell.styles.fontStyle = 'bold'
                      data.cell.styles.textColor = getPDFCellTextColor()
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Si hay error, simplemente no aplicar estilos especiales
            console.warn('Error en didParseCell:', e)
          }
        },
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
      const nombreArchivo = `Reporte_Asistencia_por_Nivel_${reporteData.fcp.razon_social}_${monthNames[reporteData.month]}_${reporteData.year}.pdf`
      doc.save(nombreArchivo)
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error('Error al exportar a PDF', 'Intenta nuevamente.')
    }
  }

  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${monthNames[month]} ${year}`
  }

  if (!selectedFCP && userFCPs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            Cargando FCPs...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!roleLoading && !canViewReports) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
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
          <CardTitle>Configurar Reporte de Asistencia por Nivel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector de FCP para facilitadores y otros roles (si no viene desde prop) */}
            {!fcpIdProp && userFCPs.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Proyecto (FCP):</label>
                <Select
                  value={selectedFCP || ''}
                  onValueChange={(value) => {
                    setSelectedFCP(value)
                    if (isFacilitador) {
                      setReporteData(null) // Limpiar reporte anterior al cambiar FCP
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar proyecto">
                      {selectedFCP ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">{userFCPs.find(fcp => fcp.id === selectedFCP)?.nombre || 'Seleccionar proyecto'}</span>
                        </div>
                      ) : (
                        'Seleccionar proyecto'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                  {userFCPs.map((fcp) => (
                      <SelectItem key={fcp.id} value={fcp.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{fcp.nombre}</span>
                          {fcp.numero_identificacion && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">({fcp.numero_identificacion})</span>
                          )}
                        </div>
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
                    <Calendar className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </>
                )}
              </Button>
              {isFacilitador && !selectedFCP && (
                <p className="text-sm text-muted-foreground mt-2">
                  Por favor, selecciona un proyecto para generar el reporte.
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
          style={{
            width: tableWidth ? `${tableWidth}px` : defaultWidthRef.current ? `${defaultWidthRef.current}px` : '100%',
            maxWidth: tableWidth ? `${tableWidth}px` : defaultWidthRef.current ? `${defaultWidthRef.current}px` : '100%',
            overflow: 'visible',
          }}
        >
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
          <CardHeader>
            <div className="flex flex-col gap-4 sm:gap-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle>Reporte de Asistencia por Nivel</CardTitle>
                <div className="text-sm text-muted-foreground mt-1 grid grid-cols-1 gap-y-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                  <p><strong>PROYECTO:</strong> {reporteData.fcp.numero_identificacion || ''} {reporteData.fcp.razon_social}</p>
                  <p><strong>AÑO:</strong> {reporteData.year}</p>
                  <p><strong>MES:</strong> {formatMonthYear(reporteData.month, reporteData.year).split(' ')[0].toUpperCase()}</p>
                  {responsable && (
                    <>
                      <p><strong>RESPONSABLE:</strong> {responsable.nombre.toUpperCase()}</p>
                      <p><strong>EMAIL:</strong> {responsable.email.toUpperCase()}</p>
                      <p><strong>ROL:</strong> {responsable.rol.toUpperCase()}</p>
                    </>
                  )}
                </div>
              </div>
              <RoleGuard fcpId={selectedFCP} allowedRoles={['facilitador', 'director', 'secretario']}>
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
              <span className="text-xs text-muted-foreground">
                {tableWidth ? `Ancho tabla: ${tableWidth}px | ` : ''}
                Arrastra el borde derecho para expandir. Shift + scroll o arrastra para desplazamiento horizontal.
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mensaje de días incompletos */}
            {reporteData.diasIncompletos.length > 0 && (
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
                          • <strong>{dia.fechaFormateada}</strong> - Nivel: <strong>{dia.nivel}</strong> 
                          {' '}(Tutor: {dia.tutorNombre}) - Marcados: {dia.marcados}/{dia.total} estudiantes
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

            {isMobile ? (
              (() => {
                const flatAulas: Array<{ nivel: string; aula: typeof reporteData.niveles[0]['aulas'][0] }> = []
                reporteData.niveles.forEach((n) => {
                  n.aulas.forEach((a) => flatAulas.push({ nivel: n.nivel, aula: a }))
                })
                const filtered = mobileSearch.trim()
                  ? flatAulas.filter(
                      (f) =>
                        f.nivel.toLowerCase().includes(mobileSearch.toLowerCase()) ||
                        f.aula.tutorNombre.toLowerCase().includes(mobileSearch.toLowerCase())
                    )
                  : flatAulas
                const perPage = 8
                const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
                const display = filtered.slice((mobilePage - 1) * perPage, mobilePage * perPage)
                const pctAsistio = (a: typeof flatAulas[0]['aula']) => {
                  const t = a.totalPresente + a.totalPermiso + a.totalFalto
                  return t > 0 ? ((a.totalPresente / t) * 100).toFixed(1) : '0'
                }
                const pctPermiso = (a: typeof flatAulas[0]['aula']) => {
                  const t = a.totalPresente + a.totalPermiso + a.totalFalto
                  return t > 0 ? ((a.totalPermiso / t) * 100).toFixed(1) : '0'
                }
                const pctFalto = (a: typeof flatAulas[0]['aula']) => {
                  const t = a.totalPresente + a.totalPermiso + a.totalFalto
                  return t > 0 ? ((a.totalFalto / t) * 100).toFixed(1) : '0'
                }
                return (
                  <div className="space-y-4">
                    <div className="relative">
                      <Input placeholder="Buscar por nivel o tutor..." value={mobileSearch} onChange={(e) => { setMobileSearch(e.target.value); setMobilePage(1) }} className="pl-9" />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      {display.map(({ nivel, aula }) => {
                        const key = `${nivel}-${aula.aulaId}`
                        const isExpanded = expandedCardId === key
                        return (
                          <Card key={key}>
                            <div className="p-4 cursor-pointer" onClick={() => setExpandedCardId(isExpanded ? null : key)}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{nivel}</p>
                                  <p className="text-sm text-muted-foreground">{aula.tutorNombre}</p>
                                  <div className="flex gap-3 mt-2 text-sm flex-wrap">
                                    <span>Asis.Pro.m: {aula.asistenPromed.toFixed(2)}</span>
                                    <span>Reg: {aula.totalRegistros}</span>
                                    <span className="text-green-600">{pctAsistio(aula)}% asistió</span>
                                    <span className="text-amber-600">{pctPermiso(aula)}% permiso</span>
                                    <span className="text-red-600">{pctFalto(aula)}% faltó</span>
                                  </div>
                                </div>
                                {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                              </div>
                              {isExpanded && reporteData.fechasUnicas && (
                                <div className="mt-4 pt-3 border-t grid grid-cols-7 gap-1">
                                  {reporteData.fechasUnicas.map((fecha) => {
                                    const a = aula.asistencias[fecha]
                                    const [y, m, d] = fecha.split('-').map(Number)
                                    return (
                                      <div key={fecha} className="text-center py-1 rounded text-xs bg-muted" title={fecha}>
                                        <span className="block font-medium">{d}</span>
                                        <span>{a ? a.presente : '—'}</span>
                                      </div>
                                    )
                                  })}
                                </div>
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
                          <Button variant="outline" size="sm" disabled={mobilePage <= 1} onClick={() => setMobilePage((p) => Math.max(1, p - 1))}>Anterior</Button>
                          <Button variant="outline" size="sm" disabled={mobilePage >= totalPages} onClick={() => setMobilePage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()
            ) : (
            <>
            <p className="mb-2 text-xs text-muted-foreground md:hidden">Desliza para ver más columnas →</p>
            <div
              ref={tableContainerRef}
              className="table-responsive overflow-x-auto select-none"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
              onMouseUp={() => { if (isDragging) setIsDragging(false) }}
              onMouseLeave={() => { if (isDragging) setIsDragging(false) }}
            >
              <table className="w-full border-collapse border border-border text-sm" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border p-2 bg-muted/50 text-left text-foreground">Nivel</th>
                    <th className="border border-border p-2 bg-muted/50 text-left text-foreground">TUTOR</th>
                    {reporteData.fechasUnicas.map((fecha) => {
                      // Parsear fecha manualmente para evitar problemas de zona horaria
                      const [year, month, day] = fecha.split('-').map(Number)
                      return (
                        <th
                          key={fecha}
                          className="border border-border px-1.5 py-2 bg-muted/50 text-center min-w-[28px] w-9 text-foreground"
                        >
                          {day}
                        </th>
                      )
                    })}
                    <th className="border border-border p-2 bg-muted/50 text-center text-foreground">Asis.Pro.m</th>
                    <th className="border border-border p-2 bg-muted/50 text-center text-foreground">Reg.Pro.m</th>
                    <th className="border border-border p-2 bg-muted/50 text-center text-foreground">% Asistió</th>
                    <th className="border border-border p-2 bg-muted/50 text-center text-foreground">% Permiso</th>
                    <th className="border border-border p-2 bg-muted/50 text-center text-foreground">% Faltó</th>
                  </tr>
                </thead>
                <tbody>
                  {reporteData.niveles.map((nivel, nivelIndex) => (
                    <React.Fragment key={nivel.nivel}>
                      {nivel.aulas.map((aula, aulaIndex) => (
                        <tr key={`${aula.aulaId}-${aulaIndex}`} className={`border-b border-border ${aulaIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent/50`}>
                          <td className="border border-border p-2 font-semibold text-foreground">
                            {aulaIndex === 0 ? nivel.nivel : ''}
                          </td>
                          <td className="border border-border p-2 text-foreground">{aula.tutorNombre}</td>
                          {reporteData.fechasUnicas.map((fecha) => {
                            const asistenciaFecha = aula.asistencias[fecha]
                            return (
                              <td
                                key={fecha}
                                className="border border-border px-1.5 py-2 text-center text-foreground min-w-[28px] w-9"
                              >
                                {asistenciaFecha ? asistenciaFecha.presente : ''}
                              </td>
                            )
                          })}
                          <td className="border border-border p-2 text-center font-semibold text-foreground">
                            {aula.asistenPromed.toFixed(2)}
                          </td>
                          <td className="border border-border p-2 text-center font-semibold text-foreground">
                            {aula.totalRegistros}
                          </td>
                          <td className="border border-border p-2 text-center font-semibold text-foreground">
                            {(() => {
                              try {
                                const presente = typeof aula.totalPresente === 'number' ? aula.totalPresente : (Number(aula.totalPresente) || 0)
                                const permiso = typeof aula.totalPermiso === 'number' ? aula.totalPermiso : (Number(aula.totalPermiso) || 0)
                                const falto = typeof aula.totalFalto === 'number' ? aula.totalFalto : (Number(aula.totalFalto) || 0)
                                const totalRegistrosAsistencia = presente + permiso + falto
                                if (totalRegistrosAsistencia === 0) return '0.00'
                                const porcentaje = (presente / totalRegistrosAsistencia) * 100
                                if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                                return porcentaje.toFixed(2)
                              } catch (e) {
                                return '0.00'
                              }
                            })()}%
                          </td>
                          <td className="border border-border p-2 text-center font-semibold text-foreground">
                            {(() => {
                              try {
                                const presente = typeof aula.totalPresente === 'number' ? aula.totalPresente : (Number(aula.totalPresente) || 0)
                                const permiso = typeof aula.totalPermiso === 'number' ? aula.totalPermiso : (Number(aula.totalPermiso) || 0)
                                const falto = typeof aula.totalFalto === 'number' ? aula.totalFalto : (Number(aula.totalFalto) || 0)
                                const totalRegistrosAsistencia = presente + permiso + falto
                                if (totalRegistrosAsistencia === 0) return '0.00'
                                const porcentaje = (permiso / totalRegistrosAsistencia) * 100
                                if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                                return porcentaje.toFixed(2)
                              } catch (e) {
                                return '0.00'
                              }
                            })()}%
                          </td>
                          <td className="border border-border p-2 text-center font-semibold text-foreground">
                            {(() => {
                              try {
                                const presente = typeof aula.totalPresente === 'number' ? aula.totalPresente : (Number(aula.totalPresente) || 0)
                                const permiso = typeof aula.totalPermiso === 'number' ? aula.totalPermiso : (Number(aula.totalPermiso) || 0)
                                const falto = typeof aula.totalFalto === 'number' ? aula.totalFalto : (Number(aula.totalFalto) || 0)
                                const totalRegistrosAsistencia = presente + permiso + falto
                                if (totalRegistrosAsistencia === 0) return '0.00'
                                const porcentaje = (falto / totalRegistrosAsistencia) * 100
                                if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                                return porcentaje.toFixed(2)
                              } catch (e) {
                                return '0.00'
                              }
                            })()}%
                          </td>
                        </tr>
                      ))}
                      {/* Fila de subtotal */}
                      <tr className="bg-muted font-bold">
                        <td className="border border-border p-2 text-foreground">{nivel.nivel}</td>
                        <td className="border border-border p-2 text-foreground">Subtotal</td>
                        {reporteData.fechasUnicas.map((fecha) => {
                          const totalFecha = nivel.aulas.reduce((sum, a) => {
                            const asistenciaFecha = a.asistencias[fecha]
                            return sum + (asistenciaFecha?.presente || 0)
                          }, 0)
                          return (
                            <td
                              key={fecha}
                              className="border border-border px-1.5 py-2 text-center text-foreground min-w-[28px] w-9"
                            >
                              {totalFecha}
                            </td>
                          )
                        })}
                        <td className="border border-border p-2 text-center text-foreground">{nivel.asistenPromed.toFixed(2)}</td>
                        <td className="border border-border p-2 text-center text-foreground">{nivel.totalRegistros}</td>
                        <td className="border border-border p-2 text-center text-foreground">
                          {(() => {
                            try {
                              const presente = typeof nivel.totalPresente === 'number' ? nivel.totalPresente : (Number(nivel.totalPresente) || 0)
                              const permiso = typeof nivel.totalPermiso === 'number' ? nivel.totalPermiso : (Number(nivel.totalPermiso) || 0)
                              const falto = typeof nivel.totalFalto === 'number' ? nivel.totalFalto : (Number(nivel.totalFalto) || 0)
                              const totalRegistrosAsistenciaNivel = presente + permiso + falto
                              if (totalRegistrosAsistenciaNivel === 0) return '0.00'
                              const porcentaje = (presente / totalRegistrosAsistenciaNivel) * 100
                              if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                              return porcentaje.toFixed(2)
                            } catch (e) {
                              return '0.00'
                            }
                          })()}%
                        </td>
                        <td className="border border-border p-2 text-center text-foreground">
                          {(() => {
                            try {
                              const presente = typeof nivel.totalPresente === 'number' ? nivel.totalPresente : (Number(nivel.totalPresente) || 0)
                              const permiso = typeof nivel.totalPermiso === 'number' ? nivel.totalPermiso : (Number(nivel.totalPermiso) || 0)
                              const falto = typeof nivel.totalFalto === 'number' ? nivel.totalFalto : (Number(nivel.totalFalto) || 0)
                              const totalRegistrosAsistenciaNivel = presente + permiso + falto
                              if (totalRegistrosAsistenciaNivel === 0) return '0.00'
                              const porcentaje = (permiso / totalRegistrosAsistenciaNivel) * 100
                              if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                              return porcentaje.toFixed(2)
                            } catch (e) {
                              return '0.00'
                            }
                          })()}%
                        </td>
                        <td className="border border-border p-2 text-center text-foreground">
                          {(() => {
                            try {
                              const presente = typeof nivel.totalPresente === 'number' ? nivel.totalPresente : (Number(nivel.totalPresente) || 0)
                              const permiso = typeof nivel.totalPermiso === 'number' ? nivel.totalPermiso : (Number(nivel.totalPermiso) || 0)
                              const falto = typeof nivel.totalFalto === 'number' ? nivel.totalFalto : (Number(nivel.totalFalto) || 0)
                              const totalRegistrosAsistenciaNivel = presente + permiso + falto
                              if (totalRegistrosAsistenciaNivel === 0) return '0.00'
                              const porcentaje = (falto / totalRegistrosAsistenciaNivel) * 100
                              if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                              return porcentaje.toFixed(2)
                            } catch (e) {
                              return '0.00'
                            }
                          })()}%
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {/* Fila de Total General */}
                  {(() => {
                    // Calcular totales generales sumando todos los niveles
                    const totalGeneralPresente = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPresente, 0)
                    const totalGeneralPermiso = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPermiso, 0)
                    const totalGeneralFalto = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalFalto, 0)
                    const totalGeneralRegistros = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalRegistros, 0)
                    const totalGeneralDiasAtencion = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalDiasAtencion, 0)
                    const totalGeneralAsistenPromed = totalGeneralDiasAtencion > 0
                      ? totalGeneralPresente / totalGeneralDiasAtencion
                      : 0
                    
                    return (
                      <tr className="bg-accent font-bold">
                        <td className="border border-border p-2 text-foreground">Total General</td>
                        <td className="border border-border p-2 text-foreground"></td>
                        {reporteData.fechasUnicas.map((fecha) => {
                          const totalFecha = reporteData.niveles.reduce((sum, nivel) => {
                            const totalFechaNivel = nivel.aulas.reduce((sumAula, a) => {
                              const asistenciaFecha = a.asistencias[fecha]
                              return sumAula + (asistenciaFecha?.presente || 0)
                            }, 0)
                            return sum + totalFechaNivel
                          }, 0)
                          return (
                            <td
                              key={fecha}
                              className="border border-border px-1.5 py-2 text-center text-foreground min-w-[28px] w-9"
                            >
                              {totalFecha}
                            </td>
                          )
                        })}
                        <td className="border border-border p-2 text-center text-foreground">{totalGeneralAsistenPromed.toFixed(2)}</td>
                        <td className="border border-border p-2 text-center text-foreground">{totalGeneralRegistros}</td>
                        <td className="border border-border p-2 text-center text-foreground">
                          {(() => {
                            try {
                              const presente = typeof totalGeneralPresente === 'number' ? totalGeneralPresente : (Number(totalGeneralPresente) || 0)
                              const permiso = typeof totalGeneralPermiso === 'number' ? totalGeneralPermiso : (Number(totalGeneralPermiso) || 0)
                              const falto = typeof totalGeneralFalto === 'number' ? totalGeneralFalto : (Number(totalGeneralFalto) || 0)
                              const totalGeneralRegistrosAsistencia = presente + permiso + falto
                              if (totalGeneralRegistrosAsistencia === 0) return '0.00'
                              const porcentaje = (presente / totalGeneralRegistrosAsistencia) * 100
                              if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                              return porcentaje.toFixed(2)
                            } catch (e) {
                              return '0.00'
                            }
                          })()}%
                        </td>
                        <td className="border border-border p-2 text-center text-foreground">
                          {(() => {
                            try {
                              const presente = typeof totalGeneralPresente === 'number' ? totalGeneralPresente : (Number(totalGeneralPresente) || 0)
                              const permiso = typeof totalGeneralPermiso === 'number' ? totalGeneralPermiso : (Number(totalGeneralPermiso) || 0)
                              const falto = typeof totalGeneralFalto === 'number' ? totalGeneralFalto : (Number(totalGeneralFalto) || 0)
                              const totalGeneralRegistrosAsistencia = presente + permiso + falto
                              if (totalGeneralRegistrosAsistencia === 0) return '0.00'
                              const porcentaje = (permiso / totalGeneralRegistrosAsistencia) * 100
                              if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                              return porcentaje.toFixed(2)
                            } catch (e) {
                              return '0.00'
                            }
                          })()}%
                        </td>
                        <td className="border border-border p-2 text-center text-foreground">
                          {(() => {
                            try {
                              const presente = typeof totalGeneralPresente === 'number' ? totalGeneralPresente : (Number(totalGeneralPresente) || 0)
                              const permiso = typeof totalGeneralPermiso === 'number' ? totalGeneralPermiso : (Number(totalGeneralPermiso) || 0)
                              const falto = typeof totalGeneralFalto === 'number' ? totalGeneralFalto : (Number(totalGeneralFalto) || 0)
                              const totalGeneralRegistrosAsistencia = presente + permiso + falto
                              if (totalGeneralRegistrosAsistencia === 0) return '0.00'
                              const porcentaje = (falto / totalGeneralRegistrosAsistencia) * 100
                              if (isNaN(porcentaje) || !isFinite(porcentaje)) return '0.00'
                              return porcentaje.toFixed(2)
                            } catch (e) {
                              return '0.00'
                            }
                          })()}%
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
            </>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}

