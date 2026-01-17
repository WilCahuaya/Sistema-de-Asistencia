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

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  activo: boolean
  aula_id: string
  aula?: {
    nombre: string
  }
  ong_id: string
  ong?: {
    nombre: string
  }
}

export function EstudianteList() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false)
  const [selectedEstudianteForMovimiento, setSelectedEstudianteForMovimiento] = useState<Estudiante | null>(null)
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const { canEdit } = useUserRole(selectedONG)

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
    } else {
      setAulas([])
    }
  }, [selectedONG])

  useEffect(() => {
    if (selectedONG) {
      loadEstudiantes()
    } else {
      setEstudiantes([])
    }
  }, [selectedONG, selectedAula])

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
      const supabase = createClient()
      const { data, error } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('ong_id', selectedONG)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (error) throw error
      setAulas(data || [])
    } catch (error) {
      console.error('Error loading aulas:', error)
    }
  }

  const loadEstudiantes = async () => {
    if (!selectedONG) return

    try {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('estudiantes')
        .select(`
          *,
          aula:aulas(id, nombre),
          ong:ongs(nombre)
        `)
        .eq('ong_id', selectedONG)

      if (selectedAula) {
        query = query.eq('aula_id', selectedAula)
      }

      // Ordenar por nombre_completo en lugar de apellido_paterno
      const { data, error } = await query.order('nombre_completo', { ascending: true })

      if (error) {
        console.error('Error loading estudiantes:', error)
        throw error
      }
      
      console.log('Estudiantes cargados:', data?.length || 0, data)
      setEstudiantes(data || [])
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
    loadEstudiantes()
    setIsUploadDialogOpen(false)
  }

  const filteredEstudiantes = estudiantes.filter((estudiante) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      estudiante.nombre_completo.toLowerCase().includes(searchLower) ||
      estudiante.codigo.toLowerCase().includes(searchLower)
    )
  })

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
    return <div className="text-center py-8">Cargando estudiantes...</div>
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Seleccionar ONG:</label>
            <select
              value={selectedONG || ''}
              onChange={(e) => {
                setSelectedONG(e.target.value)
                setSelectedAula(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {userONGs.map((ong) => (
                <option key={ong.id} value={ong.id}>
                  {ong.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filtrar por Aula (opcional):</label>
            <select
              value={selectedAula || ''}
              onChange={(e) => setSelectedAula(e.target.value || null)}
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
              <Button
                variant="outline"
                onClick={() => setIsUploadDialogOpen(true)}
                disabled={!selectedONG || aulas.length === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                Cargar Excel
              </Button>
            </RoleGuard>
            <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
              <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedONG || aulas.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Estudiante
              </Button>
            </RoleGuard>
          </div>
        </div>
      </div>

      {aulas.length === 0 && selectedONG ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No hay aulas registradas. Primero crea aulas para esta ONG.
            </p>
            <Button onClick={() => router.push('/aulas')}>
              Ir a Aulas
            </Button>
          </CardContent>
        </Card>
      ) : filteredEstudiantes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No se encontraron estudiantes con ese criterio' : 'No hay estudiantes registrados'}
            </p>
            <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
              <div className="flex gap-2">
                <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedONG || aulas.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Estudiante
                </Button>
                {selectedONG && aulas.length > 0 && (
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
              Estudiantes ({filteredEstudiantes.length} {filteredEstudiantes.length === 1 ? 'estudiante' : 'estudiantes'})
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
                  {filteredEstudiantes.map((estudiante) => (
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
                          ongId={selectedONG} 
                          allowedRoles={['facilitador', 'secretario']}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <EstudianteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleEstudianteCreated}
        ongId={selectedONG || ''}
        aulaId={selectedAula || undefined}
        aulas={aulas}
      />

      <EstudianteUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={handleUploadSuccess}
        ongId={selectedONG || ''}
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

