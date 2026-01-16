'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Edit, Search, ClipboardList } from 'lucide-react'
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
  ong_id: string
}

export function AsistenciaList() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [isRegistroDialogOpen, setIsRegistroDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedAsistencia, setSelectedAsistencia] = useState<Asistencia | null>(null)
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [selectedAula, setSelectedAula] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

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

  useEffect(() => {
    if (selectedONG) {
      loadAsistencias()
    }
  }, [selectedONG, selectedAula, selectedDate])

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

  const loadAsistencias = async () => {
    if (!selectedONG) return

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Si hay filtro por aula, primero obtener los IDs de estudiantes de esa aula
      let estudianteIds: string[] | null = null
      if (selectedAula) {
        const { data: estudiantesData, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select('id')
          .eq('ong_id', selectedONG)
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
        .eq('ong_id', selectedONG)
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

  if (userONGs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
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

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">ONG:</label>
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

        <div>
          <label className="text-sm font-medium mb-2 block">Aula:</label>
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

        <div>
          <label className="text-sm font-medium mb-2 block">Fecha:</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex items-end">
          <Button
            onClick={() => setIsRegistroDialogOpen(true)}
            disabled={!selectedONG || !selectedAula}
            className="w-full"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Registrar Asistencias
          </Button>
        </div>
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
            {asistencias.length === 0 && (
              <Button
                onClick={() => setIsRegistroDialogOpen(true)}
                disabled={!selectedONG || !selectedAula}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Registrar Asistencias
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
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
              {filteredAsistencias.map((asistencia) => (
                <TableRow key={asistencia.id}>
                  <TableCell className="font-mono">{asistencia.estudiante?.codigo}</TableCell>
                  <TableCell>{asistencia.estudiante?.nombre_completo}</TableCell>
                  <TableCell>{asistencia.estudiante?.aula?.nombre}</TableCell>
                  <TableCell>{getEstadoBadge(asistencia.estado)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {asistencia.observaciones || '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAsistencia(asistencia)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedONG && selectedAula && (
        <AsistenciaRegistroDialog
          open={isRegistroDialogOpen}
          onOpenChange={setIsRegistroDialogOpen}
          onSuccess={handleAsistenciaCreated}
          ongId={selectedONG}
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

