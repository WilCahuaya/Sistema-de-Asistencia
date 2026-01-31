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

interface MiembroRol {
  id: string
  rol: 'facilitador' | 'director' | 'secretario' | 'tutor'
  activo: boolean
}

interface Miembro {
  id: string
  usuario_id: string | null
  email_pendiente?: string | null
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
  const { isFacilitador, isDirector, isSecretario } = useUserRole(fcpId)
  const canView = isFacilitador || isDirector || isSecretario
  const canManage = isDirector || isSecretario // Facilitadores solo pueden ver

  useEffect(() => {
    if (fcpId) {
      loadMiembros()
      loadFCPNombre()
    }
  }, [fcpId])

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
        // Si no hay datos de usuario pero hay usuario_id, el usuario existe en auth.users
        // pero no se sincronizó a usuarios - mostrar ID como referencia
        const email = usuarioData?.email || miembro.email_pendiente || 
                     (miembro.usuario_id ? `Usuario ${miembro.usuario_id.substring(0, 8)}...` : 'Sin email')
        const nombreCompleto = usuarioData?.nombre_completo || 
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
              <p className="mb-2 text-xs text-muted-foreground sm:hidden">Desliza para ver más columnas →</p>
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
                  {miembros.map((miembro) => {
                    // Obtener email: primero de usuario registrado, luego de email_pendiente
                    const email = miembro.usuario?.email || miembro.email_pendiente || 'Sin email'
                    const nombre = miembro.usuario?.nombre_completo || 'Sin nombre'
                    
                    // Obtener roles activos
                    const rolesActivos = miembro.roles?.filter((r: any) => r.activo) || []
                    const tieneRolesActivos = rolesActivos.length > 0
                    
                    // Para editar, usar el primer rol o el miembro completo si solo tiene uno
                    const miembroParaEditar = miembro.roles && miembro.roles.length > 0 
                      ? { ...miembro, id: miembro.roles[0].id, rol: miembro.roles[0].rol, activo: miembro.roles[0].activo }
                      : miembro
                    
                    return (
                    <TableRow key={miembro.usuario_id || miembro.email_pendiente || miembro.id}>
                      <TableCell>
                        {nombre}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {miembro.fcp?.razon_social || 'Sin FCP'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rolesActivos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rolesActivos.map((r: any) => (
                              <Badge key={r.id} className={getRolBadgeColor(r.rol)}>
                                {getRolDisplayName(r.rol)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            tieneRolesActivos
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }
                        >
                          {tieneRolesActivos ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(miembro.fecha_asignacion).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        {/* Mostrar aulas si el registro es tutor O si el usuario tiene aulas asignadas como tutor */}
                        {(miembro.rol === 'tutor' || (miembro.aulas && miembro.aulas.length > 0)) ? (
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
                        {/* Mostrar botón de editar según el rol del usuario */}
                        {isSecretario ? (
                          // Secretarios solo pueden editar tutores
                          rolesActivos.some((r: any) => r.rol === 'tutor') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditMiembro(miembroParaEditar)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )
                        ) : (
                          // Directores y facilitadores pueden editar todos
                        <RoleGuard fcpId={fcpId} allowedRoles={['director', 'secretario']}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMiembro(miembroParaEditar)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </RoleGuard>
                        )}
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              </div>
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

