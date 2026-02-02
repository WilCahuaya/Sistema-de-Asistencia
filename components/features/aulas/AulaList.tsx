'use client'

import { useEffect, useState } from 'react'
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
import { Plus, GraduationCap, Users, Edit, Building2, Eye, EyeOff, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { AulaDialog } from './AulaDialog'
import { AulaTutorDialog } from './AulaTutorDialog'
import { AulaEditDialog } from './AulaEditDialog'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'

interface TutorInfo {
  id: string
  email: string
  nombre_completo?: string
}

interface Aula {
  id: string
  nombre: string
  descripcion?: string
  activa: boolean
  fcp_id: string
  fcp?: {
    razon_social: string
  }
  tutor?: TutorInfo
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
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [showInactive, setShowInactive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const router = useRouter()
  const { selectedRole } = useSelectedRole()
  
  // Usar el rol seleccionado para determinar los flags
  const isDirector = selectedRole?.role === 'director'
  const isSecretario = selectedRole?.role === 'secretario'
  const isTutorState = selectedRole?.role === 'tutor'
  const isFacilitador = selectedRole?.role === 'facilitador'
  
  // Usar el fcpId del rol seleccionado si está disponible
  const fcpIdFromRole = selectedRole?.fcpId
  
  const { isTutor, isFacilitador: isFacilitadorFromHook } = useUserRole(selectedFCP || fcpIdFromRole)

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

  const filteredAulas = searchTerm.trim()
    ? aulas.filter((a) => {
        const term = searchTerm.toLowerCase()
        const nombre = a.nombre?.toLowerCase() || ''
        const desc = a.descripcion?.toLowerCase() || ''
        const tutor = a.tutor?.nombre_completo?.toLowerCase() || a.tutor?.email?.toLowerCase() || ''
        return nombre.includes(term) || desc.includes(term) || tutor.includes(term)
      })
    : aulas

  const itemsPerPage = isMobile ? 8 : 24
  const totalPages = Math.max(1, Math.ceil(filteredAulas.length / itemsPerPage))
  const displayAulas = filteredAulas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const shouldShowPagination = filteredAulas.length > itemsPerPage

  useEffect(() => setCurrentPage(1), [searchTerm])

  const loadUserFCPs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
      
      console.log('📚 [AulaList] FCPs cargadas:', {
        fcps: fcps.length,
        fcpIdFromRole,
        selectedFCP,
        rolSeleccionado: selectedRole?.role
      })
    } catch (error) {
      console.error('Error loading FCPs:', error)
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
              aula:aulas(*)
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
            .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
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
        
        // Construir la consulta base
        let aulasQuery = supabase
          .from('aulas')
          .select('*')
          .eq('fcp_id', fcpIdToUse)
          .order('nombre', { ascending: true })
        
        // Si no se muestran inactivos, filtrar solo las activas
        if (!showInactive) {
          aulasQuery = aulasQuery.eq('activa', true)
        }
        
        const { data: aulasData, error: aulasError } = await aulasQuery

        data = aulasData || []
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
        const fcpIdForTutores = fcpIdFromRole || selectedFCP
        
        if (!fcpIdForTutores) {
          console.warn('⚠️ [AulaList] No hay fcpId para cargar tutores')
        } else {
          const { data: tutoresData, error: tutoresError } = await supabase
            .from('tutor_aula')
            .select(`
              aula_id,
              fcp_miembro:fcp_miembros!inner(
                usuario:usuarios!inner(id, email, nombre_completo)
              )
            `)
            .in('aula_id', aulaIds)
            .eq('activo', true)
            .eq('fcp_id', fcpIdForTutores)
        
          if (tutoresError) {
            console.error('Error cargando tutores:', tutoresError)
          } else {
            // Crear un mapa de aula_id -> tutor para acceso rápido
            const tutoresMap = new Map<string, TutorInfo>()
            if (tutoresData) {
              tutoresData.forEach((tutorData: any) => {
                if (tutorData.fcp_miembro?.usuario && !tutoresMap.has(tutorData.aula_id)) {
                  const usuario = tutorData.fcp_miembro.usuario
                  tutoresMap.set(tutorData.aula_id, {
                    id: usuario.id,
                    email: usuario.email,
                    nombre_completo: usuario.nombre_completo
                  })
                }
              })
            }
            
            // Agregar información de tutor a cada aula
            aulasWithTutors = aulasBase.map(aula => ({
              ...aula,
              tutor: tutoresMap.get(aula.id)
            }))
          }
        }
      }
      
      setAulas(aulasWithTutors)
    } catch (error: any) {
      console.error('Error loading aulas:', error)
      setError(`Error inesperado: ${error.message || 'Error desconocido'}`)
      setAulas([])
    } finally {
      setLoading(false)
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
        
        <div className="flex items-center gap-4">
          {/* Toggle para mostrar aulas inactivas - solo para directores y secretarios */}
          <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
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
          </RoleGuard>
          
          <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
            <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedFCP}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Aula
            </Button>
          </RoleGuard>
        </div>
      </div>

      {aulas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              {isTutor
                ? 'No tienes aulas asignadas. Contacta a un facilitador para que te asigne las aulas que debes gestionar.'
                : 'No hay aulas registradas para esta FCP.'}
            </p>
            <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
              <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedFCP}>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera aula
              </Button>
            </RoleGuard>
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
              {displayAulas.map((aula) => {
                const isExpanded = isMobile ? expandedCardId === aula.id : true
                return (
                  <Card
                    key={aula.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      !aula.activa ? 'opacity-60 border-dashed bg-muted/30' : ''
                    }`}
                  >
                    <div
                      className={isMobile ? 'cursor-pointer' : ''}
                      onClick={() => isMobile && setExpandedCardId(isExpanded ? null : aula.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className={`flex-1 ${!aula.activa ? 'text-muted-foreground' : ''}`}>
                            {aula.nombre}
                            {!aula.activa && (
                              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                                (Inactiva)
                              </span>
                            )}
                          </CardTitle>
                          {isMobile && (isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />)}
                        </div>
                        {!isMobile && aula.descripcion && <CardDescription>{aula.descripcion}</CardDescription>}
                      </CardHeader>
                      {(isExpanded || !isMobile) && (
                        <CardContent onClick={(e) => isMobile && e.stopPropagation()}>
                          <div className="space-y-2 text-sm">
                            {aula.descripcion && isMobile && <CardDescription className="mb-2">{aula.descripcion}</CardDescription>}
                            {aula.fcp && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">FCP:</span> {aula.fcp.razon_social}
                              </p>
                            )}
                            <div className="space-y-1">
                              <p className="text-muted-foreground">
                                <span className="font-medium">Tutor encargado:</span>{' '}
                                {aula.tutor ? (
                                  <span>{aula.tutor.nombre_completo || aula.tutor.email}</span>
                                ) : (
                                  <span className="text-orange-600 dark:text-orange-400 italic">
                                    Falta agregar tutor
                                  </span>
                                )}
                              </p>
                              <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAssignTutor(aula)}
                                  className="text-xs"
                                >
                                  <Edit className="mr-1 h-3 w-3" />
                                  {aula.tutor ? 'Cambiar tutor' : 'Asignar tutor'}
                                </Button>
                              </RoleGuard>
                            </div>
                            <div className="pt-2 flex items-center justify-between">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  aula.activa
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                }`}
                              >
                                {aula.activa ? 'Activa' : 'Inactiva'}
                              </span>
                              <RoleGuard fcpId={aula.fcp_id || selectedFCP} allowedRoles={['director', 'secretario']}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingAula(aula)
                                    setIsEditDialogOpen(true)
                                  }}
                                  className="text-xs"
                                >
                                  <Edit className="mr-1 h-3 w-3" />
                                  Editar
                                </Button>
                              </RoleGuard>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </div>
                  </Card>
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

      <AulaDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleAulaCreated}
        fcpId={selectedFCP || ''}
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
          initialData={{
            nombre: editingAula.nombre,
            descripcion: editingAula.descripcion || '',
            activa: editingAula.activa,
          }}
        />
      )}
    </div>
  )
}

