'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Edit, Search, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'
import { AsistenciaRegistroDialog } from './AsistenciaRegistroDialog'
import { AsistenciaEditDialog } from './AsistenciaEditDialog'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useUserRole } from '@/hooks/useUserRole'
import { getTodayInAppTimezone } from '@/lib/utils/dateUtils'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'

interface Asistencia {
  id: string
  fecha: string
  estado: 'presente' | 'falto' | 'permiso'
  observaciones?: string
  estudiante_id: string
  estudiante?: {
    codigo: string
    nombre_completo: string
    aula?: {
      nombre: string
    }
  }
  fcp_id: string
}

export function AsistenciaList() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [isRegistroDialogOpen, setIsRegistroDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedAsistencia, setSelectedAsistencia] = useState<Asistencia | null>(null)
  const [selectedFCP, setSelectedONG] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayInAppTimezone())
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string }>>([])
  const [loadingFCPs, setLoadingFCPs] = useState(true)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const router = useRouter()
  const { canEdit } = useUserRole(selectedFCP)

  useEffect(() => {
    loadUserFCPs()
  }, [])

  useEffect(() => {
    if (userFCPs.length > 0 && !selectedFCP) {
      setSelectedONG(userFCPs[0].id)
    }
  }, [userFCPs])

  useEffect(() => {
    if (selectedFCP) {
      loadAulas()
    }
  }, [selectedFCP])

  useEffect(() => {
    if (selectedFCP) {
      loadAsistencias()
    }
  }, [selectedFCP, selectedAula, selectedDate])

  const loadUserFCPs = async () => {
    setLoadingFCPs(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingFCPs(false)
        return
      }

      // Verificar si el usuario es facilitador en alguna FCP
      const { data: usuarioFcpData, error: usuarioFcpError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (usuarioFcpError) throw usuarioFcpError

      const isFacilitador = usuarioFcpData && usuarioFcpData.length > 0

      let fcps: Array<{ id: string; nombre: string }> = []

      if (isFacilitador) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPs, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        fcps = (todasLasFCPs || []).map(fcp => ({
          id: fcp.id,
          nombre: fcp.razon_social
        }))
      } else {
        // Usuarios no facilitadores solo ven sus FCPs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        fcps = data?.map((item: any) => ({
          id: item.fcp.id,
          nombre: item.fcp.razon_social,
        })) || []
      }

      setUserFCPs(fcps)
    } catch (error) {
      console.error('Error loading FCPs:', error)
    } finally {
      setLoadingFCPs(false)
    }
  }

  const loadAulas = async () => {
    if (!selectedFCP) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', selectedFCP)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (error) throw error
      setAulas(data || [])
    } catch (error) {
      console.error('Error loading aulas:', error)
    }
  }

  const loadAsistencias = async () => {
    if (!selectedFCP) return

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Si hay filtro por aula, primero obtener los IDs de estudiantes de esa aula
      let estudianteIds: string[] | null = null
      if (selectedAula) {
        const { data: estudiantesData, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select('id')
          .eq('fcp_id', selectedFCP)
          .eq('aula_id', selectedAula)
          .eq('activo', true)

        if (estudiantesError) throw estudiantesError
        estudianteIds = estudiantesData?.map(e => e.id) || []
      }

      // Construir la consulta de asistencias
      let query = supabase
        .from('asistencias')
        .select(`
          *,
          estudiante:estudiantes(
            codigo,
            nombre_completo,
            aula:aulas(nombre)
          )
        `)
        .eq('fcp_id', selectedFCP)
        .eq('fecha', selectedDate)

      // Si hay filtro por aula, filtrar por IDs de estudiantes
      if (selectedAula && estudianteIds && estudianteIds.length > 0) {
        query = query.in('estudiante_id', estudianteIds)
      } else if (selectedAula && (!estudianteIds || estudianteIds.length === 0)) {
        // Si no hay estudiantes en el aula, no hay asistencias
        setAsistencias([])
        setLoading(false)
        return
      }

      const { data, error } = await query.order('fecha', { ascending: false })

      if (error) throw error

      setAsistencias(data || [])
    } catch (error) {
      console.error('Error loading asistencias:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAsistenciaCreated = () => {
    loadAsistencias()
    setIsRegistroDialogOpen(false)
  }

  const handleAsistenciaUpdated = () => {
    loadAsistencias()
    setIsEditDialogOpen(false)
    setSelectedAsistencia(null)
  }

  const handleEditAsistencia = (asistencia: Asistencia) => {
    setSelectedAsistencia(asistencia)
    setIsEditDialogOpen(true)
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'presente':
        return <Badge className="bg-green-500">Presente</Badge>
      case 'falto':
        return <Badge className="bg-red-500">Faltó</Badge>
      case 'permiso':
        return <Badge className="bg-yellow-500">Permiso</Badge>
      default:
        return <Badge>{estado}</Badge>
    }
  }

  const filteredAsistencias = asistencias.filter((a) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      a.estudiante?.nombre_completo.toLowerCase().includes(term) ||
      a.estudiante?.codigo.toLowerCase().includes(term)
    )
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const itemsPerPage = isMobile ? 8 : 50
  const totalPages = Math.max(1, Math.ceil(filteredAsistencias.length / itemsPerPage))
  const displayAsistencias = filteredAsistencias.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const shouldShowPagination = filteredAsistencias.length > itemsPerPage

  useEffect(() => setCurrentPage(1), [searchTerm])

  if (loadingFCPs) {
    return <div className="text-center py-8">Cargando asistencia...</div>
  }

  if (userFCPs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
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

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">FCP:</label>
          <Select
            value={selectedFCP || ''}
            onValueChange={(value) => {
              setSelectedONG(value)
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
                  </div>
                </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Aula:</label>
          <Select
            value={selectedAula || '__all__'}
            onValueChange={(value) => setSelectedAula(value === '__all__' ? null : value)}
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

        <div>
          <label className="text-sm font-medium mb-2 block">Fecha:</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full"
          />
        </div>

        <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
          <div className="flex items-end">
            <Button
              onClick={() => setIsRegistroDialogOpen(true)}
              disabled={!selectedFCP || !selectedAula}
              className="w-full"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Registrar Asistencias
            </Button>
          </div>
        </RoleGuard>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Buscar por nombre o código de estudiante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando asistencias...</div>
      ) : filteredAsistencias.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {asistencias.length === 0
                ? 'No hay asistencias registradas para esta fecha'
                : 'No se encontraron asistencias que coincidan con la búsqueda'}
            </p>
            <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
              {asistencias.length === 0 && (
                <Button
                  onClick={() => setIsRegistroDialogOpen(true)}
                  disabled={!selectedFCP || !selectedAula}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Registrar Asistencias
                </Button>
              )}
            </RoleGuard>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {isMobile ? (
              <div className="space-y-3">
                {displayAsistencias.map((asistencia) => {
                  const isExpanded = expandedCardId === asistencia.id
                  return (
                    <Card key={asistencia.id} className="overflow-hidden">
                      <div className="p-4 cursor-pointer active:bg-muted/50" onClick={() => setExpandedCardId(isExpanded ? null : asistencia.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm text-muted-foreground">{asistencia.estudiante?.codigo}</p>
                            <p className="font-medium truncate">{asistencia.estudiante?.nombre_completo}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {getEstadoBadge(asistencia.estado)}
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Aula:</span> {asistencia.estudiante?.aula?.nombre || '-'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Observaciones:</span> {asistencia.observaciones || '-'}
                            </p>
                            <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']} fallback={null}>
                              <Button variant="outline" size="sm" onClick={() => handleEditAsistencia(asistencia)}>
                                <Edit className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                            </RoleGuard>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground md:hidden">Desliza para ver más columnas →</p>
                <div className="table-responsive">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Aula</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Observaciones</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayAsistencias.map((asistencia) => (
                        <TableRow key={asistencia.id}>
                          <TableCell className="font-mono">{asistencia.estudiante?.codigo}</TableCell>
                          <TableCell>{asistencia.estudiante?.nombre_completo}</TableCell>
                          <TableCell>{asistencia.estudiante?.aula?.nombre}</TableCell>
                          <TableCell>{getEstadoBadge(asistencia.estado)}</TableCell>
                          <TableCell className="max-w-xs truncate">{asistencia.observaciones || '-'}</TableCell>
                          <TableCell>
                            <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']} fallback={<span className="text-sm text-muted-foreground">Solo lectura</span>}>
                              <Button variant="ghost" size="sm" onClick={() => handleEditAsistencia(asistencia)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </RoleGuard>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {shouldShowPagination && (
              <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAsistencias.length)} de {filteredAsistencias.length}
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
          </CardContent>
        </Card>
      )}

      {selectedFCP && selectedAula && (
        <AsistenciaRegistroDialog
          open={isRegistroDialogOpen}
          onOpenChange={setIsRegistroDialogOpen}
          onSuccess={handleAsistenciaCreated}
          fcpId={selectedFCP}
          aulaId={selectedAula}
          fecha={selectedDate}
        />
      )}

      {selectedAsistencia && (
        <AsistenciaEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setSelectedAsistencia(null)
          }}
          onSuccess={handleAsistenciaUpdated}
          asistencia={selectedAsistencia}
        />
      )}
    </div>
  )
}

