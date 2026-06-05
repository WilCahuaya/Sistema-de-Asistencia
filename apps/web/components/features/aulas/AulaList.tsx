'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Plus, GraduationCap, Edit, Building2, Eye, EyeOff, Search, ClipboardCheck, Trash2, XCircle, MoreVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AulaDialog } from './AulaDialog'
import { AulaTutorDialog } from './AulaTutorDialog'
import { AulaEditDialog } from './AulaEditDialog'
import { ordenarSucursales, type Sucursal } from './SucursalField'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/useUserRole'
import { toast } from '@/lib/toast'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import type { AulaTipo, EstadoIntervencion } from '@/lib/utils/aulaIntervencion'
import {
  ESTADO_INTERVENCION_CLASS,
  ESTADO_INTERVENCION_LABEL,
  formatTemporada,
  intervencionTemporadaVencida,
} from '@/lib/utils/aulaIntervencion'

interface TutorInfo {
  id?: string
  email?: string
  nombre_completo?: string
  /** Usado cuando el tutor es invitación pendiente (sin usuario) o tiene nombre_display */
  displayName?: string
}

/** Valor numérico de `aulas.orden` desde la API (p. ej. string en algunos clientes) */
function ordenNumerico(orden: unknown): number {
  if (typeof orden === 'number' && Number.isFinite(orden)) return orden
  if (typeof orden === 'string' && orden.trim() !== '') {
    const n = Number(orden)
    if (Number.isFinite(n)) return n
  }
  return 0
}

/** Salones de una sucursal y tipo en el mismo orden que usa el listado (orden → nombre → id). */
function aulasDeSucursalOrdenadas(list: Aula[], sucursalId: string, tipo?: AulaTipo): Aula[] {
  return list
    .filter((a) => a.sucursal_id === sucursalId && (!tipo || (a.tipo ?? 'REGULAR') === tipo))
    .sort((a, b) => {
      const oa = ordenNumerico(a.orden)
      const ob = ordenNumerico(b.orden)
      if (oa !== ob) return oa - ob
      const na = (a.nombre || '').localeCompare(b.nombre || '')
      if (na !== 0) return na
      return a.id.localeCompare(b.id)
    })
}

interface Aula {
  id: string
  nombre: string
  codigo_aula?: string
  /** Orden de listado en la FCP (reordenar salones con el mismo nombre) */
  orden?: number
  descripcion?: string
  activa: boolean
  fcp_id: string
  sucursal_id?: string
  sucursal?: Sucursal
  fcp?: {
    razon_social: string
  }
  tutor?: TutorInfo
  /** ID de la fila tutor_aula para actualizar puede_registrar_asistencia */
  tutorAulaId?: string
  tutorPuedeRegistrarAsistencia?: boolean
  tipo?: AulaTipo
  fecha_inicio?: string | null
  fecha_fin?: string | null
  estado_intervencion?: EstadoIntervencion | null
}

