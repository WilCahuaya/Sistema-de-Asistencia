'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, GraduationCap, Upload, Search, ArrowRight, UserX, UserCheck, Edit, ChevronDown, ChevronUp } from 'lucide-react'
import { EstudianteDialog } from './EstudianteDialog'
import { EstudianteEditDialog } from './EstudianteEditDialog'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EstudianteUploadDialog } from './EstudianteUploadDialog'
import { EstudianteMovimientoDialog } from './EstudianteMovimientoDialog'
import { EstudianteRetirarDialog } from './EstudianteRetirarDialog'
import { EstudianteReactivarDialog } from './EstudianteReactivarDialog'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Building2 } from 'lucide-react'
import { toast } from '@/lib/toast'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  activo: boolean
  aula_id: string
  aula?: {
    nombre: string
  }
  tutor?: string // Nombre del tutor del aula asignada
  fcp_id: string
  fcp?: {
    razon_social: string
  }
}

export function EstudianteList() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [estudiantesCompletos, setEstudiantesCompletos] = useState<Estudiante[]>([]) // Todos los estudiantes cargados (sin filtro de búsqueda)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false)
  const [selectedEstudianteForMovimiento, setSelectedEstudianteForMovimiento] = useState<Estudiante | null>(null)
  const [isRetirarDialogOpen, setIsRetirarDialogOpen] = useState(false)
  const [selectedEstudianteForRetirar, setSelectedEstudianteForRetirar] = useState<Estudiante | null>(null)
  const [isReactivarDialogOpen, setIsReactivarDialogOpen] = useState(false)
  const [selectedEstudianteForReactivar, setSelectedEstudianteForReactivar] = useState<Estudiante | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedEstudianteForEdit, setSelectedEstudianteForEdit] = useState<Estudiante | null>(null)
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [loadingFCPs, setLoadingFCPs] = useState(true)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [includeInactivos, setIncludeInactivos] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEstudiantes, setTotalEstudiantes] = useState(0)
  const [tableWidth, setTableWidth] = useState<number | null>(null) // Ancho personalizado de la tabla
  const [isResizingTable, setIsResizingTable] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const aulaIdFromUrl = searchParams.get('aulaId')
  const fcpIdFromUrl = searchParams.get('fcpId')

  // Breakpoint sm (640px): PC = tabla original, móvil = cards con paginación
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const itemsPerPage = isMobile ? 8 : 15 // móvil: 8 por página, PC: 15
  const { selectedRole } = useSelectedRole()
  
  // Usar el rol seleccionado para determinar los flags
  const isDirector = selectedRole?.role === 'director'
  const isSecretario = selectedRole?.role === 'secretario'
  const isTutorState = selectedRole?.role === 'tutor'
  const isFacilitador = selectedRole?.role === 'facilitador'
  
  // Usar el fcpId del rol seleccionado si está disponible
  const fcpIdFromRole = selectedRole?.fcpId
  
  const { canEdit } = useUserRole(selectedFCP || fcpIdFromRole)
  const cardRef = useRef<HTMLDivElement>(null)
  const defaultWidthRef = useRef<number | null>(null) // Ancho por defecto del contenedor

  useEffect(() => {
    loadUserFCPs()
  }, [selectedRole?.role, selectedRole?.fcpId])

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

  // Prioridad: URL (aulaId, fcpId) > rol seleccionado > primera FCP
  useEffect(() => {
    if (loadingFCPs || userFCPs.length === 0) return

    if (fcpIdFromUrl) {
      const fcpDeUrl = userFCPs.find(fcp => fcp.id === fcpIdFromUrl)
      if (fcpDeUrl) {
        setSelectedFCP(fcpIdFromUrl)
        setSelectedAula(aulaIdFromUrl)
        return
      }
    }

    if (fcpIdFromRole && userFCPs.find(fcp => fcp.id === fcpIdFromRole)) {
      setSelectedFCP(fcpIdFromRole)
      if (aulaIdFromUrl) setSelectedAula(aulaIdFromUrl)
      return
    }

    if (!selectedFCP) {
      setSelectedFCP(userFCPs[0].id)
    }
  }, [userFCPs, fcpIdFromRole, fcpIdFromUrl, aulaIdFromUrl, loadingFCPs])

  // Asegurar que selectedFCP esté establecido para secretarios y directores
  useEffect(() => {
    if ((isSecretario || isDirector || isFacilitador) && userFCPs.length > 0 && !selectedFCP) {
      // Priorizar fcpIdFromRole si está disponible
      if (fcpIdFromRole && userFCPs.find(fcp => fcp.id === fcpIdFromRole)) {
        setSelectedFCP(fcpIdFromRole)
      } else {
        setSelectedFCP(userFCPs[0].id)
      }
    }
  }, [isSecretario, isDirector, isFacilitador, userFCPs, selectedFCP, fcpIdFromRole])

  useEffect(() => {
    // Si es tutor, cargar aulas inmediatamente cuando se detecta
    // También cargar si hay un fcpId del rol seleccionado o selectedFCP
    const fcpIdToUse = fcpIdFromRole || selectedFCP
    
    if (isTutorState) {
      loadAulas()
    } else if (fcpIdToUse) {
      loadAulas()
    } else {
      setAulas([])
    }
  }, [selectedFCP, isTutorState, fcpIdFromRole])

  // Este useEffect es redundante, ya está cubierto por el anterior

  useEffect(() => {
    if (selectedFCP || isTutorState) {
      setCurrentPage(1)
      loadEstudiantes()
    } else {
      setEstudiantes([])
      setTotalEstudiantes(0)
    }
  }, [selectedFCP, selectedAula, isTutorState, includeInactivos])

  // Fuente: filtrada por búsqueda o completa
  const sourceList = (() => {
    if (estudiantesCompletos.length === 0) return []
    if (!searchTerm.trim()) return estudiantesCompletos
    const term = searchTerm.toLowerCase().trim()
    return estudiantesCompletos.filter(est =>
      est.nombre_completo.toLowerCase().includes(term) || est.codigo.toLowerCase().includes(term)
    )
  })()

  // En móvil: siempre paginar. En desktop: paginar solo si no hay búsqueda o si la lista es larga
  const effectiveItemsPerPage = isMobile ? itemsPerPage : (searchTerm.trim() ? 9999 : itemsPerPage)
  const totalFiltered = sourceList.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / effectiveItemsPerPage))
  const startIdx = (currentPage - 1) * effectiveItemsPerPage
  const displayEstudiantes = sourceList.slice(startIdx, startIdx + effectiveItemsPerPage)
  const effectiveTotal = totalEstudiantes > 0 && !searchTerm.trim() ? totalEstudiantes : totalFiltered
  const startIndex = searchTerm.trim() ? startIdx + 1 : (currentPage - 1) * itemsPerPage + 1
  const endIndex = searchTerm.trim() ? startIdx + displayEstudiantes.length : Math.min(currentPage * itemsPerPage, effectiveTotal)
  const shouldShowPagination = totalFiltered > effectiveItemsPerPage
  const displayTotal = searchTerm.trim() ? totalFiltered : (totalEstudiantes > 0 ? totalEstudiantes : totalFiltered)

  // Reset página cuando cambia búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const loadUserFCPs = async () => {
    setLoadingFCPs(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingFCPs(false)
        return
      }

      let fcps: Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }> = []

      if (isFacilitador) {
        const { data: d, error: e } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('facilitador_id', user.id)
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        if (!e && d) fcps = d.map((f: any) => ({ id: f.id, nombre: f.razon_social || 'FCP', numero_identificacion: f.numero_identificacion, razon_social: f.razon_social }))
      } else {
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select('fcp_id, fcp:fcps(id, razon_social, numero_identificacion)')
          .eq('usuario_id', user.id)
          .eq('activo', true)
        if (!error && data) {
          fcps = data.map((item: any) => ({
            id: item.fcp?.id,
            nombre: item.fcp?.razon_social || 'FCP',
            numero_identificacion: item.fcp?.numero_identificacion,
            razon_social: item.fcp?.razon_social,
          })).filter((f: any) => f.id) || []
        }
      }

      if (selectedRole?.fcpId) {
        const sole = fcps.find(f => f.id === selectedRole!.fcpId!)
        fcps = sole ? [sole] : []
      }
      if (fcpIdFromRole && selectedRole?.fcp && !fcps.find(f => f.id === fcpIdFromRole)) {
        fcps = [{
          id: fcpIdFromRole,
          nombre: selectedRole.fcp.razon_social || 'FCP',
          numero_identificacion: selectedRole.fcp.numero_identificacion,
          razon_social: selectedRole.fcp.razon_social,
        }]
      }

      setUserFCPs(fcps)
      if (fcps.length > 0) {
        console.log('👥 [EstudianteList] FCPs cargadas:', { fcps: fcps.length, fcpIdFromRole, selectedFCP, rolSeleccionado: selectedRole?.role })
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
    } finally {
      setLoadingFCPs(false)
    }
  }

  const loadAulas = async () => {
    // Determinar el fcpId a usar: selectedFCP o fcpIdFromRole
    const fcpIdToUse = selectedFCP || fcpIdFromRole
    
    if (!fcpIdToUse && !isTutorState) {
      console.log('⚠️ [EstudianteList] No hay FCP seleccionada para cargar aulas')
      setAulas([])
      return
    }

    try {
      const supabase = createClient()
      
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError)
        return
      }

      let data: any[] = []
      let error: any = null

      // Si es tutor, cargar solo las aulas asignadas
      if (isTutorState) {
        // Obtener los fcp_miembros del tutor
        const { data: tutorMiembrosData, error: tutorMiembrosError } = await supabase
          .from('fcp_miembros')
          .select('id, fcp_id')
          .eq('usuario_id', user.id)
          .eq('rol', 'tutor')
          .eq('activo', true)

        if (tutorMiembrosError) {
          console.error('Error obteniendo miembros del tutor:', tutorMiembrosError)
          throw tutorMiembrosError
        }

        console.log('Tutor miembros encontrados:', tutorMiembrosData)

        if (tutorMiembrosData && tutorMiembrosData.length > 0) {
          const tutorMiembroIds = tutorMiembrosData.map((tm: any) => tm.id)
          const tutorFcpId = tutorMiembrosData[0].fcp_id

          console.log('Tutor miembro IDs:', tutorMiembroIds)
          console.log('Tutor FCP ID:', tutorFcpId)

          // Obtener las aulas asignadas al tutor
          let query = supabase
            .from('tutor_aula')
            .select(`
              aula_id,
              fcp_id,
              aula:aulas!inner(id, nombre, activa, fcp_id)
            `)
            .in('fcp_miembro_id', tutorMiembroIds)
            .eq('activo', true)

          // Si tenemos el fcp_id, también filtrar por él para mayor precisión
          if (tutorFcpId) {
            query = query.eq('fcp_id', tutorFcpId)
          }

          const { data: tutorAulasData, error: tutorAulasError } = await query

          if (tutorAulasError) {
            console.error('Error obteniendo aulas del tutor:', tutorAulasError)
            throw tutorAulasError
          }

          console.log('Aulas del tutor encontradas:', tutorAulasData)

          // Extraer las aulas y filtrar solo las activas
          data = (tutorAulasData || [])
            .map((ta: any) => ta.aula)
            .filter((aula: any) => aula && aula.activa)
            .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))

          console.log('Aulas procesadas para el tutor:', data)
        } else {
          console.log('No se encontraron miembros del tutor')
        }
      } else {
        // Para otros roles, cargar todas las aulas de la FCP
        // Usar fcpIdToUse que ya está determinado arriba
        console.log('👥 [EstudianteList] Cargando aulas para FCP:', {
          fcpIdToUse,
          fcpIdFromRole,
          selectedFCP,
          usuario: user.email,
          rolSeleccionado: selectedRole?.role
        })
        
        if (!fcpIdToUse) {
          console.error('❌ [EstudianteList] No hay fcpId disponible para cargar aulas')
          setAulas([])
          return
        }
        
        const { data: aulasData, error: aulasError } = await supabase
          .from('aulas')
          .select('id, nombre')
          .eq('fcp_id', fcpIdToUse)
          .eq('activa', true)
          .order('nombre', { ascending: true })

        data = aulasData || []
        error = aulasError
        
        console.log('👥 [EstudianteList] Aulas encontradas:', {
          cantidad: data?.length || 0,
          aulas: data,
          fcpIdUsado: fcpIdToUse
        })
      }

      if (error) {
        console.error('❌ [EstudianteList] Error cargando aulas:', error)
        throw error
      }
      
      setAulas(data || [])
    } catch (error) {
      console.error('Error loading aulas:', error)
    }
  }

  const loadEstudiantes = async () => {
    // Determinar el fcpId a usar: selectedFCP o fcpIdFromRole
    const fcpIdToUse = selectedFCP || fcpIdFromRole
    
    if (!fcpIdToUse && !isTutorState) {
      console.log('⚠️ [EstudianteList] No hay FCP seleccionada, no se cargarán estudiantes')
      setEstudiantes([])
      setTotalEstudiantes(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError)
        setLoading(false)
        return
      }

      let query: any

      // Si es tutor, cargar solo estudiantes de sus aulas asignadas
      if (isTutorState) {
        // Obtener los fcp_miembros del tutor
        const { data: tutorMiembrosData, error: tutorMiembrosError } = await supabase
          .from('fcp_miembros')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('rol', 'tutor')
          .eq('activo', true)

        if (tutorMiembrosError) {
          throw tutorMiembrosError
        }

        if (tutorMiembrosData && tutorMiembrosData.length > 0) {
          const tutorMiembroIds = tutorMiembrosData.map((tm: any) => tm.id)

          // Obtener las aulas asignadas al tutor
          const { data: tutorAulasData, error: tutorAulasError } = await supabase
            .from('tutor_aula')
            .select('aula_id')
            .in('fcp_miembro_id', tutorMiembroIds)
            .eq('activo', true)

          if (tutorAulasError) {
            throw tutorAulasError
          }

          if (tutorAulasData && tutorAulasData.length > 0) {
            const aulaIds = tutorAulasData.map((ta: any) => ta.aula_id)

            query = supabase
              .from('estudiantes')
              .select(`
                *,
                aula:aulas(id, nombre),
                fcp:fcps(razon_social)
              `)
              .in('aula_id', aulaIds)
            if (!includeInactivos) query = query.eq('activo', true)

            if (selectedAula && aulaIds.includes(selectedAula)) {
              query = query.eq('aula_id', selectedAula)
            }
          } else {
            // No hay aulas asignadas, no hay estudiantes
            setEstudiantes([])
            setLoading(false)
            return
          }
        } else {
          // No es tutor en ninguna FCP
          setEstudiantes([])
          setLoading(false)
          return
        }
      } else {
        // Para otros roles, cargar todos los estudiantes de la FCP
        // Usar fcpIdToUse que puede ser selectedFCP o fcpIdFromRole
        if (!fcpIdToUse) {
          console.error('⚠️ [EstudianteList] No hay fcpId disponible para cargar estudiantes')
          setEstudiantes([])
          setTotalEstudiantes(0)
          setLoading(false)
          return
        }
        
        query = supabase
          .from('estudiantes')
          .select(`
            *,
            aula:aulas(id, nombre),
            fcp:fcps(razon_social)
          `)
          .eq('fcp_id', fcpIdToUse)
        if (!includeInactivos) query = query.eq('activo', true)

        if (selectedAula) {
          query = query.eq('aula_id', selectedAula)
        }
      }

      // NO aplicar filtro de búsqueda aquí - se hará en memoria después de cargar
      // Siempre cargar todos los estudiantes (sin filtro de búsqueda) para poder filtrar en memoria
      
      // Obtener el total de estudiantes usando la misma query pero con count
      // Clonar la query para el conteo sin afectar la query principal
      let countQuery: any
      
      if (isTutorState) {
        // Para tutores, usar la misma lógica pero solo para contar
        const { data: tutorMiembrosData } = await supabase
          .from('fcp_miembros')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('rol', 'tutor')
          .eq('activo', true)

        if (tutorMiembrosData && tutorMiembrosData.length > 0) {
          const tutorMiembroIds = tutorMiembrosData.map((tm: any) => tm.id)
          const { data: tutorAulasData } = await supabase
            .from('tutor_aula')
            .select('aula_id')
            .in('fcp_miembro_id', tutorMiembroIds)
            .eq('activo', true)

          if (tutorAulasData && tutorAulasData.length > 0) {
            const aulaIds = tutorAulasData.map((ta: any) => ta.aula_id)
            countQuery = supabase
              .from('estudiantes')
              .select('id', { count: 'exact', head: true })
              .in('aula_id', aulaIds)
            if (!includeInactivos) countQuery = countQuery.eq('activo', true)
            if (selectedAula && aulaIds.includes(selectedAula)) {
              countQuery = countQuery.eq('aula_id', selectedAula)
            }
            
            // NO aplicar filtro de búsqueda aquí - el conteo será del total sin búsqueda
          }
        }
      } else {
        // Usar fcpIdToUse para el conteo también
        if (!fcpIdToUse) {
          setTotalEstudiantes(0)
        } else {
          countQuery = supabase
            .from('estudiantes')
            .select('id', { count: 'exact', head: true })
            .eq('fcp_id', fcpIdToUse)
          if (!includeInactivos) countQuery = countQuery.eq('activo', true)
          if (selectedAula) {
            countQuery = countQuery.eq('aula_id', selectedAula)
          }
        }
      }
      
      // NO aplicar filtro de búsqueda aquí - el conteo será del total sin búsqueda
      
      // Ejecutar el conteo
      let totalCount = 0
      if (countQuery) {
        const { count, error: countError } = await countQuery
        if (countError) {
          console.error('Error obteniendo conteo:', countError)
        } else {
          totalCount = count || 0
        }
      }
      
      // NO aplicar paginación en la BD - siempre cargar TODOS los estudiantes
      // La paginación y búsqueda se harán en memoria para mayor velocidad
      let finalQuery = query.order('nombre_completo', { ascending: true })
      // No aplicar .range() aquí - cargar todos los estudiantes
      
      const { data, error } = await finalQuery

      if (error) {
        console.error('Error loading estudiantes:', error)
        throw error
      }
      
      let estudiantesCargados = data || []

      // Cargar tutores de las aulas para enriquecer la lista
      const aulaIds = Array.from(new Set(estudiantesCargados.map((e: Estudiante) => e.aula_id).filter(Boolean)))
      const tutorMap = new Map<string, string>()
      const fcpIdParaTutores = fcpIdToUse || (estudiantesCargados[0] as Estudiante & { fcp_id?: string })?.fcp_id

      if (aulaIds.length > 0 && fcpIdParaTutores) {
        const { data: tutorAulasData } = await supabase
          .from('tutor_aula')
          .select(`
            aula_id,
            fcp_miembro:fcp_miembros(
              usuario:usuarios(nombre_completo, email)
            )
          `)
          .eq('fcp_id', fcpIdParaTutores)
          .eq('activo', true)
          .in('aula_id', aulaIds)

        tutorAulasData?.forEach((ta: any) => {
          const fcpMiembro = ta.fcp_miembro
          const usuario = fcpMiembro?.usuario
          const tutorNombre = usuario?.nombre_completo || usuario?.email || 'Sin tutor asignado'
          tutorMap.set(ta.aula_id, tutorNombre)
        })
      }

      // Enriquecer estudiantes con el nombre del tutor
      estudiantesCargados = estudiantesCargados.map((est: Estudiante) => ({
        ...est,
        tutor: tutorMap.get(est.aula_id) || 'Sin tutor',
      }))

      // Guardar TODOS los estudiantes cargados (sin filtro de búsqueda ni paginación)
      setEstudiantesCompletos(estudiantesCargados)
      
      // Aplicar filtro de búsqueda y paginación en memoria
      let estudiantesFiltrados = estudiantesCargados
      
      // Si hay término de búsqueda, filtrar en memoria
      if (searchTerm) {
        const terminoBusqueda = searchTerm.toLowerCase().trim()
        estudiantesFiltrados = estudiantesCargados.filter((est: Estudiante) => 
          est.nombre_completo.toLowerCase().includes(terminoBusqueda) ||
          est.codigo.toLowerCase().includes(terminoBusqueda) ||
          (est.tutor && est.tutor.toLowerCase().includes(terminoBusqueda))
        )
      }
      
      // Aplicar paginación solo si NO hay búsqueda
      if (!searchTerm) {
        const from = (currentPage - 1) * itemsPerPage
        const to = from + itemsPerPage
        estudiantesFiltrados = estudiantesFiltrados.slice(from, to)
      }
      
      setEstudiantes(estudiantesFiltrados)
      setTotalEstudiantes(totalCount || 0)
      console.log('Estudiantes cargados:', estudiantesCargados.length, 'Filtrados:', estudiantesFiltrados.length, 'Total en BD:', totalCount, 'Página actual:', currentPage, 'Búsqueda:', searchTerm)
      
      // Log para debug de paginación
      if (totalCount) {
        const calculatedPages = Math.ceil(totalCount / itemsPerPage)
        console.log('Paginación:', {
          totalEstudiantes: totalCount,
          itemsPerPage,
          totalPages: calculatedPages,
          currentPage,
          mostrarPaginacion: !searchTerm && totalCount > itemsPerPage
        })
      }
    } catch (error: any) {
      console.error('Error loading estudiantes:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEstudianteCreated = () => {
    loadEstudiantes()
    setIsDialogOpen(false)
  }

  const handleUploadSuccess = () => {
    if ((isSecretario || isDirector) && !selectedFCP && userFCPs.length > 0) {
      setSelectedFCP(userFCPs[0].id)
    }
    loadEstudiantes()
    setIsUploadDialogOpen(false)
  }

  const handleRetirar = (est: Estudiante) => {
    setSelectedEstudianteForRetirar(est)
    setIsRetirarDialogOpen(true)
  }

  const handleReactivar = (est: Estudiante) => {
    setSelectedEstudianteForReactivar(est)
    setIsReactivarDialogOpen(true)
  }

  if (loadingFCPs) {
    return <div className="text-center py-8">Cargando estudiantes...</div>
  }

  if (userFCPs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes FCPs asociadas. Primero crea o únete a una FCP.
          </p>
          <Button onClick={() => router.push('/fcps')}>
            Ir a FCPs
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="text-center py-8">Cargando estudiantes...</div>
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        {/* Mostrar información de FCP para directores y secretarios */}
        {(isDirector || isSecretario || isTutorState) && (selectedFCP || (isTutorState && userFCPs.length > 0)) && userFCPs.length > 0 && (() => {
          const fcpIdToUse = selectedFCP || (isTutorState && userFCPs.length > 0 ? userFCPs[0].id : null)
          const fcp = userFCPs.find(fcp => fcp.id === fcpIdToUse) || (isTutorState && userFCPs.length > 0 ? userFCPs[0] : null)
          return (
            <div className="mb-4 p-3 bg-muted border border-border rounded-md">
              <p className="text-sm font-medium text-foreground">
                <strong>PROYECTO:</strong> {fcp?.numero_identificacion || ''} {fcp?.razon_social || 'FCP'}
              </p>
            </div>
          )
        })()}
        <div className={`flex flex-col sm:flex-row gap-4 ${(isDirector || isSecretario || isTutorState) ? '' : ''}`}>
          {/* El selector de FCP no se muestra para directores, secretarios ni tutores */}
          {!isDirector && !isSecretario && !isTutorState && (
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Seleccionar FCP:</label>
              <Select
                value={selectedFCP || ''}
                onValueChange={(value) => {
                  setSelectedFCP(value)
                  setSelectedAula(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar FCP">
                    {selectedFCP ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="truncate">{userFCPs.find(fcp => fcp.id === selectedFCP)?.nombre || 'Seleccionar FCP'}</span>
                      </div>
                    ) : (
                      'Seleccionar FCP'
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
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filtrar por Aula (opcional):</label>
            <Select
              value={selectedAula || '__all__'}
              onValueChange={(value) => {
                const aulaId = value === '__all__' ? null : value
                // Si es tutor, validar que el aula seleccionada esté en sus aulas asignadas
                if (isTutorState && aulaId) {
                  const aulaExists = aulas.some(aula => aula.id === aulaId)
                  if (!aulaExists) {
                    // Si el aula no está en la lista del tutor, no seleccionarla
                    return
                  }
                }
                setSelectedAula(aulaId)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las aulas">
                  {selectedAula ? (
                    aulas.find(aula => aula.id === selectedAula)?.nombre || 'Todas las aulas'
                  ) : (
                    'Todas las aulas'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las aulas</SelectItem>
              {aulas.map((aula) => (
                  <SelectItem key={aula.id} value={aula.id}>
                  {aula.nombre}
                  </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-inactivos"
              checked={includeInactivos}
              onCheckedChange={(v) => {
                setIncludeInactivos(!!v)
                setCurrentPage(1)
              }}
            />
            <Label htmlFor="include-inactivos" className="text-sm font-normal cursor-pointer whitespace-nowrap">
              Incluir inactivos
            </Label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  // El useEffect manejará el debounce y reseteará la página
                }}
                className="pl-10"
              />
              {searchTerm && loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {(isDirector || isSecretario) && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(true)}
                  disabled={!selectedFCP || aulas.length === 0}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Cargar Excel
                </Button>
                <Button 
                  onClick={() => setIsDialogOpen(true)} 
                  disabled={!selectedFCP || aulas.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Estudiante
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {aulas.length === 0 && selectedFCP ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {isFacilitador ? 'No hay aulas registradas.' : 'No hay aulas registradas. Primero crea aulas para esta FCP.'}
            </p>
            {!isFacilitador && (
              <Button onClick={() => router.push('/aulas')}>
                Ir a Aulas
              </Button>
            )}
          </CardContent>
        </Card>
      ) : displayEstudiantes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No se encontraron estudiantes con ese criterio' : 'No hay estudiantes registrados'}
            </p>
            <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
              <div className="flex gap-2">
                <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedFCP || aulas.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Estudiante
                </Button>
                {selectedFCP && aulas.length > 0 && (
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Cargar desde Excel
                  </Button>
                )}
              </div>
            </RoleGuard>
          </CardContent>
        </Card>
      ) : (
        <Card ref={cardRef} className="relative mx-auto w-full overflow-visible md:max-w-[100%]" style={{ 
          width: tableWidth 
            ? `${tableWidth}px` 
            : (defaultWidthRef.current 
              ? `${defaultWidthRef.current}px` 
              : '100%'), 
          maxWidth: tableWidth 
            ? `${tableWidth}px` 
            : (defaultWidthRef.current 
              ? `${defaultWidthRef.current}px` 
              : '100%'), 
          overflow: 'visible' 
        }}>
          {/* Resizer handle - oculto en móvil */}
          <div
            className="absolute top-0 right-0 hidden w-4 h-full cursor-col-resize hover:bg-primary/60 opacity-0 hover:opacity-100 transition-opacity z-50 md:block"
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
            <CardTitle>
              Estudiantes ({displayTotal} {displayTotal === 1 ? 'estudiante' : 'estudiantes'})
              {searchTerm && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (filtrado de {totalEstudiantes} total)
                </span>
              )}
            </CardTitle>
              {tableWidth && (
                <span className="hidden text-xs text-muted-foreground md:inline">
                  Ancho tabla: {tableWidth}px | Arrastra el borde derecho para ajustar
                </span>
              )}
              {!tableWidth && (
                <span className="hidden text-xs text-muted-foreground opacity-60 md:inline">
                  Arrastra el borde derecho de la tarjeta para expandir la tabla
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Móvil (<640px): cards. PC (≥640px): tabla como antes */}
            {isMobile ? (
              <div className="space-y-3">
                {displayEstudiantes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    {searchTerm ? 'No se encontraron estudiantes' : 'No hay estudiantes'}
                  </p>
                ) : (
                  displayEstudiantes.map((estudiante) => {
                    const isExpanded = expandedCardId === estudiante.id
                    return (
                      <Card key={estudiante.id} className="overflow-hidden">
                        <div
                          className="p-4 cursor-pointer active:bg-muted/50"
                          onClick={() => setExpandedCardId(isExpanded ? null : estudiante.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-sm text-muted-foreground">{estudiante.codigo}</p>
                              <p className="font-medium truncate">{estudiante.nombre_completo}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  estudiante.activo
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                }`}
                              >
                                {estudiante.activo ? 'Activo' : 'Inactivo'}
                              </span>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Aula:</span> {estudiante.aula?.nombre || 'Sin aula'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Tutor:</span> {estudiante.tutor || 'Sin tutor'}
                              </p>
                              <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']} fallback={null}>
                                <div className="flex gap-2 pt-2">
                                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedEstudianteForEdit(estudiante); setIsEditDialogOpen(true) }}>
                                    <Edit className="h-4 w-4 mr-1" />
                                    Editar
                                  </Button>
                                  {estudiante.activo ? (
                                    <Button variant="outline" size="sm" onClick={() => handleRetirar(estudiante)} title="Retirar estudiante">
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={() => handleReactivar(estudiante)} title="Reactivar en salón">
                                      <UserCheck className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => { setSelectedEstudianteForMovimiento(estudiante); setIsMovimientoDialogOpen(true) }} disabled={!estudiante.activo || aulas.length <= 1} title="Cambiar de salón">
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </RoleGuard>
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground md:hidden">Desliza para ver más columnas →</p>
                <div className="table-responsive overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Aula</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayEstudiantes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? 'No se encontraron estudiantes con ese criterio' : 'No hay estudiantes'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayEstudiantes.map((estudiante) => (
                          <TableRow key={estudiante.id}>
                            <TableCell className="font-mono">{estudiante.codigo}</TableCell>
                            <TableCell>{estudiante.nombre_completo}</TableCell>
                            <TableCell>{estudiante.aula?.nombre || 'Sin aula'}</TableCell>
                            <TableCell className="text-muted-foreground">{estudiante.tutor || 'Sin tutor'}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  estudiante.activo
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                }`}
                              >
                                {estudiante.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <RoleGuard
                                fcpId={selectedFCP}
                                allowedRoles={['director', 'secretario']}
                                fallback={<span className="text-sm text-muted-foreground">Solo lectura</span>}
                              >
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedEstudianteForEdit(estudiante); setIsEditDialogOpen(true) }} title="Editar datos del estudiante">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {estudiante.activo ? (
                                    <Button variant="ghost" size="sm" onClick={() => handleRetirar(estudiante)} title="Retirar estudiante">
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" onClick={() => handleReactivar(estudiante)} title="Reactivar en salón">
                                      <UserCheck className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedEstudianteForMovimiento(estudiante); setIsMovimientoDialogOpen(true) }} disabled={!estudiante.activo || aulas.length <= 1} title="Cambiar de salón">
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </RoleGuard>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {shouldShowPagination && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex} - {endIndex} de {displayTotal} estudiantes
                  </div>
                  <div className="flex-1 flex justify-center">
                    <Pagination>
                      <PaginationContent className="gap-2">
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              if (currentPage > 1) {
                                setCurrentPage(currentPage - 1)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }
                            }}
                            className={`${
                              currentPage === 1 
                                ? 'pointer-events-none opacity-50 cursor-not-allowed' 
                                : 'cursor-pointer hover:bg-primary hover:text-primary-foreground'
                            } transition-colors`}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Mostrar primera página, última página, página actual y páginas adyacentes
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setCurrentPage(page)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                  }}
                                  isActive={currentPage === page}
                                  className="cursor-pointer min-w-[2.5rem] transition-colors hover:bg-primary hover:text-primary-foreground"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis className="px-2" />
                              </PaginationItem>
                            )
                          }
                          return null
                        })}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              if (currentPage < totalPages) {
                                setCurrentPage(currentPage + 1)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }
                            }}
                            className={`${
                              currentPage === totalPages 
                                ? 'pointer-events-none opacity-50 cursor-not-allowed' 
                                : 'cursor-pointer hover:bg-primary hover:text-primary-foreground'
                            } transition-colors`}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                  <div className="text-sm text-muted-foreground sm:block hidden">
                    Página {currentPage} de {totalPages}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <EstudianteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleEstudianteCreated}
        fcpId={selectedFCP || ''}
        aulaId={selectedAula || undefined}
        aulas={aulas}
      />

      <EstudianteUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={handleUploadSuccess}
        fcpId={selectedFCP || ''}
        aulas={aulas}
      />

      {selectedEstudianteForEdit && (
        <EstudianteEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setSelectedEstudianteForEdit(null)
          }}
          onSuccess={() => {
            loadEstudiantes()
            setIsEditDialogOpen(false)
            setSelectedEstudianteForEdit(null)
          }}
          estudiante={selectedEstudianteForEdit}
        />
      )}

      {selectedEstudianteForMovimiento && (
        <EstudianteMovimientoDialog
          open={isMovimientoDialogOpen}
          onOpenChange={(open) => {
            setIsMovimientoDialogOpen(open)
            if (!open) setSelectedEstudianteForMovimiento(null)
          }}
          onSuccess={() => {
            loadEstudiantes()
            setIsMovimientoDialogOpen(false)
            setSelectedEstudianteForMovimiento(null)
          }}
          estudiante={selectedEstudianteForMovimiento}
          aulas={aulas}
        />
      )}

      {selectedEstudianteForRetirar && (
        <EstudianteRetirarDialog
          open={isRetirarDialogOpen}
          onOpenChange={(open) => {
            setIsRetirarDialogOpen(open)
            if (!open) setSelectedEstudianteForRetirar(null)
          }}
          onSuccess={() => {
            loadEstudiantes()
            setIsRetirarDialogOpen(false)
            setSelectedEstudianteForRetirar(null)
          }}
          estudiante={selectedEstudianteForRetirar}
        />
      )}

      {selectedEstudianteForReactivar && (
        <EstudianteReactivarDialog
          open={isReactivarDialogOpen}
          onOpenChange={(open) => {
            setIsReactivarDialogOpen(open)
            if (!open) setSelectedEstudianteForReactivar(null)
          }}
          onSuccess={() => {
            loadEstudiantes()
            setIsReactivarDialogOpen(false)
            setSelectedEstudianteForReactivar(null)
          }}
          estudiante={selectedEstudianteForReactivar}
          aulas={aulas}
        />
      )}
    </div>
  )
}

