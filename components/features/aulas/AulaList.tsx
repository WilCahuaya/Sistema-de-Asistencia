'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, GraduationCap, Users, Edit } from 'lucide-react'
import { AulaDialog } from './AulaDialog'
import { AulaTutorDialog } from './AulaTutorDialog'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'

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
  const [selectedAulaForTutor, setSelectedAulaForTutor] = useState<Aula | null>(null)
  const [selectedFCP, setSelectedFCP] = useState<string | null>(null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string }>>([])
  const router = useRouter()
  const { isTutor, isFacilitador } = useUserRole(selectedFCP)

  useEffect(() => {
    loadUserFCPs()
  }, [])

  useEffect(() => {
    if (userFCPs.length > 0 && !selectedFCP) {
      setSelectedFCP(userFCPs[0].id)
    }
  }, [userFCPs])

  useEffect(() => {
    if (selectedFCP) {
      loadAulas()
    }
  }, [selectedFCP])

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

      let fcps: Array<{ id: string; nombre: string }> = []

      if (esFacilitador) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPs, error: fcpsError } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        fcps = (todasLasFCPs || []).map((fcp: any) => ({
          id: fcp.id,
          nombre: fcp.razon_social || 'FCP',
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
          id: item.fcp?.id,
          nombre: item.fcp?.razon_social || 'FCP',
        })).filter((fcp: any) => fcp.id) || []
      }

      setUserFCPs(fcps)
    } catch (error) {
      console.error('Error loading FCPs:', error)
    }
  }

  const loadAulas = async () => {
    if (!selectedFCP) return

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

      console.log('Cargando aulas para ONG:', selectedFCP, 'Usuario:', user.email)
      
      // Intentar cargar aulas
      const { data, error } = await supabase
        .from('aulas')
        .select('*')
        .eq('fcp_id', selectedFCP)
        .eq('activa', true)
        .order('nombre', { ascending: true })

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
      
      // Agregar información de FCP si está disponible en userFCPs
      const fcpInfo = userFCPs.find(fcp => fcp.id === selectedFCP)
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
          .eq('fcp_id', selectedFCP)
        
        if (tutoresError) {
          console.error('Error cargando tutores:', tutoresError)
        }
        
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
            No tienes ONGs asociadas. Primero crea o únete a una ONG.
          </p>
          <Button onClick={() => router.push('/ongs')}>
            Ir a ONGs
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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Seleccionar FCP:</label>
          <select
            value={selectedFCP || ''}
            onChange={(e) => setSelectedFCP(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            {userFCPs.map((fcp) => (
              <option key={fcp.id} value={fcp.id}>
                {fcp.nombre}
              </option>
            ))}
          </select>
        </div>
        <RoleGuard fcpId={selectedFCP} allowedRoles={['director', 'secretario']}>
          <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedFCP}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Aula
          </Button>
        </RoleGuard>
      </div>

      {aulas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              {isTutor
                ? 'No tienes aulas asignadas. Contacta a un facilitador para que te asigne las aulas que debes gestionar.'
                : 'No hay aulas registradas para esta ONG.'}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {aulas.map((aula) => (
            <Card key={aula.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{aula.nombre}</CardTitle>
                {aula.descripcion && (
                  <CardDescription>{aula.descripcion}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
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
                  <div className="pt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        aula.activa
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {aula.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
    </div>
  )
}

