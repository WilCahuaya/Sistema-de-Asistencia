'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, GraduationCap, Upload, Search, ArrowRight } from 'lucide-react'
import { EstudianteDialog } from './EstudianteDialog'
import { useRouter } from 'next/navigation'
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
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  activo: boolean
  aula_id: string
  aula?: {
    nombre: string
  }
  fcp_id: string
  fcp?: {
    razon_social: string
  }
}

export function EstudianteList() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false)
  const [selectedEstudianteForMovimiento, setSelectedEstudianteForMovimiento] = useState<Estudiante | null>(null)
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }>>([])
  const [isDirector, setIsDirector] = useState(false)
  const [isSecretario, setIsSecretario] = useState(false)
  const [isTutorState, setIsTutorState] = useState(false)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEstudiantes, setTotalEstudiantes] = useState(0)
  const itemsPerPage = 15
  const router = useRouter()
  const { canEdit } = useUserRole(selectedFCP)

  useEffect(() => {
    loadUserFCPs()
  }, [])

  useEffect(() => {
    if (userFCPs.length > 0 && !selectedFCP) {
      setSelectedFCP(userFCPs[0].id)
    }
  }, [userFCPs])

  // Asegurar que selectedFCP esté establecido para secretarios y directores
  useEffect(() => {
    if ((isSecretario || isDirector) && userFCPs.length > 0 && !selectedFCP) {
      setSelectedFCP(userFCPs[0].id)
    }
  }, [isSecretario, isDirector, userFCPs, selectedFCP])

  useEffect(() => {
    // Si es tutor, cargar aulas inmediatamente cuando se detecta
    if (isTutorState) {
      loadAulas()
    } else if (selectedFCP) {
      loadAulas()
    } else {
      setAulas([])
    }
  }, [selectedFCP, isTutorState])

  // Cargar aulas cuando se detecta que es tutor
  useEffect(() => {
    if (isTutorState) {
      loadAulas()
    }
  }, [isTutorState])

  useEffect(() => {
    if (selectedFCP || isTutorState) {
      setCurrentPage(1) // Resetear a la primera página cuando cambian los filtros
      loadEstudiantes()
    } else {
      setEstudiantes([])
      setTotalEstudiantes(0)
    }
  }, [selectedFCP, selectedAula, isTutorState])

  useEffect(() => {
    if (selectedFCP || isTutorState) {
      loadEstudiantes()
    }
  }, [currentPage])

  const loadUserFCPs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el usuario es facilitador
      const { data: facilitadorData, error: facilitadorError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (facilitadorError) throw facilitadorError

      const esFacilitador = facilitadorData && facilitadorData.length > 0

      // Verificar si el usuario es director
      const { data: directorData, error: directorError } = await supabase
        .from('fcp_miembros')
        .select('rol, fcp_id')
        .eq('usuario_id', user.id)
        .eq('rol', 'director')
        .eq('activo', true)
        .limit(1)

      if (!directorError && directorData && directorData.length > 0) {
        setIsDirector(true)
        // Si es director y no hay FCP seleccionada, establecer la primera FCP del director
        if (!selectedFCP && directorData[0].fcp_id) {
          setSelectedFCP(directorData[0].fcp_id)
        }
      }

      // Verificar si el usuario es secretario
      const { data: secretarioData, error: secretarioError } = await supabase
        .from('fcp_miembros')
        .select('rol, fcp_id')
        .eq('usuario_id', user.id)
        .eq('rol', 'secretario')
        .eq('activo', true)
        .limit(1)

      if (!secretarioError && secretarioData && secretarioData.length > 0) {
        setIsSecretario(true)
        // Si es secretario y no hay FCP seleccionada, establecer la primera FCP del secretario
        if (!selectedFCP && secretarioData[0].fcp_id) {
          setSelectedFCP(secretarioData[0].fcp_id)
        }
      }

      // Verificar si el usuario es tutor
      const { data: tutorData, error: tutorError } = await supabase
        .from('fcp_miembros')
        .select(`
          rol,
          fcp_id,
          fcp:fcps(id, razon_social, numero_identificacion)
        `)
        .eq('usuario_id', user.id)
        .eq('rol', 'tutor')
        .eq('activo', true)
        .limit(1)

      if (!tutorError && tutorData && tutorData.length > 0) {
        setIsTutorState(true)
        // Si es tutor, establecer la FCP automáticamente
        if (tutorData[0].fcp_id && tutorData[0].fcp && !selectedFCP) {
          setSelectedFCP(tutorData[0].fcp.id)
        }
      }

      let fcps: Array<{ id: string; nombre: string; numero_identificacion?: string; razon_social?: string }> = []

      if (esFacilitador) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPs, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        fcps = (todasLasFCPs || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP',
          numero_identificacion: fcp.numero_identificacion,
          razon_social: fcp.razon_social,
        }))
      } else {
        // Usuarios no facilitadores solo ven sus FCPs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social, numero_identificacion)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        fcps = data?.map((item: any) => ({
          id: item.fcp?.id,
          nombre: item.fcp?.razon_social || 'FCP',
          numero_identificacion: item.fcp?.numero_identificacion,
          razon_social: item.fcp?.razon_social,
        })).filter((fcp: any) => fcp.id) || []
      }

      // Si es tutor, agregar su FCP a la lista si no está ya
      if (tutorData && tutorData.length > 0 && tutorData[0].fcp) {
        const tutorFcp = tutorData[0].fcp
        if (!fcps.find(fcp => fcp.id === tutorFcp.id)) {
          fcps.push({
            id: tutorFcp.id,
            nombre: tutorFcp.razon_social || 'FCP',
            numero_identificacion: tutorFcp.numero_identificacion,
            razon_social: tutorFcp.razon_social,
          })
        }
      }

      setUserFCPs(fcps)
    } catch (error) {
      console.error('Error loading FCPs:', error)
    }
  }

  const loadAulas = async () => {
    if (!selectedFCP && !isTutorState) return

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
        const { data: aulasData, error: aulasError } = await supabase
          .from('aulas')
          .select('id, nombre')
          .eq('fcp_id', selectedFCP)
          .eq('activa', true)
          .order('nombre', { ascending: true })

        data = aulasData || []
        error = aulasError
      }

      if (error) throw error
      setAulas(data || [])
    } catch (error) {
      console.error('Error loading aulas:', error)
    }
  }

  const loadEstudiantes = async () => {
    if (!selectedFCP && !isTutorState) return

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

            // Cargar estudiantes de las aulas del tutor
            query = supabase
              .from('estudiantes')
              .select(`
                *,
                aula:aulas(id, nombre),
                fcp:fcps(razon_social)
              `)
              .in('aula_id', aulaIds)
              .eq('activo', true)

            // Si hay un aula seleccionada y está en las aulas del tutor, filtrar por ella
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
        query = supabase
          .from('estudiantes')
          .select(`
            *,
            aula:aulas(id, nombre),
            fcp:fcps(razon_social)
          `)
          .eq('fcp_id', selectedFCP)
          .eq('activo', true)

        if (selectedAula) {
          query = query.eq('aula_id', selectedAula)
        }
      }

      // Si hay término de búsqueda, aplicar filtro en la base de datos
      if (searchTerm) {
        query = query.or(`nombre_completo.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
      }
      
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
              .eq('activo', true)
            
            if (selectedAula && aulaIds.includes(selectedAula)) {
              countQuery = countQuery.eq('aula_id', selectedAula)
            }
          }
        }
      } else {
        countQuery = supabase
          .from('estudiantes')
          .select('id', { count: 'exact', head: true })
          .eq('fcp_id', selectedFCP)
          .eq('activo', true)
        
        if (selectedAula) {
          countQuery = countQuery.eq('aula_id', selectedAula)
        }
      }
      
      // Aplicar filtro de búsqueda si existe
      if (searchTerm && countQuery) {
        countQuery = countQuery.or(`nombre_completo.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
      }
      
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
      
      // Aplicar paginación solo si no hay búsqueda (la búsqueda muestra todos los resultados)
      let finalQuery = query.order('nombre_completo', { ascending: true })
      
      if (!searchTerm) {
        // Solo aplicar paginación cuando no hay búsqueda
        const from = (currentPage - 1) * itemsPerPage
        const to = from + itemsPerPage - 1
        finalQuery = finalQuery.range(from, to)
      }
      
      const { data, error } = await finalQuery

      if (error) {
        console.error('Error loading estudiantes:', error)
        throw error
      }
      
      console.log('Estudiantes cargados:', data?.length || 0, 'Total:', totalCount, 'Página actual:', currentPage)
      setEstudiantes(data || [])
      setTotalEstudiantes(totalCount || 0)
      
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
    // Asegurar que selectedFCP esté establecido antes de recargar
    if ((isSecretario || isDirector) && !selectedFCP && userFCPs.length > 0) {
      setSelectedFCP(userFCPs[0].id)
    }
    loadEstudiantes()
    setIsUploadDialogOpen(false)
  }

  // Calcular paginación
  // Si totalEstudiantes es 0 pero hay estudiantes cargados, usar el número de estudiantes cargados
  const effectiveTotal = totalEstudiantes > 0 ? totalEstudiantes : estudiantes.length
  const totalPages = Math.ceil(effectiveTotal / itemsPerPage)
  const startIndex = searchTerm ? 1 : (currentPage - 1) * itemsPerPage + 1
  const endIndex = searchTerm ? estudiantes.length : Math.min(currentPage * itemsPerPage, effectiveTotal)

  // Cuando hay búsqueda, mostrar todos los resultados sin paginación
  const displayEstudiantes = estudiantes
  const displayTotal = searchTerm ? estudiantes.length : effectiveTotal
  
  // Mostrar paginación si hay más estudiantes que itemsPerPage Y no hay búsqueda activa
  const shouldShowPagination = !searchTerm && (effectiveTotal > itemsPerPage || estudiantes.length > itemsPerPage)

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
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
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
              <select
                value={selectedFCP || ''}
                onChange={(e) => {
                  setSelectedFCP(e.target.value)
                  setSelectedAula(null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                {userFCPs.map((fcp) => (
                  <option key={fcp.id} value={fcp.id}>
                    {fcp.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filtrar por Aula (opcional):</label>
            <select
              value={selectedAula || ''}
              onChange={(e) => {
                const aulaId = e.target.value || null
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="">Todas las aulas</option>
              {aulas.map((aula) => (
                <option key={aula.id} value={aula.id}>
                  {aula.nombre}
                </option>
              ))}
            </select>
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
                  setCurrentPage(1) // Resetear a la primera página cuando se busca
                }}
                className="pl-10"
              />
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
              No hay aulas registradas. Primero crea aulas para esta FCP.
            </p>
            <Button onClick={() => router.push('/aulas')}>
              Ir a Aulas
            </Button>
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
        <Card>
          <CardHeader>
            <CardTitle>
              Estudiantes ({displayTotal} {displayTotal === 1 ? 'estudiante' : 'estudiantes'})
              {searchTerm && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (filtrado de {totalEstudiantes} total)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Aula</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayEstudiantes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'No se encontraron estudiantes con ese criterio' : 'No hay estudiantes'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayEstudiantes.map((estudiante) => (
                      <TableRow key={estudiante.id}>
                        <TableCell className="font-mono">{estudiante.codigo}</TableCell>
                        <TableCell>{estudiante.nombre_completo}</TableCell>
                        <TableCell>{estudiante.aula?.nombre || 'Sin aula'}</TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEstudianteForMovimiento(estudiante)
                                setIsMovimientoDialogOpen(true)
                              }}
                              disabled={!estudiante.activo || aulas.length <= 1}
                              title={aulas.length <= 1 ? 'Necesitas al menos 2 aulas para mover estudiantes' : 'Mover a otra aula'}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </RoleGuard>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {shouldShowPagination && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex} - {endIndex} de {effectiveTotal} estudiantes
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
    </div>
  )
}

