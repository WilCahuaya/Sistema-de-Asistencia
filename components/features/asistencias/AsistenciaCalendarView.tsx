'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle, Clock, CheckCheck, X, Info, Calendar, Search } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MonthPicker } from '@/components/ui/month-picker'
import { AsistenciaHistorialDialog } from './AsistenciaHistorialDialog'
import { AsistenciaCalendarioModal } from './AsistenciaCalendarioModal'
import { useCorreccionMes, esMesPasado } from '@/hooks/useCorreccionMes'
import { CorreccionMesBanner } from './CorreccionMesBanner'
import { HabilitarCorreccionDialog } from './HabilitarCorreccionDialog'
import { Badge } from '@/components/ui/badge'
import { Unlock, UserPlus, User } from 'lucide-react'
import { AgregarEstudianteMesDialog } from './AgregarEstudianteMesDialog'
import { QuitarEstudianteMesDialog } from './QuitarEstudianteMesDialog'
import { MoverEstudianteMesDialog } from './MoverEstudianteMesDialog'
import { toast } from '@/lib/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface Asistencia {
  id: string
  estudiante_id: string
  fecha: string
  estado: 'presente' | 'falto' | 'permiso'
  aula_id?: string
  observaciones?: string
  fcp_id?: string
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
  // Campos de auditoría directos (guardados en la BD)
  created_by_nombre?: string | null
  created_by_email?: string | null
  created_by_rol?: string | null
  updated_by_nombre?: string | null
  updated_by_email?: string | null
  updated_by_rol?: string | null
  registro_tardio?: boolean
  // Campos legacy (para compatibilidad con código antiguo)
  creador?: {
    email?: string
    nombre_completo?: string
    rol?: string | null
  }
  editor?: {
    email?: string
    nombre_completo?: string
    rol?: string | null
  }
}

interface AsistenciaCalendarViewProps {
  fcpId: string
  aulaId?: string | null
  initialMonth?: number | null
  initialYear?: number | null
}

type AsistenciaEstado = 'presente' | 'falto' | 'permiso' | null

