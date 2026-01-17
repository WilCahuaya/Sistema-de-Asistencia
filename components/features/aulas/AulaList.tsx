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
  ong_id: string
  ong?: {
    nombre: string
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
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])
  const router = useRouter()
  const { isTutor, isFacilitador } = useUserRole(selectedONG)

  useEffect(() => {
    loadUserONGs()
  }, [])

  useEffect(() => {
    if (userONGs.length > 0 && !selectedONG) {
      setSelectedONG(userONGs[0].id)
    }
  }, [userONGs])

  useEffect(() => {
    if (selectedONG) {
      loadAulas()
    }
  }, [selectedONG])

  const loadUserONGs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          ong_id,
          ong:ongs(id, nombre)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (error) throw error

      const ongs = data?.map((item: any) => ({
        id: item.ong.id,
        nombre: item.ong.nombre,
      })) || []

      setUserONGs(ongs)
    } catch (error) {
      console.error('Error loading ONGs:', error)
    }
  }

  const loadAulas = async () => {
    if (!selectedONG) return

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

      console.log('Cargando aulas para ONG:', selectedONG, 'Usuario:', user.email)
      
      // Intentar cargar aulas
      const { data, error } = await supabase
        .from('aulas')
        .select('*')
        .eq('ong_id', selectedONG)
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
      
      // Agregar información de ONG si está disponible en userONGs
      const ongInfo = userONGs.find(ong => ong.id === selectedONG)
      const aulasBase = (data || []).map(aula => ({
        ...aula,
        ong: ongInfo ? { nombre: ongInfo.nombre } : undefined
      }))
      
      // Si es facilitador, cargar información de tutores asignados a cada aula
      // Verificar si el usuario actual es facilitador
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      let aulasWithTutors = aulasBase
      
      if (currentUser) {
        const { data: userOngData } = await supabase
          .from('usuario_ong')
          .select('rol')
          .eq('usuario_id', currentUser.id)
          .eq('ong_id', selectedONG)
          .eq('activo', true)
          .maybeSingle()
        
        if (userOngData?.rol === 'facilitador' && aulasBase.length > 0) {
          // Cargar todos los tutores asignados a las aulas de una vez
          const aulaIds = aulasBase.map(a => a.id)
          const { data: tutoresData } = await supabase
            .from('tutor_aula')
            .select(`
              aula_id,
              usuario_ong:usuario_ong!inner(
                usuario:usuarios!inner(id, email, nombre_completo)
              )
            `)
            .in('aula_id', aulaIds)
            .eq('activo', true)
          
          // Crear un mapa de aula_id -> tutor para acceso rápido
          const tutoresMap = new Map<string, TutorInfo>()
          if (tutoresData) {
            tutoresData.forEach((tutorData: any) => {
              if (tutorData.usuario_ong?.usuario && !tutoresMap.has(tutorData.aula_id)) {
                const usuario = tutorData.usuario_ong.usuario
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

  if (userONGs.length === 0) {
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
          <Button onClick={() => selectedONG && loadAulas()}>
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
          <label className="text-sm font-medium mb-2 block">Seleccionar ONG:</label>
          <select
            value={selectedONG || ''}
            onChange={(e) => setSelectedONG(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            {userONGs.map((ong) => (
              <option key={ong.id} value={ong.id}>
                {ong.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedONG}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Aula
        </Button>
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
            <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
              <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedONG}>
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
                  {aula.ong && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">ONG:</span> {aula.ong.nombre}
                    </p>
                  )}
                  {isFacilitador && (
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
                    </div>
                  )}
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
        ongId={selectedONG || ''}
      />

      {selectedAulaForTutor && (
        <AulaTutorDialog
          open={isTutorDialogOpen}
          onOpenChange={setIsTutorDialogOpen}
          onSuccess={handleTutorAssigned}
          aulaId={selectedAulaForTutor.id}
          aulaNombre={selectedAulaForTutor.nombre}
          ongId={selectedONG || ''}
          tutorActual={selectedAulaForTutor.tutor}
        />
      )}
    </div>
  )
}