export function AulaList() {
  const [aulas, setAulas] = useState<Aula[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTutorDialogOpen, setIsTutorDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedAulaForTutor, setSelectedAulaForTutor] = useState<Aula | null>(null)
  const [editingAula, setEditingAula] = useState<Aula | null>(null)
  const [vaciarSalonAula, setVaciarSalonAula] = useState<Aula | null>(null)
  const [vaciarLoading, setVaciarLoading] = useState(false)
  const [eliminarAula, setEliminarAula] = useState<Aula | null>(null)
  const [eliminarLoading, setEliminarLoading] = useState(false)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [eliminarSucursal, setEliminarSucursal] = useState<Sucursal | null>(null)
  const [eliminarSucursalLoading, setEliminarSucursalLoading] = useState(false)
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [loadingFCPs, setLoadingFCPs] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [reordenandoId, setReordenandoId] = useState<string | null>(null)
  const [vistaTipo, setVistaTipo] = useState<AulaTipo>('REGULAR')
  const router = useRouter()
  const { selectedRole } = useSelectedRole()
  
  // Usar el rol seleccionado para determinar los flags
  const isDirector = selectedRole?.role === 'director'
  const isSecretario = selectedRole?.role === 'secretario'
  const isTutorState = selectedRole?.role === 'tutor'
  const isFacilitador = selectedRole?.role === 'facilitador'
  
  // Usar el fcpId del rol seleccionado si está disponible
  const fcpIdFromRole = selectedRole?.fcpId
  const fcpIdForRole = selectedFCP || fcpIdFromRole

  const {
    isTutor,
    isFacilitador: isFacilitadorFromHook,
    role: roleInFcp,
    loading: userRoleLoading,
    membershipsLoading,
    rolesInFcp,
  } = useUserRole(fcpIdForRole)

  /** Un solo criterio para toda la lista (evita N×RoleGuard + N×useUserRole con estados desincronizados). */
  const canManageAulas =
    !userRoleLoading &&
    !membershipsLoading &&
    ((roleInFcp !== null && (roleInFcp === 'director' || roleInFcp === 'secretario')) ||
      rolesInFcp.some((r) => r === 'director' || r === 'secretario'))

  useEffect(() => {
    loadUserFCPs()
  }, [selectedRole?.role, selectedRole?.fcpId])

  useEffect(() => {
    // Si hay un rol seleccionado con fcpId, usarlo
    if (fcpIdFromRole && !selectedFCP) {
      console.log('📚 [AulaList] Usando fcpId del rol seleccionado:', fcpIdFromRole)
      setSelectedFCP(fcpIdFromRole)
    } else if (userFCPs.length > 0 && !selectedFCP && !fcpIdFromRole) {
      // Si no hay rol seleccionado, usar la primera FCP disponible
      setSelectedFCP(userFCPs[0].id)
    }
  }, [userFCPs, fcpIdFromRole, selectedFCP])

  useEffect(() => {
    if (selectedFCP || isTutorState) {
      loadAulas()
    }
  }, [selectedFCP, isTutorState, showInactive])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const aulasPorVista = aulas.filter((a) => (a.tipo ?? 'REGULAR') === vistaTipo)

  const filteredAulas = searchTerm.trim()
    ? aulasPorVista.filter((a) => {
        const term = searchTerm.toLowerCase()
        const nombre = a.nombre?.toLowerCase() || ''
        const desc = a.descripcion?.toLowerCase() || ''
        const codigo = a.codigo_aula?.toLowerCase() || ''
        const tutor = a.tutor?.displayName?.toLowerCase() || a.tutor?.nombre_completo?.toLowerCase() || a.tutor?.email?.toLowerCase() || ''
        return nombre.includes(term) || desc.includes(term) || tutor.includes(term) || codigo.includes(term)
      })
    : aulasPorVista

  /** Datos de la sucursal de un aula (desde la lista cargada o desde el join). */
  const sucursalDeAula = (a: Aula): Sucursal | undefined =>
    sucursales.find((s) => s.id === a.sucursal_id) || a.sucursal

  /** Aulas ordenadas por grupo: sucursal predeterminada primero, luego por orden/nombre de sucursal, y dentro por orden/nombre del aula. */
  const orderedAulas = [...filteredAulas].sort((a, b) => {
    const sa = sucursalDeAula(a)
    const sb = sucursalDeAula(b)
    const pa = sa?.es_predeterminada ? 0 : 1
    const pb = sb?.es_predeterminada ? 0 : 1
    if (pa !== pb) return pa - pb
    const oa = sa?.orden ?? 0
    const ob = sb?.orden ?? 0
    if (oa !== ob) return oa - ob
    const sn = (sa?.nombre || '').localeCompare(sb?.nombre || '')
    if (sn !== 0) return sn
    const ada = ordenNumerico(a.orden)
    const adb = ordenNumerico(b.orden)
    if (ada !== adb) return ada - adb
    return (a.nombre || '').localeCompare(b.nombre || '')
  })

  /** Sucursales (no predeterminadas) sin aulas: candidatas a eliminación. */
  const sucursalesVacias = sucursales.filter(
    (s) => !s.es_predeterminada && !aulas.some((a) => a.sucursal_id === s.id)
  )

  const itemsPerPage = isMobile ? 8 : 24
  const totalPages = Math.max(1, Math.ceil(orderedAulas.length / itemsPerPage))
  const displayAulas = orderedAulas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const shouldShowPagination = orderedAulas.length > itemsPerPage

  useEffect(() => setCurrentPage(1), [searchTerm, vistaTipo])

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
        console.log('📚 [AulaList] FCPs cargadas:', { fcps: fcps.length, fcpIdFromRole, selectedFCP, rolSeleccionado: selectedRole?.role })
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
    } finally {
      setLoadingFCPs(false)
    }
  }

  const loadAulas = async () => {
    if (!selectedFCP && !isTutorState) return

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError)
        setError('Error de autenticación. Por favor, inicia sesión nuevamente.')
        setLoading(false)
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
          throw tutorMiembrosError
        }

        if (tutorMiembrosData && tutorMiembrosData.length > 0) {
          const tutorMiembroIds = tutorMiembrosData.map((tm: any) => tm.id)
          const tutorFcpId = tutorMiembrosData[0].fcp_id

          // Si no hay selectedFCP, usar la FCP del tutor
          if (!selectedFCP && tutorFcpId) {
            setSelectedFCP(tutorFcpId)
          }

          // Obtener las aulas asignadas al tutor
          const { data: tutorAulasData, error: tutorAulasError } = await supabase
            .from('tutor_aula')
            .select(`
              aula_id,
              aula:aulas(*, sucursal:sucursales(id, nombre, es_predeterminada, orden))
            `)
            .in('fcp_miembro_id', tutorMiembroIds)
            .eq('activo', true)

          if (tutorAulasError) {
            throw tutorAulasError
          }

          // Extraer las aulas y filtrar solo las activas
          data = (tutorAulasData || [])
            .map((ta: any) => ta.aula)
            .filter((aula: any) => aula && aula.activa)
            .sort((a: any, b: any) => {
              const oa = ordenNumerico(a.orden)
              const ob = ordenNumerico(b.orden)
              if (oa !== ob) return oa - ob
              return a.nombre.localeCompare(b.nombre)
            })
        }
      } else {
        // Para otros roles, cargar todas las aulas de la FCP
        // Usar el fcpId del rol seleccionado si está disponible, de lo contrario usar selectedFCP
        const fcpIdToUse = fcpIdFromRole || selectedFCP
        
        console.log('📚 [AulaList] Cargando aulas para FCP:', {
          fcpIdToUse,
          fcpIdFromRole,
          selectedFCP,
          usuario: user.email,
          rolSeleccionado: selectedRole?.role
        })
        
        if (!fcpIdToUse) {
          console.error('❌ [AulaList] No hay fcpId disponible para cargar aulas')
          setError('No se pudo determinar la FCP para cargar las aulas')
          setLoading(false)
          return
        }
        
        // Construir la consulta base (no ordenar por "orden" en SQL: la columna existe tras migración;
        // si aún no está aplicada, ORDER BY orden rompe la consulta — se ordena abajo en el cliente)
        let aulasQuery = supabase
          .from('aulas')
          .select('*, sucursal:sucursales(id, nombre, es_predeterminada, orden)')
          .eq('fcp_id', fcpIdToUse)
          .order('nombre', { ascending: true })
        
        // Si no se muestran inactivos, filtrar solo las activas
        if (!showInactive) {
          aulasQuery = aulasQuery.eq('activa', true)
        }
        
        const { data: aulasData, error: aulasError } = await aulasQuery

        const raw = aulasData || []
        data = [...raw].sort((a: any, b: any) => {
          const oa = ordenNumerico(a.orden)
          const ob = ordenNumerico(b.orden)
          if (oa !== ob) return oa - ob
          return (a.nombre || '').localeCompare(b.nombre || '')
        })
        error = aulasError
      }

      if (error) {
        console.error('Error loading aulas:', error)
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        setError(`Error al cargar aulas: ${error.message} (Código: ${error.code})`)
        setAulas([])
        return
      }
      
      console.log('Aulas encontradas:', data?.length || 0, data)
      
      setError(null)
      
      // Determinar la FCP a usar (selectedFCP o la del tutor)
      const fcpIdToUse = selectedFCP || (isTutorState && userFCPs.length > 0 ? userFCPs[0].id : null)
      
      // Agregar información de FCP si está disponible en userFCPs
      const fcpInfo = userFCPs.find(fcp => fcp.id === fcpIdToUse) || (isTutorState && userFCPs.length > 0 ? userFCPs[0] : null)
      const aulasBase = (data || []).map(aula => ({
        ...aula,
        fcp: fcpInfo ? { razon_social: fcpInfo.nombre } : undefined
      }))
      
      // Cargar información de tutores asignados a cada aula
      // Directores, secretarios y facilitadores pueden ver los tutores
      let aulasWithTutors = aulasBase
      
      if (aulasBase.length > 0) {
        // Cargar todos los tutores asignados a las aulas de una vez
        const aulaIds = aulasBase.map(a => a.id)
        // Usar el fcp_id de las aulas cargadas (más fiable que fcpIdFromRole/selectedFCP para facilitadores)
        const fcpIdForTutores = aulasBase[0]?.fcp_id || fcpIdFromRole || selectedFCP
        
        if (!fcpIdForTutores) {
          console.warn('⚠️ [AulaList] No hay fcpId para cargar tutores')
        } else {
          const { data: tutoresData, error: tutoresError } = await supabase
            .from('tutor_aula')
            .select(`
              id,
              aula_id,
              puede_registrar_asistencia,
              fcp_miembro:fcp_miembros!inner(
                id,
                nombre_display,
                email_pendiente,
                usuario:usuarios(id, email, nombre_completo)
              )
            `)
            .in('aula_id', aulaIds)
            .eq('activo', true)
            .eq('fcp_id', fcpIdForTutores)
        
          if (tutoresError) {
            console.error('Error cargando tutores:', tutoresError)
          } else {
            const tutoresMap = new Map<string, TutorInfo>()
            const tutorAulaMap = new Map<string, { id: string; puedeRegistrar: boolean }>()
            if (tutoresData) {
              tutoresData.forEach((tutorData: any) => {
                if (!tutorData.fcp_miembro || tutoresMap.has(tutorData.aula_id)) return
                const fm = tutorData.fcp_miembro
                const usuario = fm.usuario
                const displayName =
                  (fm.nombre_display?.trim() || usuario?.nombre_completo?.trim() || usuario?.email || fm.email_pendiente) ?? ''
                tutoresMap.set(tutorData.aula_id, {
                  id: usuario?.id,
                  email: usuario?.email ?? fm.email_pendiente ?? '',
                  nombre_completo: usuario?.nombre_completo ?? '',
                  displayName: displayName || '(Pendiente de registro)'
                })
                tutorAulaMap.set(tutorData.aula_id, {
                  id: tutorData.id,
                  puedeRegistrar: !!tutorData.puede_registrar_asistencia
                })
              })
            }
            
            aulasWithTutors = aulasBase.map(aula => {
              const ta = tutorAulaMap.get(aula.id)
              return {
                ...aula,
                tutor: tutoresMap.get(aula.id),
                tutorAulaId: ta?.id,
                tutorPuedeRegistrarAsistencia: ta?.puedeRegistrar ?? false
              }
            })
          }
        }
      }
      
      setAulas(aulasWithTutors)

      // Cargar las sucursales de la FCP (para agrupar y gestionar)
      const fcpIdSucursales = aulasBase[0]?.fcp_id || fcpIdFromRole || selectedFCP || fcpIdToUse
      if (fcpIdSucursales) {
        await loadSucursales(fcpIdSucursales)
      }
    } catch (error: any) {
      console.error('Error loading aulas:', error)
      setError(`Error inesperado: ${error.message || 'Error desconocido'}`)
      setAulas([])
    } finally {
      setLoading(false)
    }
  }

  const loadSucursales = async (fcpId: string) => {
    if (!fcpId) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, es_predeterminada, orden')
        .eq('fcp_id', fcpId)
        .eq('activa', true)
      if (error) {
        console.error('Error cargando sucursales:', error)
        return
      }
      setSucursales(ordenarSucursales((data as Sucursal[]) || []))
    } catch (e) {
      console.error('Error cargando sucursales:', e)
    }
  }

  const handleAulaCreated = () => {
    loadAulas()
    setIsDialogOpen(false)
  }

  const handleTutorAssigned = () => {
    loadAulas()
    setIsTutorDialogOpen(false)
    setSelectedAulaForTutor(null)
  }

  const handleAulaUpdated = () => {
    loadAulas()
    setIsEditDialogOpen(false)
    setEditingAula(null)
  }

  const handleAssignTutor = (aula: Aula) => {
    setSelectedAulaForTutor(aula)
    setIsTutorDialogOpen(true)
  }

  /** Reordenar salones dentro de la sucursal (intercambia `orden` con el vecino del grupo; recalcula códigos en BD). */
  const handleMoveOrden = async (aula: Aula, dir: 'up' | 'down') => {
    if (!aula.sucursal_id) return
    const siblings = aulasDeSucursalOrdenadas(aulas, aula.sucursal_id, aula.tipo ?? 'REGULAR')
    if (siblings.length <= 1) return
    const idx = siblings.findIndex((a) => a.id === aula.id)
    const j = dir === 'up' ? idx - 1 : idx + 1
    if (j < 0 || j >= siblings.length) return
    const other = siblings[j]
    let ordA = ordenNumerico(aula.orden)
    let ordB = ordenNumerico(other.orden)
    if (ordA === ordB) {
      ordA = idx
      ordB = j
    }
    try {
      setReordenandoId(aula.id)
      const supabase = createClient()
      const { error: e1 } = await supabase.from('aulas').update({ orden: ordB }).eq('id', aula.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('aulas').update({ orden: ordA }).eq('id', other.id)
      if (e2) throw e2
      toast.success('Orden actualizado', 'Los códigos de salón se recalcularon en esta FCP.')
      await loadAulas()
    } catch (e: unknown) {
      toast.error('No se pudo reordenar', e instanceof Error ? e.message : 'Intenta de nuevo')
    } finally {
      setReordenandoId(null)
    }
  }

  const handleToggleHabilitarRegistro = async (aula: Aula, checked: boolean) => {
    if (!aula.tutorAulaId) return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tutor_aula')
        .update({ puede_registrar_asistencia: checked })
        .eq('id', aula.tutorAulaId)

      if (error) throw error

      setAulas((prev) =>
        prev.map((a) =>
          a.id === aula.id ? { ...a, tutorPuedeRegistrarAsistencia: checked } : a
        )
      )

      if (checked) {
        toast.success('Registro habilitado', `El tutor de ${aula.nombre} ahora puede registrar asistencias.`)
      } else {
        toast.info('Registro deshabilitado', `El tutor de ${aula.nombre} ya no puede registrar asistencias.`)
      }
    } catch (err: any) {
      toast.error('Error al actualizar', err?.message || 'Intenta nuevamente.')
    }
  }

  if (loadingFCPs) {
    return <div className="text-center py-8">Cargando aulas...</div>
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
    return <div className="text-center py-8">Cargando aulas...</div>
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={() => selectedFCP && loadAulas()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      {/* Mostrar información de FCP para directores, secretarios y tutores */}
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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* El selector de FCP no se muestra para directores, secretarios ni tutores */}
        {!isDirector && !isSecretario && !isTutorState && (
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Seleccionar FCP:</label>
            <Select
              value={selectedFCP || ''}
              onValueChange={(value) => setSelectedFCP(value)}
            >
              <SelectTrigger className="w-full sm:w-auto">
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
        
        <div className="flex items-center gap-4 flex-wrap">
          <div className="inline-flex rounded-lg border p-0.5 bg-muted/50">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                vistaTipo === 'REGULAR' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
              }`}
              onClick={() => setVistaTipo('REGULAR')}
            >
              Regulares
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                vistaTipo === 'INTERVENTION' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
              }`}
              onClick={() => setVistaTipo('INTERVENTION')}
            >
              Intervenciones
            </button>
          </div>

          {/* Toggle para mostrar aulas inactivas - solo para directores y secretarios */}
          {canManageAulas && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full 
                         border transition-all duration-300 ease-in-out
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2
                         ${showInactive 
                           ? 'bg-primary/10 border-primary/50 text-primary hover:bg-primary/20' 
                           : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                         }`}
            >
              {showInactive ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {showInactive ? 'Ocultando inactivas' : 'Mostrar inactivas'}
              </span>
            </button>
          )}
          
          {canManageAulas && (
            <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedFCP}>
              <Plus className="mr-2 h-4 w-4" />
              {vistaTipo === 'INTERVENTION' ? 'Crear Intervención' : 'Crear Aula'}
            </Button>
          )}
        </div>
      </div>

      {aulasPorVista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              {isTutor
                ? vistaTipo === 'INTERVENTION'
                  ? 'No tienes intervenciones asignadas.'
                  : 'No tienes aulas asignadas. Contacta a un facilitador para que te asigne las aulas que debes gestionar.'
                : vistaTipo === 'INTERVENTION'
                  ? 'No hay intervenciones registradas para esta FCP.'
                  : 'No hay aulas registradas para esta FCP.'}
            </p>
            {canManageAulas && (
              <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedFCP}>
                <Plus className="mr-2 h-4 w-4" />
                {vistaTipo === 'INTERVENTION' ? 'Crear primera intervención' : 'Crear primera aula'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, descripción o tutor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {displayAulas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              {searchTerm ? 'No se encontraron aulas' : 'No hay aulas'}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayAulas.map((aula, i) => {
                const handleVerEstudiantes = () => router.push(`/estudiantes?aulaId=${aula.id}&fcpId=${aula.fcp_id}`)
                const prev = i > 0 ? displayAulas[i - 1] : null
                const suc = sucursalDeAula(aula)
                const esInt = (aula.tipo ?? 'REGULAR') === 'INTERVENTION'
                const estadoInt = aula.estado_intervencion ?? 'ACTIVA'
                const showHeader =
                  (!prev || prev.sucursal_id !== aula.sucursal_id) && !!suc && !suc.es_predeterminada
                return (
                  <Fragment key={aula.id}>
                  {showHeader && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-2 first:mt-0">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground border-b pb-1">
                        {suc?.nombre}
                      </h3>
                    </div>
                  )}
                  <Card
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      !aula.activa ? 'opacity-60 border-dashed bg-muted/30' : ''
                    }`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return
                      handleVerEstudiantes()
                    }}
                  >
                    <div className={isMobile ? 'cursor-pointer' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <CardTitle className={`text-base leading-tight ${!aula.activa ? 'text-muted-foreground' : ''}`}>
                                {aula.nombre}
                                {aula.codigo_aula && (
                                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                                    {aula.codigo_aula}
                                  </span>
                                )}
                                {!aula.activa && (
                                  <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                                    (Inactiva)
                                  </span>
                                )}
                              </CardTitle>
                              {(aula.tutor?.displayName || aula.tutor?.nombre_completo) && (
                                <CardDescription className="mt-0.5">
                                  {aula.tutor?.displayName || aula.tutor?.nombre_completo}
                                </CardDescription>
                              )}
                            </div>
                            <span
                              className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                esInt
                                  ? ESTADO_INTERVENCION_CLASS[estadoInt]
                                  : aula.activa
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {esInt ? ESTADO_INTERVENCION_LABEL[estadoInt] : aula.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          {esInt && (
                            <p className="text-xs text-muted-foreground">
                              Temporada: {formatTemporada(aula)}
                            </p>
                          )}
                          {esInt && intervencionTemporadaVencida(aula) && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              Temporada finalizada — pendiente de cierre
                            </p>
                          )}
                          {aula.descripcion && (
                            <p className="text-sm text-muted-foreground">{aula.descripcion}</p>
                          )}
                          {canManageAulas &&
                            aula.tutor &&
                            aula.tutorAulaId && (
                              <div
                                onClick={(ev) => ev.stopPropagation()}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  id={`habilitar-${aula.id}`}
                                  checked={aula.tutorPuedeRegistrarAsistencia ?? false}
                                  onCheckedChange={(v) => handleToggleHabilitarRegistro(aula, v === true)}
                                  className="h-4 w-4"
                                />
                                <Label
                                  htmlFor={`habilitar-${aula.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer font-normal"
                                >
                                  Habilitar registro de asistencia
                                </Label>
                              </div>
                            )}
                          {aula.tutorPuedeRegistrarAsistencia && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                              <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                              Registro habilitado para el tutor
                            </p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {aula.fcp && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">FCP:</span> {aula.fcp.razon_social}
                            </p>
                          )}
                          {canManageAulas && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {(() => {
                                const siblings = aulasDeSucursalOrdenadas(aulas, aula.sucursal_id || '', aula.tipo ?? 'REGULAR')
                                if (siblings.length <= 1) return null
                                const idx = siblings.findIndex((a) => a.id === aula.id)
                                return (
                                  <div className="flex items-center gap-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="Subir dentro de la sucursal"
                                      disabled={idx === 0 || reordenandoId !== null}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleMoveOrden(aula, 'up')
                                      }}
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="Bajar dentro de la sucursal"
                                      disabled={idx >= siblings.length - 1 || reordenandoId !== null}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleMoveOrden(aula, 'down')
                                      }}
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )
                              })()}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleAssignTutor(aula) }}
                                className="text-xs h-8"
                              >
                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                {aula.tutor ? 'Cambiar tutor' : 'Asignar tutor'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingAula(aula)
                                  setIsEditDialogOpen(true)
                                }}
                                className="text-xs h-8"
                              >
                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs h-8 px-2"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  {!esInt && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setVaciarSalonAula(aula)
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Vaciar salón
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEliminarAula(aula)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    {esInt ? 'Eliminar intervención' : 'Eliminar aula'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                  </Fragment>
                )
              })}
            </div>
          )}
          {shouldShowPagination && (
            <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAulas.length)} de {filteredAulas.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) { setCurrentPage(currentPage - 1); window.scrollTo({ top: 0 }) } }} className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) =>
                    page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1) ? (
                      <PaginationItem key={page}>
                        <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page); window.scrollTo({ top: 0 }) }} isActive={currentPage === page} className="cursor-pointer min-w-[2.5rem]">
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ) : page === currentPage - 2 || page === currentPage + 2 ? (
                      <PaginationItem key={page}><PaginationEllipsis className="px-2" /></PaginationItem>
                    ) : null
                  )}
                  <PaginationItem>
                    <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) { setCurrentPage(currentPage + 1); window.scrollTo({ top: 0 }) } }} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {canManageAulas && sucursalesVacias.length > 0 && (
        <div className="mt-8 pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Sucursales sin aulas
          </h3>
          <div className="flex flex-wrap gap-2">
            {sucursalesVacias.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-sm"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {s.nombre}
                <button
                  type="button"
                  title="Eliminar sucursal"
                  onClick={() => setEliminarSucursal(s)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Solo puedes eliminar sucursales que no tengan aulas asociadas.
          </p>
        </div>
      )}

      <AulaDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleAulaCreated}
        fcpId={selectedFCP || ''}
        defaultTipo={vistaTipo}
      />

      {selectedAulaForTutor && (
        <AulaTutorDialog
          open={isTutorDialogOpen}
          onOpenChange={setIsTutorDialogOpen}
          onSuccess={handleTutorAssigned}
          aulaId={selectedAulaForTutor.id}
          aulaNombre={selectedAulaForTutor.nombre}
          fcpId={selectedFCP || ''}
          tutorActual={selectedAulaForTutor.tutor}
        />
      )}

      {editingAula && (
        <AulaEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setEditingAula(null)
          }}
          onSuccess={handleAulaUpdated}
          aulaId={editingAula.id}
          fcpId={editingAula.fcp_id}
          initialData={{
            nombre: editingAula.nombre,
            descripcion: editingAula.descripcion || '',
            activa: editingAula.activa,
            codigo_aula: editingAula.codigo_aula,
            sucursal_id: editingAula.sucursal_id,
            tipo: editingAula.tipo,
            fecha_inicio: editingAula.fecha_inicio,
            fecha_fin: editingAula.fecha_fin,
            estado_intervencion: editingAula.estado_intervencion,
          }}
        />
      )}

      <ConfirmDialog
        open={!!vaciarSalonAula}
        onOpenChange={(open) => {
          if (!open) setVaciarSalonAula(null)
        }}
        title="Vaciar salón"
        message={
          vaciarSalonAula
            ? `Se eliminarán de la base de datos todos los estudiantes del salón "${vaciarSalonAula.nombre}", junto con su historial de asistencias y períodos. Esta acción no se puede deshacer. ¿Continuar?`
            : ''
        }
        confirmLabel="Eliminar todos"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={vaciarLoading}
        onConfirm={async () => {
          if (!vaciarSalonAula) return
          setVaciarLoading(true)
          try {
            const res = await fetch('/api/aulas/vaciar-salon', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ aulaId: vaciarSalonAula.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              toast.error('Error al vaciar salón', data.error || res.statusText)
              return
            }
            toast.success('Salón vaciado', data.message || `Se eliminaron ${data.deleted ?? 0} estudiante(s).`)
            loadAulas()
            setVaciarSalonAula(null)
          } catch (e) {
            toast.error('Error', e instanceof Error ? e.message : 'No se pudo vaciar el salón.')
          } finally {
            setVaciarLoading(false)
          }
        }}
      />

      <ConfirmDialog
        open={!!eliminarAula}
        onOpenChange={(open) => {
          if (!open) setEliminarAula(null)
        }}
        title="Eliminar aula"
        message={
          eliminarAula
            ? `Se eliminará permanentemente el aula "${eliminarAula.nombre}". El aula debe estar vacía (sin estudiantes). Esta acción no se puede deshacer. ¿Continuar?`
            : ''
        }
        confirmLabel="Eliminar aula"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={eliminarLoading}
        onConfirm={async () => {
          if (!eliminarAula) return
          setEliminarLoading(true)
          try {
            const res = await fetch(`/api/aulas/${eliminarAula.id}`, {
              method: 'DELETE',
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              toast.error('Error al eliminar aula', data.error || res.statusText)
              return
            }
            toast.success('Aula eliminada', data.message || 'El aula se eliminó correctamente.')
            loadAulas()
            setEliminarAula(null)
          } catch (e) {
            toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar el aula.')
          } finally {
            setEliminarLoading(false)
          }
        }}
      />

      <ConfirmDialog
        open={!!eliminarSucursal}
        onOpenChange={(open) => {
          if (!open) setEliminarSucursal(null)
        }}
        title="Eliminar sucursal"
        message={
          eliminarSucursal
            ? `Se eliminará la sucursal "${eliminarSucursal.nombre}". Solo es posible si no tiene aulas asociadas. ¿Continuar?`
            : ''
        }
        confirmLabel="Eliminar sucursal"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={eliminarSucursalLoading}
        onConfirm={async () => {
          if (!eliminarSucursal) return
          setEliminarSucursalLoading(true)
          try {
            const res = await fetch(`/api/sucursales/${eliminarSucursal.id}`, {
              method: 'DELETE',
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              toast.error('Error al eliminar sucursal', data.error || res.statusText)
              return
            }
            toast.success('Sucursal eliminada', data.message || 'La sucursal se eliminó correctamente.')
            const fcpId = selectedFCP || fcpIdFromRole || ''
            setEliminarSucursal(null)
            loadAulas()
            if (fcpId) loadSucursales(fcpId)
          } catch (e) {
            toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar la sucursal.')
          } finally {
            setEliminarSucursalLoading(false)
          }
        }}
      />
    </div>
  )
}

