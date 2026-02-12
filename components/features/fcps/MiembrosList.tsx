'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Users, Edit, Search, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MiembroAddDialog } from './MiembroAddDialog'
import { MiembroEditDialog } from './MiembroEditDialog'
import { useUserRole } from '@/hooks/useUserRole'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { getRolDisplayName, getRolBadgeColor } from '@/lib/utils/roles'

interface MiembroRol {
  id: string
  rol: 'facilitador' | 'director' | 'secretario' | 'tutor'
  activo: boolean
}

interface Miembro {
  id: string
  usuario_id: string | null
  email_pendiente?: string | null
  nombre_display?: string | null
  fcp_id: string
  rol: 'facilitador' | 'director' | 'secretario' | 'tutor'
  activo: boolean
  fecha_asignacion: string
  roles?: MiembroRol[]
  usuario?: {
    email: string
    nombre_completo?: string
  }
  fcp?: {
    id: string
    razon_social: string
  }
  aulas?: Array<{
    id: string
    nombre: string
  }>
}

interface MiembrosListProps {
  fcpId: string
}

export function MiembrosList({ fcpId }: MiembrosListProps) {
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedMiembro, setSelectedMiembro] = useState<Miembro | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [fcpNombre, setFcpNombre] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const { isFacilitador, isDirector, isSecretario } = useUserRole(fcpId)
  const canView = isFacilitador || isDirector || isSecretario
  const canManage = isDirector || isSecretario // Facilitadores solo pueden ver

  useEffect(() => {
    if (fcpId) {
      loadMiembros()
      loadFCPNombre()
    }
  }, [fcpId])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const filteredMiembros = searchTerm.trim()
    ? miembros.filter((m) => {
        const email = m.usuario?.email || m.email_pendiente || ''
        const nombre = m.nombre_display || m.usuario?.nombre_completo || ''
        const term = searchTerm.toLowerCase()
        return email.toLowerCase().includes(term) || nombre.toLowerCase().includes(term)
      })
    : miembros

  const itemsPerPage = isMobile ? 8 : 15
  const totalPages = Math.max(1, Math.ceil(filteredMiembros.length / itemsPerPage))
  const displayMiembros = filteredMiembros.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const shouldShowPagination = filteredMiembros.length > itemsPerPage

  useEffect(() => setCurrentPage(1), [searchTerm])

  const loadFCPNombre = async () => {
    if (!fcpId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('fcps')
        .select('razon_social')
        .eq('id', fcpId)
        .single()

      if (error) throw error
      if (data) {
        setFcpNombre(data.razon_social)
      }
    } catch (error) {
      console.error('Error loading FCP nombre:', error)
    }
  }

  const loadMiembros = async () => {
    if (!fcpId) return

    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          usuario_id,
          email_pendiente,
          nombre_display,
          fcp_id,
          rol,
          activo,
          fecha_asignacion,
          usuario:usuarios(
            email,
            nombre_completo
          ),
          fcp:fcps(
            id,
            razon_social
          )
        `)
        .eq('fcp_id', fcpId)
        .neq('rol', 'facilitador') // Excluir facilitadores de la lista
        .order('fecha_asignacion', { ascending: false })

      if (error) throw error

      console.log('Miembros cargados:', data)
      
      // Procesar miembros y cargar datos de usuario cuando la relación no funcione
      const miembrosProcesados = await Promise.all((data || []).map(async (miembro: any) => {
        // Si no hay relación con usuarios cargada pero hay usuario_id,
        // intentar cargar los datos directamente
        let usuarioData = miembro.usuario
        
        if (miembro.usuario_id && !usuarioData) {
          console.log('Relación no cargada, consultando usuarios directamente para:', miembro.usuario_id)
          try {
            // Intentar cargar directamente desde usuarios
            const { data: usuarioDirecto, error: usuarioError } = await supabase
              .from('usuarios')
              .select('email, nombre_completo')
              .eq('id', miembro.usuario_id)
              .maybeSingle()
            
            if (usuarioError) {
              console.error('Error cargando usuario directamente:', usuarioError)
              // Si hay error de RLS o permisos, intentar sin filtro de id específico
              // (aunque esto no debería ser necesario si RLS está bien configurado)
            }
            
            if (usuarioDirecto) {
              usuarioData = usuarioDirecto
              console.log('✅ Usuario cargado directamente:', usuarioData)
            } else {
              console.warn('⚠️ Usuario no encontrado en tabla usuarios (puede ser problema de RLS):', miembro.usuario_id)
            }
          } catch (err) {
            console.error('Error en consulta de usuario:', err)
          }
        }
        
        // Obtener email y nombre de los datos disponibles
        // Priorizar nombre_display cuando existe (útil para miembros agregados con email de conocido)
        const email = usuarioData?.email || miembro.email_pendiente || 
                     (miembro.usuario_id ? `Usuario ${miembro.usuario_id.substring(0, 8)}...` : 'Sin email')
        const nombreCompleto = miembro.nombre_display || usuarioData?.nombre_completo || 
                              (miembro.usuario_id && !usuarioData ? 'Usuario no sincronizado' : 'Sin nombre')
        
        // Cargar las aulas asignadas si el miembro tiene rol de tutor
        // O si el usuario tiene otro registro como tutor en esta FCP
        let aulasAsignadas: Array<{ id: string; nombre: string }> = []
        
        // Primero intentar cargar aulas del registro actual si es tutor
        if (miembro.rol === 'tutor' && miembro.activo) {
          try {
            const { data: tutorAulas, error: tutorAulasError } = await supabase
              .from('tutor_aula')
              .select(`
                aula_id,
                aula:aulas!inner(
                  id,
                  nombre
                )
              `)
              .eq('fcp_miembro_id', miembro.id)
              .eq('activo', true)
              .eq('fcp_id', fcpId)
            
            if (tutorAulasError) {
              console.error('Error cargando aulas del tutor:', tutorAulasError)
            } else if (tutorAulas) {
              aulasAsignadas = tutorAulas
                .map((ta: any) => ta.aula)
                .filter((aula: any) => aula !== null && aula !== undefined)
            }
          } catch (err) {
            console.error('Error en consulta de aulas del tutor:', err)
          }
        }
        
        // Si no se encontraron aulas y el usuario tiene usuario_id, buscar si tiene otro registro como tutor
        if (aulasAsignadas.length === 0 && miembro.usuario_id && miembro.activo) {
          try {
            // Buscar TODOS los registros de tutor del usuario en esta FCP
            const { data: tutorRecords, error: tutorRecordError } = await supabase
              .from('fcp_miembros')
              .select('id')
              .eq('usuario_id', miembro.usuario_id)
              .eq('fcp_id', fcpId)
              .eq('rol', 'tutor')
              .eq('activo', true)
            
            if (!tutorRecordError && tutorRecords && tutorRecords.length > 0) {
              // Cargar aulas de todos los registros de tutor del usuario
              const tutorIds = tutorRecords.map((tr: any) => tr.id)
              
              const { data: tutorAulas, error: tutorAulasError } = await supabase
                .from('tutor_aula')
                .select(`
                  aula_id,
                  aula:aulas!inner(
                    id,
                    nombre
                  )
                `)
                .in('fcp_miembro_id', tutorIds)
                .eq('activo', true)
                .eq('fcp_id', fcpId)
              
              if (!tutorAulasError && tutorAulas) {
                aulasAsignadas = tutorAulas
                  .map((ta: any) => ta.aula)
                  .filter((aula: any) => aula !== null && aula !== undefined)
                
                // Eliminar duplicados por ID de aula
                const aulasUnicas = new Map<string, { id: string; nombre: string }>()
                aulasAsignadas.forEach((aula: { id: string; nombre: string }) => {
                  if (!aulasUnicas.has(aula.id)) {
                    aulasUnicas.set(aula.id, aula)
                  }
                })
                aulasAsignadas = Array.from(aulasUnicas.values())
                
                console.log('✅ Aulas cargadas desde registro de tutor del usuario:', {
                  usuario_id: miembro.usuario_id,
                  registro_actual_rol: miembro.rol,
                  registros_tutor: tutorRecords.length,
                  aulas_encontradas: aulasAsignadas.length
                })
              }
            }
          } catch (err) {
            console.error('Error verificando aulas del tutor desde otro registro:', err)
          }
        }
        
        console.log('Procesando miembro:', {
          id: miembro.id,
          usuario_id: miembro.usuario_id,
          email_pendiente: miembro.email_pendiente,
          usuario_relacion: miembro.usuario,
          usuario_cargado_directo: usuarioData,
          email_final: email,
          nombre_final: nombreCompleto,
          aulas_asignadas: aulasAsignadas.length
        })
        
        return {
          ...miembro,
          // Asegurar que usuario tenga los datos correctos
          // Usar usuarioData si está disponible, o crear objeto con email y nombre procesados
          usuario: usuarioData || (miembro.usuario_id || miembro.email_pendiente) ? {
            email: email,
            nombre_completo: nombreCompleto !== 'Sin nombre' && nombreCompleto !== 'Usuario no sincronizado' 
              ? nombreCompleto 
              : undefined
          } : undefined,
          aulas: aulasAsignadas.length > 0 ? aulasAsignadas : undefined
        }
      }))
      
      // Agrupar miembros por usuario_id o email_pendiente
      const miembrosAgrupados = miembrosProcesados.reduce((acc: any[], miembro: any) => {
        const key = miembro.usuario_id || miembro.email_pendiente
        if (!key) return acc // Skip si no tiene identificador
        
        const existingIndex = acc.findIndex(m => 
          (m.usuario_id && m.usuario_id === miembro.usuario_id) ||
          (m.email_pendiente && m.email_pendiente === miembro.email_pendiente)
        )
        
        if (existingIndex >= 0) {
          // Usuario ya existe, agregar rol a la lista
          const existing = acc[existingIndex]
          if (!existing.roles) {
            existing.roles = [{
              id: existing.id,
              rol: existing.rol,
              activo: existing.activo,
              fecha_asignacion: existing.fecha_asignacion
            }]
          }
          existing.roles.push({
            id: miembro.id,
            rol: miembro.rol,
            activo: miembro.activo,
            fecha_asignacion: miembro.fecha_asignacion
          })
          // Combinar aulas si hay
          if (miembro.aulas && miembro.aulas.length > 0) {
            existing.aulas = [...(existing.aulas || []), ...miembro.aulas]
            // Eliminar duplicados por id
            existing.aulas = Array.from(new Map(existing.aulas.map((a: any) => [a.id, a])).values())
          }
          // Usar la fecha más reciente
          if (new Date(miembro.fecha_asignacion) > new Date(existing.fecha_asignacion)) {
            existing.fecha_asignacion = miembro.fecha_asignacion
          }
        } else {
          // Nuevo usuario, agregar a la lista
          acc.push({
            ...miembro,
            roles: [{
              id: miembro.id,
              rol: miembro.rol,
              activo: miembro.activo,
              fecha_asignacion: miembro.fecha_asignacion
            }]
          })
        }
        
        return acc
      }, [])
      
      setMiembros(miembrosAgrupados)
    } catch (error) {
      console.error('Error loading miembros:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMiembroAdded = () => {
    loadMiembros()
    setIsAddDialogOpen(false)
  }

  const handleMiembroUpdated = () => {
    loadMiembros()
    setIsEditDialogOpen(false)
    setSelectedMiembro(null)
  }

  const handleEditMiembro = (miembro: Miembro) => {
    setSelectedMiembro(miembro)
    setIsEditDialogOpen(true)
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Solo los facilitadores, directores y secretarios pueden ver miembros de la FCP.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="text-center py-8">Cargando miembros...</div>
  }

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Miembros de la FCP
              </CardTitle>
              {fcpNombre && (
                <p className="text-sm text-muted-foreground mt-1">
                  FCP: <span className="font-medium">{fcpNombre}</span>
                </p>
              )}
            </div>
            <RoleGuard fcpId={fcpId} allowedRoles={['director', 'secretario']}>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Miembro
              </Button>
            </RoleGuard>
          </div>
        </CardHeader>
        <CardContent>
          {miembros.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No hay miembros registrados en esta FCP
              </p>
              <RoleGuard fcpId={fcpId} allowedRoles={['director', 'secretario']}>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Primer Miembro
                </Button>
              </RoleGuard>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {isMobile ? (
                <div className="space-y-3">
                  {displayMiembros.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm">
                      {searchTerm ? 'No se encontraron miembros' : 'No hay miembros'}
                    </p>
                  ) : (
                    displayMiembros.map((miembro) => {
                      const email = miembro.usuario?.email || miembro.email_pendiente || 'Sin email'
                      const nombre = miembro.nombre_display || miembro.usuario?.nombre_completo || 'Sin nombre'
                      const rolesActivos = miembro.roles?.filter((r: any) => r.activo) || []
                      const tieneRolesActivos = rolesActivos.length > 0
                      const miembroParaEditar = miembro.roles && miembro.roles.length > 0 ? { ...miembro, id: miembro.roles[0].id, rol: miembro.roles[0].rol, activo: miembro.roles[0].activo } : miembro
                      const cardKey = miembro.usuario_id || miembro.email_pendiente || miembro.id
                      const isExpanded = expandedCardId === cardKey
                      return (
                        <Card key={cardKey} className="overflow-hidden">
                          <div className="p-4 cursor-pointer active:bg-muted/50" onClick={() => setExpandedCardId(isExpanded ? null : cardKey)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{nombre}</p>
                                <p className="text-sm text-muted-foreground truncate font-mono">{email}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Badge className={tieneRolesActivos ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}>
                                  {tieneRolesActivos ? 'Activo' : 'Inactivo'}
                                </Badge>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </div>
                            {rolesActivos.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {rolesActivos.map((r: any) => (
                                  <Badge key={r.id} className={getRolBadgeColor(r.rol)} variant="secondary">
                                    {getRolDisplayName(r.rol)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
                                <p className="text-sm text-muted-foreground">FCP: {miembro.fcp?.razon_social || 'Sin FCP'}</p>
                                <p className="text-sm text-muted-foreground">Asignado: {new Date(miembro.fecha_asignacion).toLocaleDateString('es-ES')}</p>
                                {miembro.aulas && miembro.aulas.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {miembro.aulas.map((a) => <Badge key={a.id} variant="outline" className="text-xs">{a.nombre}</Badge>)}
                                  </div>
                                )}
                                {isSecretario ? rolesActivos.some((r: any) => r.rol === 'tutor') && (
                                  <Button variant="outline" size="sm" onClick={() => handleEditMiembro(miembroParaEditar)}><Edit className="h-4 w-4 mr-1" />Editar</Button>
                                ) : (
                                  <RoleGuard fcpId={fcpId} allowedRoles={['director', 'secretario']}>
                                    <Button variant="outline" size="sm" onClick={() => handleEditMiembro(miembroParaEditar)}><Edit className="h-4 w-4 mr-1" />Editar</Button>
                                  </RoleGuard>
                                )}
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
                  <div className="table-responsive">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>FCP</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha de Asignación</TableHead>
                          <TableHead>Aulas (Tutor)</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayMiembros.map((miembro) => {
                          const email = miembro.usuario?.email || miembro.email_pendiente || 'Sin email'
                          const nombre = miembro.nombre_display || miembro.usuario?.nombre_completo || 'Sin nombre'
                          const rolesActivos = miembro.roles?.filter((r: any) => r.activo) || []
                          const tieneRolesActivos = rolesActivos.length > 0
                          const miembroParaEditar = miembro.roles && miembro.roles.length > 0 ? { ...miembro, id: miembro.roles[0].id, rol: miembro.roles[0].rol, activo: miembro.roles[0].activo } : miembro
                          return (
                            <TableRow key={miembro.usuario_id || miembro.email_pendiente || miembro.id}>
                              <TableCell>{nombre}</TableCell>
                              <TableCell className="font-mono text-sm">{email}</TableCell>
                              <TableCell><Badge variant="outline" className="font-normal">{miembro.fcp?.razon_social || 'Sin FCP'}</Badge></TableCell>
                              <TableCell>
                                {rolesActivos.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {rolesActivos.map((r: any) => <Badge key={r.id} className={getRolBadgeColor(r.rol)}>{getRolDisplayName(r.rol)}</Badge>)}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell>
                                <Badge className={tieneRolesActivos ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}>
                                  {tieneRolesActivos ? 'Activo' : 'Inactivo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{new Date(miembro.fecha_asignacion).toLocaleDateString('es-ES')}</TableCell>
                              <TableCell>
                                {miembro.aulas && miembro.aulas.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {miembro.aulas.map((a) => <Badge key={a.id} variant="secondary" className="text-xs">{a.nombre}</Badge>)}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell>
                                {isSecretario ? rolesActivos.some((r: any) => r.rol === 'tutor') && <Button variant="ghost" size="sm" onClick={() => handleEditMiembro(miembroParaEditar)}><Edit className="h-4 w-4" /></Button> : (
                                  <RoleGuard fcpId={fcpId} allowedRoles={['director', 'secretario']}>
                                    <Button variant="ghost" size="sm" onClick={() => handleEditMiembro(miembroParaEditar)}><Edit className="h-4 w-4" /></Button>
                                  </RoleGuard>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {shouldShowPagination && (
                <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredMiembros.length)} de {filteredMiembros.length}
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
        </CardContent>
      </Card>

      <MiembroAddDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleMiembroAdded}
        fcpId={fcpId}
      />

      {selectedMiembro && (
        <MiembroEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setSelectedMiembro(null)
          }}
          onSuccess={handleMiembroUpdated}
          miembro={selectedMiembro}
        />
      )}
    </div>
  )
}