export function AsistenciaCalendarView({ fcpId, aulaId, initialMonth, initialYear }: AsistenciaCalendarViewProps) {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [asistencias, setAsistencias] = useState<Map<string, Asistencia>>(new Map())
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth !== null && initialMonth !== undefined ? initialMonth : new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(initialYear !== null && initialYear !== undefined ? initialYear : new Date().getFullYear())
  const [selectedAula, setSelectedAula] = useState<string | null>(aulaId || null)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [tutorNombre, setTutorNombre] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [savingDates, setSavingDates] = useState<Set<string>>(new Set()) // Para rastrear qué fechas están guardándose
  const [zoomLevel, setZoomLevel] = useState(1) // Nivel de zoom para la tabla
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [tableWidth, setTableWidth] = useState<number | null>(null) // Ancho personalizado de la tabla
  const [isResizingTable, setIsResizingTable] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [historialDialogOpen, setHistorialDialogOpen] = useState(false)
  const [selectedAsistenciaForHistorial, setSelectedAsistenciaForHistorial] = useState<Asistencia | null>(null)
  const [habilitarCorreccionOpen, setHabilitarCorreccionOpen] = useState(false)
  const [agregarEstudianteMesOpen, setAgregarEstudianteMesOpen] = useState(false)
  const [quitarEstudianteMesOpen, setQuitarEstudianteMesOpen] = useState(false)
  const [selectedEstudianteForQuitar, setSelectedEstudianteForQuitar] = useState<Estudiante | null>(null)
  const [moverEstudianteMesOpen, setMoverEstudianteMesOpen] = useState(false)
  const [selectedEstudianteForMover, setSelectedEstudianteForMover] = useState<Estudiante | null>(null)
  const [periodosQuitables, setPeriodosQuitables] = useState<Map<string, string>>(new Map())
  const [fechaParaEliminar, setFechaParaEliminar] = useState<string | null>(null)
  const [showAbbreviatedSticky, setShowAbbreviatedSticky] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedEstudianteForModal, setSelectedEstudianteForModal] = useState<Estudiante | null>(null)
  const [mobilePage, setMobilePage] = useState(1)
  const [mobileSearch, setMobileSearch] = useState('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const defaultWidthRef = useRef<number | null>(null) // Ancho por defecto del contenedor
  
  // Efecto para obtener el ancho por defecto del div contenedor (mb-8 mx-auto max-w-7xl)
  useEffect(() => {
    const updateDefaultWidth = () => {
      // Buscar el div contenedor con las clases mb-8 mx-auto max-w-7xl (donde está el título)
      const titleContainer = document.querySelector('div.mb-8.mx-auto.max-w-7xl')
      
      if (titleContainer) {
        const rect = titleContainer.getBoundingClientRect()
        if (defaultWidthRef.current === null || defaultWidthRef.current !== rect.width) {
          defaultWidthRef.current = rect.width
          // Si no hay un ancho personalizado, actualizar el ancho de la tabla
          if (!tableWidth) {
            // Forzar re-render actualizando el estado (aunque no cambie el valor)
            setTableWidth(null)
          }
        }
      } else {
        // Fallback: buscar el div contenedor con las clases mx-auto max-w-7xl
        const container = document.querySelector('div.mx-auto.max-w-7xl')
        
        if (container) {
          const rect = container.getBoundingClientRect()
          if (defaultWidthRef.current === null || defaultWidthRef.current !== rect.width) {
            defaultWidthRef.current = rect.width
            if (!tableWidth) {
              setTableWidth(null)
            }
          }
        } else {
          // Fallback final: usar el ancho de la ventana menos padding (1280px es max-w-7xl)
          const fallbackWidth = Math.min(1280, window.innerWidth - 64)
          if (defaultWidthRef.current === null || defaultWidthRef.current !== fallbackWidth) {
            defaultWidthRef.current = fallbackWidth
            if (!tableWidth) {
              setTableWidth(null)
            }
          }
        }
      }
    }
    
    // Ejecutar inmediatamente y luego en cada resize
    updateDefaultWidth()
    const timer = setTimeout(updateDefaultWidth, 50) // Reducir delay para detectar más rápido
    window.addEventListener('resize', updateDefaultWidth)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateDefaultWidth)
    }
  }, [tableWidth])

  // Sincronizar showAbbreviatedSticky con scroll en móvil; en desktop siempre full
  useEffect(() => {
    const sync = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 640) {
        setShowAbbreviatedSticky(false)
      } else {
        const el = tableContainerRef.current
        if (el) setShowAbbreviatedSticky(el.scrollLeft >= 40)
      }
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [estudiantes.length])

  // Detectar móvil para vista de cards
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  
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

    const handleMouseUp = () => {
      setIsResizingTable(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingTable, resizeStartX, resizeStartWidth])
  
  const longPressTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const prevAulaRef = useRef<string | null>(null) // Para detectar cambios de aula
  const { canEdit, role } = useUserRole(fcpId)
  const mesNum = selectedMonth + 1
  const { data: correccionMes, loading: correccionLoading, refetch: refetchCorreccion } = useCorreccionMes(fcpId, selectedYear, mesNum)
  const esMesPasadoVista = esMesPasado(selectedYear, mesNum)
  const correccionHabilitada = correccionMes?.estado === 'correccion_habilitada'
  const puedeEditarMes =
    (() => {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      const vista = selectedYear * 12 + selectedMonth
      const actual = y * 12 + m
      if (vista > actual) return canEdit && (role === 'director' || role === 'secretario')
      if (vista === actual) return canEdit && (role === 'director' || role === 'secretario')
      // Cualquier mes pasado: secretario o director, solo si el facilitador habilitó la corrección
      if (vista < actual && correccionHabilitada && (role === 'secretario' || role === 'director')) return true
      return false
    })()
  const showHabilitarCorreccion =
    role === 'facilitador' &&
    esMesPasadoVista &&
    (correccionMes?.estado === 'cerrado' || correccionMes?.estado === 'bloqueado')

  const showAgregarEstudianteMes =
    esMesPasadoVista &&
    correccionHabilitada &&
    (role === 'director' || role === 'secretario') &&
    !!selectedAula

  const showQuitarEstudianteMes = showAgregarEstudianteMes

  // Función helper para convertir Date a string YYYY-MM-DD en zona horaria local
  const formatDateToLocalString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Generar días del mes seleccionado
  const getDaysInMonth = (month: number, year: number) => {
    const daysCount = new Date(year, month + 1, 0).getDate()
    const days: Array<{ day: number; date: Date; dayName: string; fechaStr: string }> = []
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    
    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(year, month, day)
      days.push({
        day,
        date,
        dayName: dayNames[date.getDay()],
        fechaStr: formatDateToLocalString(date),
      })
    }
    return days
  }

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)

  useEffect(() => {
    if (fcpId) {
      loadAulas()
    }
  }, [fcpId])

  // Actualizar aula seleccionada cuando cambia el prop aulaId
  useEffect(() => {
    if (aulaId && aulaId !== selectedAula) {
      setSelectedAula(aulaId)
    }
  }, [aulaId])

  // Actualizar mes y año cuando cambian los props initialMonth e initialYear
  useEffect(() => {
    if (initialMonth !== null && initialMonth !== undefined && initialMonth !== selectedMonth) {
      setSelectedMonth(initialMonth)
    }
    if (initialYear !== null && initialYear !== undefined && initialYear !== selectedYear) {
      setSelectedYear(initialYear)
    }
  }, [initialMonth, initialYear])

  useEffect(() => {
    setMobilePage(1)
    setMobileSearch('')
  }, [selectedAula, selectedMonth, selectedYear])

  useEffect(() => {
    if (selectedAula) {
      // Si cambió el aula, limpiar asistencias y estudiantes ANTES de cargar nuevos
      if (prevAulaRef.current !== null && prevAulaRef.current !== selectedAula) {
        console.log('🔄 Aula cambió de', prevAulaRef.current.substring(0, 8), 'a', selectedAula.substring(0, 8), '- limpiando asistencias y estudiantes')
        setAsistencias(new Map())
        setEstudiantes([]) // Limpiar estudiantes también para forzar recarga
      }
      prevAulaRef.current = selectedAula
      
      // Cargar estudiantes para la nueva aula
      loadEstudiantes()
    } else {
      // Solo limpiar si no hay aula seleccionada
      prevAulaRef.current = null
      setEstudiantes([])
      setAsistencias(new Map())
    }
  }, [selectedAula, fcpId]) // Remover selectedMonth y selectedYear de aquí - no deberían limpiar estudiantes

  // No permitir meses futuros: sin asistencia en meses posteriores
  useEffect(() => {
    const now = new Date()
    const mesActual = now.getMonth()
    const anioActual = now.getFullYear()
    if (selectedYear > anioActual || (selectedYear === anioActual && selectedMonth > mesActual)) {
      setSelectedYear(anioActual)
      setSelectedMonth(mesActual)
    }
  }, [selectedMonth, selectedYear])

  // Efecto separado para recargar estudiantes y asistencias cuando cambia el mes/año
  useEffect(() => {
    if (selectedAula) {
      console.log('🔄 Mes/año cambió, recargando estudiantes y asistencias')
      loadEstudiantes()
    }
  }, [selectedMonth, selectedYear])

  // Efecto principal para cargar asistencias cuando hay estudiantes y aula
  // Este efecto se ejecuta cuando cambian los estudiantes (después de cargarse)
  useEffect(() => {
    if (selectedAula && estudiantes.length > 0) {
      // Verificar que los estudiantes correspondan al aula actual
      // Esto evita cargar asistencias con estudiantes de otra aula
      console.log('🔄 Efecto de carga de asistencias activado:', {
        aula: selectedAula,
        estudiantesCount: estudiantes.length,
        muestraEstudianteIds: estudiantes.slice(0, 3).map(e => e.id.substring(0, 8))
      })
      
      // Usar un pequeño delay para asegurar que los estudiantes se hayan actualizado completamente
      const timer = setTimeout(() => {
        loadAsistenciasMes()
      }, 150) // Aumentar delay para asegurar que los estudiantes se actualizaron
      
      return () => clearTimeout(timer)
    } else {
      // Solo limpiar asistencias si realmente no hay aula
      // NO limpiar si solo está cambiando el mes/año o si aún no se han cargado estudiantes
      if (!selectedAula) {
        setAsistencias(new Map())
      }
      // Si hay aula pero no estudiantes todavía, no limpiar - esperar a que se carguen
    }
  }, [selectedAula, fcpId, estudiantes]) // Usar estudiantes como dependencia completa, no solo length

  // Efecto para verificar que las asistencias se mantengan después de cargar
  useEffect(() => {
    if (asistencias.size > 0 && estudiantes.length > 0) {
      console.log('✅ Estado de asistencias verificado:', {
        totalAsistencias: asistencias.size,
        totalEstudiantes: estudiantes.length,
        muestraKeys: Array.from(asistencias.keys()).slice(0, 5),
        fechasUnicas: [...new Set(Array.from(asistencias.keys()).map(k => k.split('_')[1]))].sort()
      })
    }
  }, [asistencias, estudiantes.length])

  const loadAulas = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', fcpId)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (error) throw error
      setAulas(data || [])
      
      // Si hay aulaId prop y no hay aula seleccionada, seleccionarla
      if (aulaId && !selectedAula) {
        setSelectedAula(aulaId)
      } else if (data && data.length > 0 && !selectedAula) {
        setSelectedAula(data[0].id)
      }
    } catch (error) {
      console.error('Error loading aulas:', error)
    }
  }

  // Cargar tutor del aula seleccionada
  useEffect(() => {
    if (!selectedAula || !fcpId) {
      setTutorNombre(null)
      return
    }
    const loadTutor = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('tutor_aula')
        .select(`
          fcp_miembro:fcp_miembros(
            usuario:usuarios(nombre_completo, email)
          )
        `)
        .eq('aula_id', selectedAula)
        .eq('fcp_id', fcpId)
        .eq('activo', true)
        .limit(1)
        .maybeSingle()
      const fcpMiembro = (data as any)?.fcp_miembro
      const usuario = fcpMiembro?.usuario
      const nombre = usuario?.nombre_completo || usuario?.email || null
      setTutorNombre(nombre)
    }
    loadTutor()
  }, [selectedAula, fcpId])

  const loadEstudiantes = async () => {
    if (!selectedAula) {
      console.log('⚠️ loadEstudiantes: No hay aula seleccionada')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Determinar si estamos consultando un mes anterior
      const fechaActual = new Date()
      const mesActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      const mesConsultado = new Date(selectedYear, selectedMonth, 1)
      const esMesAnterior = mesConsultado < mesActual
      
      let nuevosEstudiantes: Estudiante[] = []
      
      if (esMesAnterior) {
        // Mes anterior: usar estudiantes_activos_en_rango (estudiante_periodos)
        const firstDay = formatDateToLocalString(new Date(selectedYear, selectedMonth, 1))
        const lastDay = formatDateToLocalString(new Date(selectedYear, selectedMonth + 1, 0))

        const { data: idsRango, error: rangoError } = await supabase.rpc('estudiantes_activos_en_rango', {
          p_aula_id: selectedAula,
          p_fecha_inicio: firstDay,
          p_fecha_fin: lastDay,
        })

        if (rangoError) throw rangoError

        // Normalizar: SETOF UUID puede venir como ["uuid"] o como [{ columna: "uuid" }]
        const ids = (idsRango || []).flatMap((x: unknown) => {
          if (typeof x === 'string') return [x]
          if (x && typeof x === 'object') {
            const v = (x as Record<string, unknown>)['estudiante_id'] ?? Object.values(x as object)[0]
            return typeof v === 'string' ? [v] : []
          }
          return []
        })

        if (ids.length > 0) {
          const { data: estudiantesRango, error: errEst } = await supabase
            .from('estudiantes')
            .select('id, codigo, nombre_completo')
            .in('id', ids)
            .order('nombre_completo', { ascending: true })

          if (!errEst && estudiantesRango) {
            nuevosEstudiantes = estudiantesRango
          }

          // Períodos quitables: exactamente este mes (fecha_inicio=first, fecha_fin=last)
          const { data: periodosData } = await supabase
            .from('estudiante_periodos')
            .select('id, estudiante_id')
            .eq('aula_id', selectedAula)
            .eq('fecha_inicio', firstDay)
            .eq('fecha_fin', lastDay)
            .in('estudiante_id', ids)

          const map = new Map<string, string>()
          periodosData?.forEach((p: { id: string; estudiante_id: string }) => map.set(p.estudiante_id, p.id))
          setPeriodosQuitables(map)
        } else {
          setPeriodosQuitables(new Map())
        }

        console.log('✅ Estudiantes de mes anterior (estudiante_periodos):', {
          count: nuevosEstudiantes.length,
          aula: selectedAula,
        })
      } else {
        setPeriodosQuitables(new Map())
        // Rollover: asegurar períodos del mes actual para estudiantes que tenían el mes anterior
        const yearCur = fechaActual.getFullYear()
        const monthCur = fechaActual.getMonth() + 1
        await supabase.rpc('asegurar_periodos_mes', {
          p_aula_id: selectedAula,
          p_anio: yearCur,
          p_mes: monthCur,
        })
        // Cargar estudiantes basándose en su aula_id actual (sincronizado por trigger)
        const { data, error } = await supabase
          .from('estudiantes')
          .select('id, codigo, nombre_completo')
          .eq('fcp_id', fcpId)
          .eq('aula_id', selectedAula)
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (error) throw error
        
        nuevosEstudiantes = data || []
        
        console.log('✅ Estudiantes cargados (mes actual/futuro):', {
          count: nuevosEstudiantes.length,
          aula: selectedAula,
          muestraIds: nuevosEstudiantes.slice(0, 3).map(e => e.id.substring(0, 8))
        })
      }
      
      const nuevosIds = new Set(nuevosEstudiantes.map(e => e.id))
      
      // Actualizar estudiantes
      setEstudiantes(prev => {
        const prevIds = new Set(prev.map(e => e.id))
        const idsCambiaron = nuevosIds.size !== prevIds.size || 
                             !Array.from(nuevosIds).every(id => prevIds.has(id))
        
        // Si los IDs cambiaron (cambio de aula o mes), limpiar asistencias
        if (idsCambiaron && prev.length > 0) {
          console.log('🔄 IDs de estudiantes cambiaron (cambio de aula/mes), limpiando asistencias')
          setAsistencias(new Map())
        }
        
        return nuevosEstudiantes
      })
    } catch (error) {
      console.error('Error loading estudiantes:', error)
      setEstudiantes([]) // Limpiar estudiantes en caso de error
    } finally {
      setLoading(false)
    }
  }

  const loadAsistenciasMes = async () => {
    if (!selectedAula || estudiantes.length === 0) {
      console.log('⚠️ loadAsistenciasMes: No hay aula seleccionada o estudiantes', {
        selectedAula,
        estudiantesCount: estudiantes.length
      })
      return
    }

    try {
      const supabase = createClient()
      // Usar formato local para evitar problemas de zona horaria
      const firstDay = formatDateToLocalString(new Date(selectedYear, selectedMonth, 1))
      const lastDay = formatDateToLocalString(new Date(selectedYear, selectedMonth + 1, 0))

      const estudianteIds = estudiantes.map((e) => e.id)

      if (estudianteIds.length === 0) {
        console.log('⚠️ No hay IDs de estudiantes para consultar asistencias')
        setAsistencias(new Map())
        return
      }

      console.log('🔍 Cargando asistencias:', {
        fcpId,
        selectedAula,
        estudianteIds: estudianteIds.slice(0, 5), // Primeros 5 IDs
        estudianteIdsCount: estudianteIds.length,
        fechaInicio: firstDay,
        fechaFin: lastDay,
        month: selectedMonth,
        year: selectedYear
      })

      // Optimizar: solo seleccionar campos necesarios, no usar select('*')
      // Nota: Si estudianteIds tiene más de 100 elementos, Supabase puede tener límites
      // En ese caso, dividir en lotes
      let query = supabase
        .from('asistencias')
        .select(`
          id, 
          estudiante_id, 
          fecha, 
          estado, 
          observaciones,
          aula_id,
          fcp_id,
          created_by,
          updated_by,
          created_at,
          updated_at,
          created_by_nombre,
          created_by_email,
          created_by_rol,
          updated_by_nombre,
          updated_by_email,
          updated_by_rol,
          registro_tardio
        `)
        .eq('fcp_id', fcpId)
        .in('estudiante_id', estudianteIds)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay)

      const { data, error } = await query

      if (error) {
        // Ignorar errores de aborto (son esperados cuando cambian las dependencias rápidamente)
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) {
          return
        }
        console.error('❌ Error en consulta de asistencias:', error)
        throw error
      }

      console.log('✅ Asistencias cargadas:', {
        count: data?.length || 0,
        asistencias: data?.slice(0, 5).map(a => ({
          estudiante_id: a.estudiante_id,
          fecha: a.fecha,
          estado: a.estado
        })),
        fechasUnicas: [...new Set(data?.map(a => a.fecha) || [])].sort()
      })

      const asistenciasMap = new Map<string, Asistencia>()
      data?.forEach((asistencia) => {
        const key = `${asistencia.estudiante_id}_${asistencia.fecha}`
        // Completar campos faltantes con valores por defecto
        asistenciasMap.set(key, {
          ...asistencia,
          observaciones: asistencia.observaciones || undefined,
        } as Asistencia)
      })
      
      // Verificar que los IDs de estudiantes en el mapa coincidan con los estudiantes actuales
      const estudiantesIdsEnMapa = new Set(Array.from(asistenciasMap.keys()).map(k => k.split('_')[0]))
      const estudiantesIdsActuales = new Set(estudianteIds)
      const idsCoinciden = Array.from(estudiantesIdsEnMapa).every(id => estudiantesIdsActuales.has(id))
      
      console.log('📊 Mapa de asistencias creado:', {
        totalKeys: asistenciasMap.size,
        sampleKeys: Array.from(asistenciasMap.keys()).slice(0, 5),
        estudiantesEnConsulta: estudianteIds.length,
        estudiantesEnMapa: estudiantesIdsEnMapa.size,
        idsCoinciden,
        fechasEnMapa: [...new Set(Array.from(asistenciasMap.keys()).map(k => k.split('_')[1]))].sort(),
        muestraEstudiantesEnMapa: Array.from(estudiantesIdsEnMapa).slice(0, 3),
        muestraEstudiantesActuales: Array.from(estudiantesIdsActuales).slice(0, 3)
      })
      
      setAsistencias(asistenciasMap)
      
      // Verificar que las fechas coincidan con las del mes
      const fechasDelMes = daysInMonth.map(d => d.fechaStr)
      const fechasConAsistencias = [...new Set(Array.from(asistenciasMap.keys()).map(k => k.split('_')[1]))]
      const fechasQueCoinciden = fechasDelMes.filter(f => fechasConAsistencias.includes(f))
      console.log('📅 Verificación de fechas:', {
        fechasDelMes: fechasDelMes.slice(0, 5),
        fechasConAsistencias: fechasConAsistencias,
        fechasQueCoinciden: fechasQueCoinciden,
        todasCoinciden: fechasConAsistencias.every(f => fechasDelMes.includes(f))
      })
      
      // Advertencia si los IDs no coinciden
      if (!idsCoinciden) {
        console.warn('⚠️ ADVERTENCIA: Los IDs de estudiantes en el mapa no coinciden completamente con los estudiantes actuales')
      }
    } catch (error: any) {
      // Ignorar errores de aborto
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) {
        return
      }
      console.error('❌ Error loading asistencias:', error)
    }
  }

  const getAsistenciaEstado = (estudianteId: string, fechaStr: string): AsistenciaEstado => {
    const key = `${estudianteId}_${fechaStr}`
    const asistencia = asistencias.get(key)
    
    // Log de depuración para fechas específicas que sabemos que tienen asistencias
    const fechasConAsistencias = ['2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25']
    if (asistencias.size > 0 && estudiantes.length > 0 && estudianteId === estudiantes[0]?.id && fechasConAsistencias.includes(fechaStr)) {
      console.log('🔍 getAsistenciaEstado para fecha con asistencia:', {
        estudianteId: estudianteId.substring(0, 8),
        fechaStr,
        key,
        existeEnMapa: asistencias.has(key),
        estado: asistencia?.estado || null,
        totalKeysEnMapa: asistencias.size,
        keysParaEstaFecha: Array.from(asistencias.keys()).filter(k => k.includes(fechaStr)).slice(0, 3),
        keysParaEsteEstudiante: Array.from(asistencias.keys()).filter(k => k.startsWith(estudianteId)).slice(0, 3)
      })
    }
    
    return asistencia?.estado || null
  }

  // Validar cuántos estudiantes tienen asistencia marcada en una fecha
  const getEstudiantesMarcadosPorFecha = (fechaStr: string): { marcados: number; total: number; faltantes: number } => {
    const total = estudiantes.length
    const marcados = estudiantes.filter(est => {
      const key = `${est.id}_${fechaStr}`
      return asistencias.has(key)
    }).length
    const faltantes = total - marcados
    return { marcados, total, faltantes }
  }

  const saveAsistencia = async (
    estudianteId: string,
    fechaStr: string,
    estado: 'presente' | 'falto' | 'permiso'
  ) => {
    if (!puedeEditarMes) return

    const fechaAsistencia = new Date(fechaStr + 'T00:00:00')
    const y = fechaAsistencia.getFullYear()
    const m = fechaAsistencia.getMonth()
    const now = new Date()
    const ay = now.getFullYear()
    const am = now.getMonth()
    const vista = y * 12 + m
    const actual = ay * 12 + am
    const esMesPasadoVista = vista < actual
    if (esMesPasadoVista && !correccionHabilitada) {
      toast.warning('Corrección no habilitada', 'El facilitador debe habilitar la corrección para poder editar.')
      return
    }

    const key = `${estudianteId}_${fechaStr}`
    const existingAsistencia = asistencias.get(key)

    try {
      setSaving((prev) => new Set(prev).add(key))
      const supabase = createClient()

      // Obtener el usuario actual para auditoría
      const { data: { user } } = await supabase.auth.getUser()
      
      if (existingAsistencia) {
        // Actualizar asistencia existente
        const { data, error } = await supabase
          .from('asistencias')
          .update({
            estado,
            updated_at: new Date().toISOString(),
            updated_by: user?.id || null,
          })
          .eq('id', existingAsistencia.id)
          .select()
          .single()

        if (error) throw error

        // Actualizar estado local
        setAsistencias((prev) => {
          const updated = new Map(prev)
          updated.set(key, { ...existingAsistencia, estado, ...data })
          return updated
        })
      } else {
        // Intentar insertar, si existe (409), actualizar por estudiante_id y fecha
        const insertData: any = {
          estudiante_id: estudianteId,
          fecha: fechaStr,
          estado,
          fcp_id: fcpId,
          aula_id: selectedAula,
        }
        
        // Agregar campos de auditoría si hay usuario
        if (user) {
          insertData.created_by = user.id
          insertData.updated_by = user.id
        }
        
        const { data, error } = await supabase
          .from('asistencias')
          .insert(insertData)
          .select()
          .single()

        if (error) {
          if (error.message?.includes('meses anteriores') || error.message?.includes('mes cerrado')) {
            console.warn('[Asistencia] Servidor rechazó (mes cerrado):', error.message)
            toast.error('Mes cerrado', 'No se pueden registrar asistencias en fechas de meses anteriores. El facilitador debe habilitar la corrección para ese mes.')
            setSaving((prev) => {
              const updated = new Set(prev)
              updated.delete(key)
              return updated
            })
            return
          }
          // Si el error es 409 (Conflict), la asistencia ya existe, intentar actualizar
          if (error.code === '23505' || error.message?.includes('409') || error.message?.includes('duplicate')) {
            // Buscar la asistencia existente y actualizarla
            const { data: existingData, error: fetchError } = await supabase
              .from('asistencias')
              .select('*')
              .eq('estudiante_id', estudianteId)
              .eq('fecha', fechaStr)
              .eq('fcp_id', fcpId)
              .single()

            if (fetchError) throw fetchError

            // Actualizar la asistencia existente
            const { data: updatedData, error: updateError } = await supabase
              .from('asistencias')
              .update({
                estado,
                updated_at: new Date().toISOString(),
                updated_by: user?.id || null,
              })
              .eq('id', existingData.id)
              .select()
              .single()

            if (updateError) {
              if (updateError.message?.includes('meses anteriores') || updateError.message?.includes('mes cerrado')) {
                toast.error('Mes cerrado', 'No se pueden modificar asistencias de meses anteriores.')
                setSaving((prev) => {
                  const updated = new Set(prev)
                  updated.delete(key)
                  return updated
                })
                return
              }
              throw updateError
            }

            // Actualizar estado local - usar el objeto completo de existingData actualizado
            setAsistencias((prev) => {
              const updated = new Map(prev)
              updated.set(key, { ...existingData, estado, ...updatedData })
              return updated
            })
          } else {
            throw error
          }
        } else {
          // Actualizar estado local con la nueva asistencia
          setAsistencias((prev) => {
            const updated = new Map(prev)
            updated.set(key, data)
            return updated
          })
        }
      }
    } catch (error: any) {
      console.error('Error saving asistencia:', error)
      // Si el error es de inmutabilidad, ya se manejó arriba
      if (!error?.message?.includes('meses anteriores') && !error?.message?.includes('mes cerrado')) {
        if (!error?.message?.includes('AbortError') && !error?.message?.includes('aborted')) {
          toast.error('Error al guardar asistencia', error?.message || 'Intenta nuevamente.')
        }
      }
    } finally {
      setSaving((prev) => {
        const updated = new Set(prev)
        updated.delete(key)
        return updated
      })
    }
  }

  const deleteAsistencia = async (estudianteId: string, fechaStr: string) => {
    if (!puedeEditarMes) return

    const fechaAsistencia = new Date(fechaStr + 'T00:00:00')
    const y = fechaAsistencia.getFullYear()
    const m = fechaAsistencia.getMonth()
    const now = new Date()
    const ay = now.getFullYear()
    const am = now.getMonth()
    const vista = y * 12 + m
    const actual = ay * 12 + am
    if (vista < actual && !correccionHabilitada) {
      toast.warning('Corrección no habilitada', 'El facilitador debe habilitar la corrección para poder editar.')
      return
    }

    const key = `${estudianteId}_${fechaStr}`
    const existingAsistencia = asistencias.get(key)
    if (!existingAsistencia?.id || existingAsistencia.id.startsWith('temp-')) {
      setAsistencias((prev) => {
        const updated = new Map(prev)
        updated.delete(key)
        return updated
      })
      return
    }

    try {
      setSaving((prev) => new Set(prev).add(key))
      const supabase = createClient()

      const { error } = await supabase
        .from('asistencias')
        .delete()
        .eq('id', existingAsistencia.id)

      if (error) {
        if (error.message?.includes('meses anteriores') || error.message?.includes('mes cerrado')) {
          toast.error('Mes cerrado', 'No se puede eliminar esta asistencia.')
        } else {
          throw error
        }
        return
      }

      setAsistencias((prev) => {
        const updated = new Map(prev)
        updated.delete(key)
        return updated
      })
    } catch (e: unknown) {
      console.error('Error eliminando asistencia:', e)
      toast.error('Error al eliminar', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setSaving((prev) => {
        const updated = new Set(prev)
        updated.delete(key)
        return updated
      })
    }
  }

  const handleCellClick = (
    estudianteId: string,
    fechaStr: string,
    isDoubleClick: boolean = false
  ) => {
    if (!puedeEditarMes) return

    const currentEstado = getAsistenciaEstado(estudianteId, fechaStr)

    let newEstado: 'presente' | 'falto' | 'permiso'

    if (isDoubleClick) {
      // Doble click = faltó
      newEstado = 'falto'
    } else {
      // Click simple: presente → falto → permiso → blanco (null) → presente…
      if (!currentEstado) {
        newEstado = 'presente'
      } else if (currentEstado === 'presente') {
        newEstado = 'falto'
      } else if (currentEstado === 'falto') {
        newEstado = 'permiso'
      } else {
        // permiso → blanco (eliminar registro)
        deleteAsistencia(estudianteId, fechaStr)
        return
      }
    }

    saveAsistencia(estudianteId, fechaStr, newEstado)
  }

  const handleCellMouseDown = (estudianteId: string, fechaStr: string) => {
    if (!puedeEditarMes) return

    // Limpiar timer previo si existe
    const key = `${estudianteId}_${fechaStr}`
    const existingTimer = longPressTimerRef.current.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Configurar timer para click sostenido (permiso)
    const timer = setTimeout(() => {
      saveAsistencia(estudianteId, fechaStr, 'permiso')
      longPressTimerRef.current.delete(key)
    }, 500) // 500ms = medio segundo de presión

    longPressTimerRef.current.set(key, timer)
  }

  const handleCellMouseUp = (estudianteId: string, fechaStr: string) => {
    const key = `${estudianteId}_${fechaStr}`
    const timer = longPressTimerRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      longPressTimerRef.current.delete(key)
    }
  }

  const handleCellMouseLeave = (estudianteId: string, fechaStr: string) => {
    const key = `${estudianteId}_${fechaStr}`
    const timer = longPressTimerRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      longPressTimerRef.current.delete(key)
    }
  }

  const handleMarkAllPresente = async (fechaStr: string) => {
    if (!puedeEditarMes || !selectedAula) return

    const fechaAsistencia = new Date(fechaStr + 'T00:00:00')
    const y = fechaAsistencia.getFullYear()
    const m = fechaAsistencia.getMonth()
    const now = new Date()
    const ay = now.getFullYear()
    const am = now.getMonth()
    const vista = y * 12 + m
    const actual = ay * 12 + am
    if (vista < actual && !correccionHabilitada) {
      toast.warning('Corrección no habilitada', 'El facilitador debe habilitar la corrección para poder editar.')
      return
    }

    setSavingDates((prev) => new Set(prev).add(fechaStr))

    // Actualización optimista: actualizar el estado local inmediatamente para mostrar los iconos
    setAsistencias((prev) => {
      const updated = new Map(prev)
      estudiantes.forEach((estudiante) => {
        const key = `${estudiante.id}_${fechaStr}`
        const existingAsistencia = prev.get(key)
        
        // Crear o actualizar la asistencia con estado 'presente'
        updated.set(key, {
          id: existingAsistencia?.id || `temp-${estudiante.id}-${fechaStr}`,
          estudiante_id: estudiante.id,
          fecha: fechaStr,
          estado: 'presente',
          fcp_id: fcpId,
          ...existingAsistencia,
        } as Asistencia)
      })
      return updated
    })

    // Guardar en la BD en background
    const supabase = createClient()
    
    // Obtener el usuario actual para auditoría
    const { data: { user } } = await supabase.auth.getUser()
    
    // Separar actualizaciones e inserciones para mayor eficiencia
    const toUpdate: Array<{ id: string; estudiante_id: string }> = []
    const toInsert: Array<{ estudiante_id: string; fecha: string; estado: string; fcp_id: string; created_by?: string | null; updated_by?: string | null }> = []

    estudiantes.forEach((estudiante) => {
      const key = `${estudiante.id}_${fechaStr}`
      const existingAsistencia = asistencias.get(key)
      
      if (existingAsistencia?.id && !existingAsistencia.id.startsWith('temp-')) {
        toUpdate.push({ id: existingAsistencia.id, estudiante_id: estudiante.id })
      } else {
        const insertItem: any = {
          estudiante_id: estudiante.id,
          fecha: fechaStr,
          estado: 'presente',
          fcp_id: fcpId,
        }
        
        // Agregar campos de auditoría si hay usuario
        if (user) {
          insertItem.created_by = user.id
          insertItem.updated_by = user.id
        }
        
        toInsert.push(insertItem)
      }
    })

    // Función helper para completar el guardado
    const completeSave = () => {
      // Quitar el estado de guardando (mostrar ✔️ de nuevo)
      setSavingDates((prev) => {
        const updated = new Set(prev)
        updated.delete(fechaStr)
        return updated
      })

      const fechaDate = new Date(fechaStr)
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
      const dayName = dayNames[fechaDate.getDay()]
      const dayNumber = fechaDate.getDate()
      toast.success(`Asistencia guardada ${dayName} ${dayNumber}`)
    }
    
    // Ejecutar actualizaciones en batch si hay alguna
    const updatePromises = toUpdate.length > 0 
      ? Promise.all(
          toUpdate.map(({ id }) =>
            supabase
              .from('asistencias')
              .update({
                estado: 'presente',
                updated_at: new Date().toISOString(),
                updated_by: user?.id || null,
              })
              .eq('id', id)
              .select()
              .single()
          )
        )
      : Promise.resolve({ data: [] as any[], error: null })

    // Ejecutar inserciones en batch si hay alguna
    const insertPromise = toInsert.length > 0
      ? supabase
          .from('asistencias')
          .insert(toInsert)
          .select()
      : Promise.resolve({ data: [] as any[], error: null })

    // Esperar a que ambas operaciones terminen
    Promise.all([updatePromises, insertPromise])
      .then(([updateResults, insertResult]) => {
        const updateResult = Array.isArray(updateResults) ? updateResults[0] : updateResults
        const updateError = updateResult && 'error' in updateResult ? updateResult.error : (Array.isArray(updateResults) ? updateResults.find((r: any) => r?.error)?.error : null)
        // Verificar errores de inmutabilidad primero
        if (updateError) {
          if (updateError.message?.includes('meses anteriores') || updateError.message?.includes('mes cerrado')) {
            toast.error('Mes cerrado', 'No se pueden modificar asistencias de meses anteriores. El facilitador debe habilitar la corrección.')
            setSavingDates((prev) => {
              const updated = new Set(prev)
              updated.delete(fechaStr)
              return updated
            })
            loadAsistenciasMes()
            return
          }
          toast.error('No se pudo guardar', updateError.message)
          setSavingDates((prev) => { const u = new Set(prev); u.delete(fechaStr); return u })
          return
        }
        
        if (insertResult?.error) {
          if (insertResult.error.message?.includes('meses anteriores') || insertResult.error.message?.includes('mes cerrado')) {
            toast.error('Mes cerrado', 'No se pueden registrar asistencias en fechas de meses anteriores. El facilitador debe habilitar la corrección.')
            setSavingDates((prev) => {
              const updated = new Set(prev)
              updated.delete(fechaStr)
              return updated
            })
            loadAsistenciasMes()
            return
          }
          // Otro error en insert (ej. 400): no mostrar "guardado", quitar estado de guardando
          toast.error('No se pudo guardar', insertResult.error.message)
          setSavingDates((prev) => { const u = new Set(prev); u.delete(fechaStr); return u })
          return
        }
        
        const insertErr = (insertResult as unknown as { error?: { message?: string } })?.error
        const hasErrors = (updateError && !(updateError as { message?: string }).message?.includes('AbortError')) ||
                         (insertErr && !insertErr.message?.includes('AbortError'))

        if (hasErrors && insertErr) {
          // Si hay error en inserciones, intentar individualmente
          toInsert.forEach(async (item) => {
            try {
              const { data: result, error: insertError } = await supabase
                .from('asistencias')
                .insert(item)
                .select()
                .single()

              if (insertError) {
                // Si el error es de inmutabilidad, mostrar mensaje y continuar con el siguiente
                if (insertError.message?.includes('meses anteriores') || insertError.message?.includes('mes cerrado')) {
                  console.warn('No se puede registrar asistencia de mes anterior:', item.fecha)
                  return // Continuar con el siguiente item
                }
                
                // Si el error es 409 (Conflict), la asistencia ya existe, intentar actualizar
                if (insertError.code === '23505' || insertError.message?.includes('409')) {
                  // Ya existe, buscar y actualizar
                  const { data: existing } = await supabase
                    .from('asistencias')
                    .select('*')
                    .eq('estudiante_id', item.estudiante_id)
                    .eq('fecha', item.fecha)
                    .eq('fcp_id', item.fcp_id)
                    .single()

                  if (existing) {
                    const { error: updateError } = await supabase
                      .from('asistencias')
                      .update({ estado: 'presente', updated_at: new Date().toISOString() })
                      .eq('id', existing.id)
                    
                    // Si el error de actualización es de inmutabilidad, ignorar
                    if (updateError && (updateError.message?.includes('meses anteriores') || updateError.message?.includes('mes cerrado'))) {
                      console.warn('No se puede actualizar asistencia de mes anterior:', item.fecha)
                      return
                    }
                  }
                }
              } else if (result) {
                // Actualizar estado local con el ID real
                setAsistencias((prev) => {
                  const updated = new Map(prev)
                  const key = `${result.estudiante_id}_${result.fecha}`
                  updated.set(key, result)
                  return updated
                })
              }
            } catch (err) {
              console.error('Error handling individual insert:', err)
            }
          })
        }

        // Actualizar estado local con los resultados reales
        // updateResult.data puede ser objeto único (.single()) o array; insertResult.data puede ser array u objeto
        const updateDataArray = Array.isArray(updateResults)
          ? (updateResults as { data?: any }[]).flatMap((r) => (r?.data != null ? (Array.isArray(r.data) ? r.data : [r.data]) : []))
          : (updateResult?.data != null ? (Array.isArray(updateResult.data) ? updateResult.data : [updateResult.data]) : [])
        if (updateDataArray.length > 0) {
          setAsistencias((prev) => {
            const updated = new Map(prev)
            updateDataArray.forEach((asistencia: any) => {
              const key = `${asistencia.estudiante_id}_${asistencia.fecha}`
              updated.set(key, asistencia)
            })
            return updated
          })
        }

        const insertDataArray = insertResult?.data != null
          ? (Array.isArray(insertResult.data) ? insertResult.data : [insertResult.data])
          : []
        if (insertDataArray.length > 0) {
          setAsistencias((prev) => {
            const updated = new Map(prev)
            insertDataArray.forEach((asistencia: any) => {
              const key = `${asistencia.estudiante_id}_${asistencia.fecha}`
              updated.set(key, asistencia)
            })
            return updated
          })
        }

        // Completar el guardado (quitar ⏳, mostrar toast)
        completeSave()
      })
      .catch((error) => {
        console.error('Error saving asistencias:', error)
        if (error?.message?.includes('meses anteriores') || error?.message?.includes('mes cerrado')) {
          toast.error('Mes cerrado', 'No se pueden registrar asistencias en fechas de meses anteriores.')
          loadAsistenciasMes()
        } else {
          toast.error('Error al guardar asistencias', error?.message || 'Intenta nuevamente.')
        }
        // Aún así, quitar el estado de guardando
        setSavingDates((prev) => {
          const updated = new Set(prev)
          updated.delete(fechaStr)
          return updated
        })
      })
  }

  const handleEliminarTodasAsistencias = (fechaStr: string) => {
    if (!puedeEditarMes || !selectedAula) return

    const fechaDate = new Date(fechaStr + 'T00:00:00')
    const y = fechaDate.getFullYear()
    const m = fechaDate.getMonth()
    const now = new Date()
    const ay = now.getFullYear()
    const am = now.getMonth()
    const vista = y * 12 + m
    const actual = ay * 12 + am
    if (vista < actual && !correccionHabilitada) {
      toast.warning('Corrección no habilitada', 'El facilitador debe habilitar la corrección para poder editar.')
      return
    }

    setFechaParaEliminar(fechaStr)
  }

  const doEliminarTodasAsistencias = async () => {
    const fechaStr = fechaParaEliminar
    if (!fechaStr) return

    const fechaDate = new Date(fechaStr + 'T00:00:00')
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const dayName = dayNames[fechaDate.getDay()]
    const dayNumber = fechaDate.getDate()

    setSavingDates((prev) => new Set(prev).add(fechaStr))

    try {
      const supabase = createClient()
      const estudianteIds = estudiantes.map((e) => e.id)
      
      const { error } = await supabase
        .from('asistencias')
        .delete()
        .eq('fcp_id', fcpId)
        .eq('fecha', fechaStr)
        .in('estudiante_id', estudianteIds)

      if (error) {
        if (error.message?.includes('meses anteriores') || error.message?.includes('mes cerrado')) {
          toast.error('Mes cerrado', 'No se pueden eliminar asistencias de meses anteriores.')
        } else {
          throw error
        }
        setSavingDates((prev) => {
          const updated = new Set(prev)
          updated.delete(fechaStr)
          return updated
        })
        setFechaParaEliminar(null)
        return
      }

      setAsistencias((prev) => {
        const updated = new Map(prev)
        estudiantes.forEach((estudiante) => {
          const key = `${estudiante.id}_${fechaStr}`
          updated.delete(key)
        })
        return updated
      })

      setSavingDates((prev) => {
        const updated = new Set(prev)
        updated.delete(fechaStr)
        return updated
      })

      toast.success(`Asistencias eliminadas ${dayName} ${dayNumber}`)
      setFechaParaEliminar(null)
    } catch (error: any) {
      console.error('Error eliminando asistencias:', error)
      if (!error.message?.includes('meses anteriores') && !error.message?.includes('mes cerrado')) {
        toast.error('Error al eliminar asistencias', error?.message || 'Intenta nuevamente.')
      }
      
      setSavingDates((prev) => {
        const updated = new Set(prev)
        updated.delete(fechaStr)
        return updated
      })
      setFechaParaEliminar(null)
    }
  }

  const getEstadoIcon = (estado: AsistenciaEstado, isSaving: boolean) => {
    if (isSaving) {
      return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />
    }

    switch (estado) {
      case 'presente':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'falto':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'permiso':
        return <Clock className="h-5 w-5 text-warning" />
      default:
        return <div className="h-5 w-5 border border-border rounded" />
    }
  }

  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${monthNames[month]} ${year}`
  }

  if (!selectedAula) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            Por favor, selecciona un aula para ver las asistencias.
          </p>
          {aulas.length > 0 && (
            <Select
              value={selectedAula || ''}
              onValueChange={(value) => setSelectedAula(value || null)}
            >
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Selecciona un aula">
                  {selectedAula ? (
                    aulas.find(aula => aula.id === selectedAula)?.nombre || 'Selecciona un aula'
                  ) : (
                    'Selecciona un aula'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
              {aulas.map((aula) => (
                  <SelectItem key={aula.id} value={aula.id}>
                  {aula.nombre}
                  </SelectItem>
              ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>
    )
  }

  // Calcular el ancho actual de la tabla
  const currentWidth = tableWidth || (defaultWidthRef.current ? `${defaultWidthRef.current}px` : '100%')

  return (
    <Card ref={cardRef} className="relative mx-auto" style={{ width: currentWidth, maxWidth: currentWidth, overflow: 'visible' }}>
      {/* Resizer handle - solo en desktop con tabla */}
      <div
        className="absolute top-0 right-0 w-4 h-full cursor-col-resize hover:bg-primary/60 opacity-0 hover:opacity-100 transition-opacity z-50 hidden sm:block"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsResizingTable(true)
          setResizeStartX(e.pageX)
          if (cardRef.current) {
            const currentWidth = cardRef.current.offsetWidth
            setResizeStartWidth(currentWidth)
            if (defaultWidthRef.current === null) {
              defaultWidthRef.current = currentWidth
            }
          } else {
            const fallbackWidth = defaultWidthRef.current || Math.min(1280, window.innerWidth - 64)
            setResizeStartWidth(fallbackWidth)
          }
        }}
        style={{ cursor: 'col-resize' }}
        title="Arrastra para expandir la tabla horizontalmente"
      />
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Control de Asistencia - {formatMonthYear(selectedMonth, selectedYear)}</CardTitle>
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            {zoomLevel !== 1 && (
              <span className="text-xs text-muted-foreground">
                Zoom: {Math.round(zoomLevel * 100)}% | Ctrl+Scroll para ajustar
              </span>
            )}
            {tableWidth && (
              <span className="text-xs text-muted-foreground">
                Ancho tabla: {tableWidth}px | Arrastra el borde derecho para ajustar
              </span>
            )}
            {!tableWidth && (
              <span className="text-xs text-muted-foreground opacity-60">
                Arrastra el borde derecho de la tarjeta para expandir la tabla
              </span>
            )}
            {/* Selector de Aula */}
            <Select
              value={selectedAula || ''}
              onValueChange={(value) => setSelectedAula(value || null)}
            >
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Seleccionar aula">
                  {selectedAula ? (
                    aulas.find(aula => aula.id === selectedAula)?.nombre || 'Seleccionar aula'
                  ) : (
                    'Seleccionar aula'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
              {aulas.map((aula) => (
                  <SelectItem key={aula.id} value={aula.id}>
                  {aula.nombre}
                  </SelectItem>
              ))}
              </SelectContent>
            </Select>

            {/* Selector de Mes */}
            <MonthPicker
              value={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
              onChange={(value) => {
                const [year, month] = value.split('-')
                setSelectedYear(parseInt(year))
                setSelectedMonth(parseInt(month) - 1)
              }}
              disableFuture
            />
            {showHabilitarCorreccion && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setHabilitarCorreccionOpen(true)}
              >
                <Unlock className="h-4 w-4" />
                Habilitar corrección
              </Button>
            )}
            {showAgregarEstudianteMes && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setAgregarEstudianteMesOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                Agregar estudiante a este mes
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedAula && (
          <div className="flex flex-wrap items-center gap-3 mb-4 py-3 px-4 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-sm font-medium text-foreground">
              Salón: <span className="font-semibold">{aulas.find(a => a.id === selectedAula)?.nombre || 'Aula'}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Tutor: <span className="font-medium text-foreground">{tutorNombre || 'Sin tutor asignado'}</span></span>
            </span>
          </div>
        )}
        {esMesPasadoVista && correccionMes && !correccionLoading && (
          <CorreccionMesBanner
            estado={correccionMes.estado}
            habilitadoPorNombre={correccionMes.habilitadoPorNombre}
            fechaLimite={correccionMes.fechaLimite}
            mesLabel={formatMonthYear(selectedMonth, selectedYear)}
            esFacilitador={role === 'facilitador'}
            className="mb-4"
          />
        )}
        {loading && estudiantes.length === 0 ? (
          <div className="text-center py-8">Cargando estudiantes...</div>
        ) : !loading && estudiantes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay estudiantes en esta aula.
          </div>
        ) : isMobile ? (
          /* Vista móvil: cards por asistente, sin tablas */
          (() => {
            const mobilePerPage = 8
            const filteredEstudiantes = mobileSearch.trim()
              ? estudiantes.filter(
                  (e) =>
                    e.nombre_completo.toLowerCase().includes(mobileSearch.toLowerCase()) ||
                    e.codigo.toLowerCase().includes(mobileSearch.toLowerCase())
                )
              : estudiantes
            const totalPages = Math.max(1, Math.ceil(filteredEstudiantes.length / mobilePerPage))
            const displayEstudiantes = filteredEstudiantes.slice(
              (mobilePage - 1) * mobilePerPage,
              mobilePage * mobilePerPage
            )
            const totalDias = daysInMonth.length
            return (
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="Buscar por nombre o código..."
                    value={mobileSearch}
                    onChange={(e) => {
                      setMobileSearch(e.target.value)
                      setMobilePage(1)
                    }}
                    className="pl-9 w-full"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {filteredEstudiantes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    {mobileSearch ? 'No se encontraron estudiantes' : 'No hay estudiantes'}
                  </p>
                ) : (
                <div className="space-y-3">
                  {displayEstudiantes.map((estudiante) => {
                    const presentes = daysInMonth.filter(
                      (d) => getAsistenciaEstado(estudiante.id, d.fechaStr) === 'presente'
                    ).length
                    return (
                      <Card key={estudiante.id} className="overflow-hidden">
                        <div className="p-4 flex flex-col gap-3">
                          <div>
                            <p className="font-mono text-sm text-muted-foreground">{estudiante.codigo}</p>
                            <p className="font-medium">{estudiante.nombre_completo}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatMonthYear(selectedMonth, selectedYear)}: {presentes} / {totalDias}
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button
                              className="w-full gap-2"
                              variant="outline"
                              onClick={() => setSelectedEstudianteForModal(estudiante)}
                            >
                              <Calendar className="h-4 w-4" />
                              Ver calendario
                            </Button>
                            {showQuitarEstudianteMes && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    setSelectedEstudianteForMover(estudiante)
                                    setMoverEstudianteMesOpen(true)
                                  }}
                                >
                                  Mover a otro salón
                                </Button>
                                {periodosQuitables.has(estudiante.id) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      setSelectedEstudianteForQuitar(estudiante)
                                      setQuitarEstudianteMesOpen(true)
                                    }}
                                  >
                                    Quitar de este mes
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
                )}
                {filteredEstudiantes.length > mobilePerPage && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {(mobilePage - 1) * mobilePerPage + 1} - {Math.min(mobilePage * mobilePerPage, filteredEstudiantes.length)} de {filteredEstudiantes.length}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mobilePage <= 1}
                        onClick={() => setMobilePage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mobilePage >= totalPages}
                        onClick={() => setMobilePage((p) => Math.min(totalPages, p + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
                {selectedEstudianteForModal && (
                  <AsistenciaCalendarioModal
                    open={!!selectedEstudianteForModal}
                    onOpenChange={(open) => !open && setSelectedEstudianteForModal(null)}
                    estudiante={selectedEstudianteForModal}
                    daysInMonth={daysInMonth}
                    monthLabel={formatMonthYear(selectedMonth, selectedYear)}
                    getEstado={getAsistenciaEstado}
                    onDayTap={(eid, fechaStr) => handleCellClick(eid, fechaStr, false)}
                    isSaving={(eid, fechaStr) => saving.has(`${eid}_${fechaStr}`)}
                    puedeEditar={puedeEditarMes}
                  />
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
            style={{ 
              cursor: isDragging ? 'grabbing' : (role === 'facilitador' || role === 'director' || role === 'secretario') ? 'grab' : 'default'
            }}
            onWheel={(e) => {
              // Permitir scroll horizontal para facilitadores, directores y secretarios
              if (role !== 'facilitador' && role !== 'director' && role !== 'secretario') {
                return
              }
              
              // Ctrl + scroll o Cmd + scroll para zoom
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                const delta = e.deltaY > 0 ? -0.05 : 0.05
                setZoomLevel(prev => Math.max(0.7, Math.min(1.5, prev + delta)))
              } else if (e.shiftKey) {
                // Shift + scroll para desplazamiento horizontal
                e.preventDefault()
                e.stopPropagation()
                if (tableContainerRef.current) {
                  // Usar deltaY para scroll horizontal cuando Shift está presionado
                  tableContainerRef.current.scrollLeft += e.deltaY
                }
              }
            }}
            onMouseDown={(e) => {
              // Permitir drag scroll para facilitadores, directores y secretarios
              if (role !== 'facilitador' && role !== 'director' && role !== 'secretario') {
                return
              }
              
              // Solo activar drag si es click izquierdo y no está en elementos interactivos
              const target = e.target as HTMLElement
              const isClickableCell = target.closest('td[class*="cursor-pointer"]')
              const isButton = target.closest('button')
              const isInStickyColumn = target.closest('th[class*="sticky"], td[class*="sticky"]')
              const isInput = target.closest('input, select, textarea')
              
              if (e.button === 0 && !isClickableCell && !isButton && !isInStickyColumn && !isInput) {
                setIsDragging(true)
                const rect = tableContainerRef.current?.getBoundingClientRect()
                setStartX(e.pageX - (rect?.left || 0))
                setScrollLeft(tableContainerRef.current?.scrollLeft || 0)
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && tableContainerRef.current && (role === 'facilitador' || role === 'director' || role === 'secretario')) {
                e.preventDefault()
                e.stopPropagation()
                const rect = tableContainerRef.current.getBoundingClientRect()
                const x = e.pageX - rect.left
                const walk = (x - startX) * 2 // Aumentar velocidad del scroll
                tableContainerRef.current.scrollLeft = scrollLeft - walk
              }
            }}
            onMouseUp={() => {
              if (isDragging) {
                setIsDragging(false)
              }
            }}
            onMouseLeave={() => {
              if (isDragging) {
                setIsDragging(false)
              }
            }}
            onScroll={() => {
              const el = tableContainerRef.current
              if (!el || typeof window === 'undefined' || window.innerWidth >= 640) return
              setShowAbbreviatedSticky(el.scrollLeft >= 40)
            }}
          >
            <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left', width: `${100 / zoomLevel}%` }}>
            <table className="border-collapse border border-border text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th className={`border border-border p-2 bg-muted sticky left-0 z-20 text-left shadow-[2px_0_4px_rgba(0,0,0,0.1)] ${showAbbreviatedSticky ? 'min-w-[52px]' : 'min-w-[120px]'} sm:min-w-[120px]`}>
                    <span className="hidden sm:inline">Código</span>
                    <span className="sm:hidden" title="Código">{showAbbreviatedSticky ? 'Cod' : 'Código'}</span>
                  </th>
                  <th className={`border border-border p-2 bg-muted sticky z-20 text-left shadow-[2px_0_4px_rgba(0,0,0,0.1)] ${showAbbreviatedSticky ? 'left-[52px] min-w-[72px]' : 'left-[120px] min-w-[180px]'} sm:left-[120px] sm:min-w-[180px]`}>
                    Participante
                  </th>
                  {daysInMonth.map(({ day, date, dayName, fechaStr }) => {
                    const { marcados, total, faltantes } = getEstudiantesMarcadosPorFecha(fechaStr)
                    const todosMarcados = marcados === total && total > 0
                    const hayFaltantes = faltantes > 0 && total > 0 && marcados > 0 // Solo validar si hay al menos uno marcado
                    const esDiaSinAtencion = marcados === 0 && total > 0 // Día sin atención si no hay ninguno marcado
                    
                    return (
                      <th
                        key={`header-${day}-${selectedMonth}-${selectedYear}`}
                        className={`border p-1 text-center ${
                          hayFaltantes 
                            ? 'bg-warning/20 border-warning/50' 
                            : 'bg-muted/30 border-border'
                        }`}
                        style={{ width: '80px', minWidth: '80px' }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium">{dayName}</span>
                          <span className="font-semibold">{day}</span>
                          {/* Indicador de validación - solo mostrar si hay al menos un estudiante marcado */}
                          {marcados > 0 && (
                            <span
                              className={`text-[10px] px-1 py-0.5 rounded font-semibold ${
                                todosMarcados
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : hayFaltantes
                                  ? 'bg-warning/30 text-warning-foreground border border-warning/60'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                              title={todosMarcados ? 'Todos los estudiantes marcados' : `${faltantes} estudiante(s) sin marcar`}
                            >
                              {marcados}/{total}
                            </span>
                          )}
                          {/* Indicador opcional para días sin atención (puedes comentar esto si no lo quieres) */}
                          {esDiaSinAtencion && (
                            <span
                              className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground"
                              title="Día sin atención"
                            >
                              Sin atención
                            </span>
                          )}
                          {puedeEditarMes && (
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-700 dark:hover:text-green-300"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAllPresente(fechaStr)
                                }}
                                title="Marcar todos como presentes"
                                disabled={!puedeEditarMes || estudiantes.length === 0 || savingDates.has(fechaStr)}
                              >
                                {savingDates.has(fechaStr) ? (
                                  <Clock className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              {/* Verificar si hay asistencias en esta fecha */}
                              {estudiantes.some(est => {
                                const key = `${est.id}_${fechaStr}`
                                return asistencias.has(key)
                              }) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1 text-xs hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEliminarTodasAsistencias(fechaStr)
                                  }}
                                  title="Eliminar todas las asistencias de este día"
                                  disabled={savingDates.has(fechaStr)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((estudiante) => (
                  <tr key={estudiante.id}>
                    <td className={`border border-border p-2 bg-muted sticky left-0 z-10 font-mono text-xs shadow-[2px_0_4px_rgba(0,0,0,0.1)] ${showAbbreviatedSticky ? 'min-w-[52px]' : 'min-w-[120px]'} sm:min-w-[120px]`} title={estudiante.codigo}>
                      <span className="hidden sm:inline">{estudiante.codigo}</span>
                      <span className="sm:hidden">{showAbbreviatedSticky ? (estudiante.codigo.length >= 3 ? estudiante.codigo.slice(-3) : estudiante.codigo) : estudiante.codigo}</span>
                    </td>
                    <td className={`border border-border p-2 bg-muted sticky z-10 text-xs shadow-[2px_0_4px_rgba(0,0,0,0.1)] ${showAbbreviatedSticky ? 'left-[52px] min-w-[72px]' : 'left-[120px] min-w-[180px]'} sm:left-[120px] sm:min-w-[180px]`} title={estudiante.nombre_completo}>
                      <div className="flex flex-col gap-0.5">
                        <span className={`block ${showAbbreviatedSticky ? 'truncate max-w-[80px]' : 'whitespace-normal break-words'} sm:truncate sm:max-w-[172px]`}>{estudiante.nombre_completo}</span>
                        {showQuitarEstudianteMes && (
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-[10px] sm:text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEstudianteForMover(estudiante)
                                setMoverEstudianteMesOpen(true)
                              }}
                            >
                              Mover a otro salón
                            </Button>
                            {periodosQuitables.has(estudiante.id) && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-destructive hover:text-destructive/80 text-[10px] sm:text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedEstudianteForQuitar(estudiante)
                                  setQuitarEstudianteMesOpen(true)
                                }}
                              >
                                Quitar de este mes
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    {daysInMonth.map(({ day, date, fechaStr }) => {
                      const estado = getAsistenciaEstado(estudiante.id, fechaStr)
                      const key = `${estudiante.id}_${fechaStr}`
                      const isSaving = saving.has(key)
                      
                      // Log de depuración para las primeras celdas (solo una vez)
                      if (estudiante.id === estudiantes[0]?.id && day <= 5 && asistencias.size > 0) {
                        const existeEnMapa = asistencias.has(key)
                        if (day === 1) {
                          console.log('🔍 Renderizando celda:', {
                            estudianteId: estudiante.id.substring(0, 8),
                            fechaStr,
                            key,
                            existeEnMapa,
                            estado,
                            totalAsistencias: asistencias.size,
                            muestraKeys: Array.from(asistencias.keys()).filter(k => k.includes(fechaStr)).slice(0, 3)
                          })
                        }
                      }

                      return (
                        <td
                          key={day}
                          className={`border border-border p-1 text-center transition-colors ${
                            puedeEditarMes
                              ? 'cursor-pointer hover:bg-accent/50'
                              : 'cursor-not-allowed opacity-60'
                          }`}
                          style={{ width: '80px', minWidth: '80px' }}
                          onClick={() => handleCellClick(estudiante.id, fechaStr, false)}
                          onDoubleClick={() => handleCellClick(estudiante.id, fechaStr, true)}
                          onMouseDown={() => handleCellMouseDown(estudiante.id, fechaStr)}
                          onMouseUp={() => handleCellMouseUp(estudiante.id, fechaStr)}
                          onMouseLeave={() => handleCellMouseLeave(estudiante.id, fechaStr)}
                          title={
                            puedeEditarMes
                              ? 'Click: Presente → Faltó → Permiso → Blanco | Doble click: Faltó | Mantén: Permiso'
                              : 'Solo lectura'
                          }
                        >
                          <div className="flex flex-col items-center justify-center gap-0.5 relative group">
                            <div className="flex items-center gap-1">
                              {getEstadoIcon(estado, isSaving)}
                              {estado !== null && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const asistencia = asistencias.get(key)
                                    if (asistencia) {
                                      setSelectedAsistenciaForHistorial(asistencia)
                                      setHistorialDialogOpen(true)
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent z-10"
                                  title="Ver historial de esta asistencia"
                                  onMouseEnter={(e) => e.stopPropagation()}
                                  onMouseLeave={(e) => e.stopPropagation()}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                              )}
                            </div>
                            {estado !== null && (asistencias.get(key) as Asistencia | undefined)?.registro_tardio && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                                Registro tardío
                              </Badge>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </>
        )}
      </CardContent>

      {/* Diálogo de historial */}
      <AsistenciaHistorialDialog
        open={historialDialogOpen}
        onOpenChange={setHistorialDialogOpen}
        asistencia={selectedAsistenciaForHistorial ? {
          ...selectedAsistenciaForHistorial,
          estudiante: {
            codigo: estudiantes.find(e => e.id === selectedAsistenciaForHistorial.estudiante_id)?.codigo || '',
            nombre_completo: estudiantes.find(e => e.id === selectedAsistenciaForHistorial.estudiante_id)?.nombre_completo || '',
          },
          aula: selectedAsistenciaForHistorial.aula_id
            ? { id: selectedAsistenciaForHistorial.aula_id, nombre: aulas.find(a => a.id === selectedAsistenciaForHistorial.aula_id)?.nombre || 'Sin aula' }
            : undefined,
        } : null}
        fcpId={fcpId}
      />

      {/* Diálogo habilitar corrección (solo facilitador, mes anterior) */}
      <HabilitarCorreccionDialog
        open={habilitarCorreccionOpen}
        onOpenChange={setHabilitarCorreccionOpen}
        onSuccess={() => {
          refetchCorreccion()
          loadAsistenciasMes()
        }}
        fcpId={fcpId}
        anio={selectedYear}
        mes={mesNum}
        mesLabel={formatMonthYear(selectedMonth, selectedYear)}
      />

      {/* Diálogo mover estudiante a otro salón */}
      {selectedAula && selectedEstudianteForMover && (
        <MoverEstudianteMesDialog
          open={moverEstudianteMesOpen}
          onOpenChange={(open) => {
            setMoverEstudianteMesOpen(open)
            if (!open) setSelectedEstudianteForMover(null)
          }}
          onSuccess={() => {
            loadEstudiantes()
            loadAsistenciasMes()
          }}
          estudiante={selectedEstudianteForMover}
          fcpId={fcpId}
          aulaOrigenId={selectedAula}
          aulaOrigenNombre={aulas.find((a) => a.id === selectedAula)?.nombre || 'Salón'}
          aulas={aulas}
          firstDay={formatDateToLocalString(new Date(selectedYear, selectedMonth, 1))}
          lastDay={formatDateToLocalString(new Date(selectedYear, selectedMonth + 1, 0))}
          mesLabel={formatMonthYear(selectedMonth, selectedYear)}
        />
      )}

      {/* Diálogo quitar estudiante de este mes */}
      {selectedAula && selectedEstudianteForQuitar && (
        <QuitarEstudianteMesDialog
          open={quitarEstudianteMesOpen}
          onOpenChange={(open) => {
            setQuitarEstudianteMesOpen(open)
            if (!open) setSelectedEstudianteForQuitar(null)
          }}
          onSuccess={() => {
            loadEstudiantes()
            loadAsistenciasMes()
          }}
          estudiante={selectedEstudianteForQuitar}
          periodoId={periodosQuitables.get(selectedEstudianteForQuitar.id) ?? null}
          fcpId={fcpId}
          aulaId={selectedAula}
          firstDay={formatDateToLocalString(new Date(selectedYear, selectedMonth, 1))}
          lastDay={formatDateToLocalString(new Date(selectedYear, selectedMonth + 1, 0))}
          mesLabel={formatMonthYear(selectedMonth, selectedYear)}
        />
      )}

      {/* Diálogo agregar estudiante solo para este mes (director/secretario, mes pasado con corrección) */}
      {selectedAula && (
        <AgregarEstudianteMesDialog
          open={agregarEstudianteMesOpen}
          onOpenChange={setAgregarEstudianteMesOpen}
          onSuccess={() => {
            loadEstudiantes()
            loadAsistenciasMes()
          }}
          fcpId={fcpId}
          aulaId={selectedAula}
          aulaNombre={aulas.find((a) => a.id === selectedAula)?.nombre || 'Salón'}
          anio={selectedYear}
          mes={mesNum}
          mesLabel={formatMonthYear(selectedMonth, selectedYear)}
        />
      )}

      {/* Diálogo de confirmación para eliminar asistencias del día */}
      <ConfirmDialog
        open={!!fechaParaEliminar}
        onOpenChange={(open) => {
          if (!open) setFechaParaEliminar(null)
        }}
        title="Eliminar asistencias del día"
        message={
          fechaParaEliminar
            ? (() => {
                const fechaDate = new Date(fechaParaEliminar + 'T00:00:00')
                const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
                const dayName = dayNames[fechaDate.getDay()]
                const dayNumber = fechaDate.getDate()
                return `¿Estás seguro de que deseas eliminar todas las asistencias del ${dayName} ${dayNumber}?`
              })()
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={doEliminarTodasAsistencias}
        loading={!!fechaParaEliminar && savingDates.has(fechaParaEliminar)}
      />
    </Card>
  )
}

