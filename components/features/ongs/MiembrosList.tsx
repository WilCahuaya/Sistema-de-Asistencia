'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Edit, Ban } from 'lucide-react'
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
import { RoleGuard } from '@/components/auth/RoleGuard'
import { getRolDisplayName, getRolBadgeColor } from '@/lib/utils/roles'

interface Miembro {
  id: string
  usuario_id: string | null
  email_pendiente?: string | null
  ong_id: string
  rol: 'facilitador' | 'secretario' | 'tutor'
  activo: boolean
  fecha_asignacion: string
  usuario?: {
    email: string
    nombre_completo?: string
  }
  ong?: {
    id: string
    nombre: string
  }
  aulas?: Array<{
    id: string
    nombre: string
  }>
}

interface MiembrosListProps {
  ongId: string
}

export function MiembrosList({ ongId }: MiembrosListProps) {
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedMiembro, setSelectedMiembro] = useState<Miembro | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [ongNombre, setOngNombre] = useState<string>('')
  const { isFacilitador } = useUserRole(ongId)

  useEffect(() => {
    if (ongId) {
      loadMiembros()
      loadONGNombre()
    }
  }, [ongId])

  const loadONGNombre = async () => {
    if (!ongId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ongs')
        .select('nombre')
        .eq('id', ongId)
        .single()

      if (error) throw error
      if (data) {
        setOngNombre(data.nombre)
      }
    } catch (error) {
      console.error('Error loading ONG nombre:', error)
    }
  }

  const loadMiembros = async () => {
    if (!ongId) return

    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          id,
          usuario_id,
          email_pendiente,
          ong_id,
          rol,
          activo,
          fecha_asignacion,
          usuario:usuarios(
            email,
            nombre_completo
          ),
          ong:ongs(
            id,
            nombre
          )
        `)
        .eq('ong_id', ongId)
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
        // Si no hay datos de usuario pero hay usuario_id, el usuario existe en auth.users
        // pero no se sincronizó a usuarios - mostrar ID como referencia
        const email = usuarioData?.email || miembro.email_pendiente || 
                     (miembro.usuario_id ? `Usuario ${miembro.usuario_id.substring(0, 8)}...` : 'Sin email')
        const nombreCompleto = usuarioData?.nombre_completo || 
                              (miembro.usuario_id && !usuarioData ? 'Usuario no sincronizado' : 'Sin nombre')
        
        // Si el miembro es tutor, cargar las aulas asignadas
        let aulasAsignadas: Array<{ id: string; nombre: string }> = []
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
              .eq('usuario_ong_id', miembro.id)
              .eq('activo', true)
              .eq('ong_id', ongId)
            
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
      
      setMiembros(miembrosProcesados)
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

  if (!isFacilitador) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Solo los facilitadores pueden gestionar miembros de la ONG.
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
                Miembros de la ONG
              </CardTitle>
              {ongNombre && (
                <p className="text-sm text-muted-foreground mt-1">
                  ONG: <span className="font-medium">{ongNombre}</span>
                </p>
              )}
            </div>
            <RoleGuard ongId={ongId} allowedRoles={['facilitador']}>
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
                No hay miembros registrados en esta ONG
              </p>
              <RoleGuard ongId={ongId} allowedRoles={['facilitador']}>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Primer Miembro
                </Button>
              </RoleGuard>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ONG</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de Asignación</TableHead>
                    <TableHead>Aulas (Tutor)</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {miembros.map((miembro) => {
                    // Obtener email: primero de usuario registrado, luego de email_pendiente
                    const email = miembro.usuario?.email || miembro.email_pendiente || 'Sin email'
                    const nombre = miembro.usuario?.nombre_completo || 'Sin nombre'
                    
                    return (
                    <TableRow key={miembro.id}>
                      <TableCell>
                        {nombre}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {miembro.ong?.nombre || 'Sin ONG'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRolBadgeColor(miembro.rol)}>
                          {getRolDisplayName(miembro.rol)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            miembro.activo
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }
                        >
                          {miembro.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(miembro.fecha_asignacion).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        {miembro.rol === 'tutor' ? (
                          miembro.aulas && miembro.aulas.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {miembro.aulas.map((aula) => (
                                <Badge
                                  key={aula.id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {aula.nombre}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Sin aulas asignadas
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RoleGuard ongId={ongId} allowedRoles={['facilitador']}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMiembro(miembro)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </RoleGuard>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MiembroAddDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleMiembroAdded}
        ongId={ongId}
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

