'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Edit, Plus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FCPEditDialog } from './FCPEditDialog'
import { FCPDialog } from './FCPDialog'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'

interface FCP {
  id: string
  numero_identificacion: string
  razon_social: string
  nombre_completo_contacto: string
  telefono: string
  email: string
  ubicacion: string
  rol_contacto: string
  activa: boolean
}

export function FCPList() {
  const [fcps, setFCPs] = useState<FCP[]>([])
  const [loading, setLoading] = useState(true)
  const [editingFCP, setEditingFCP] = useState<FCP | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const router = useRouter()
  const { selectedRole } = useSelectedRole()
  
  // Usar el rol seleccionado para determinar si es facilitador
  const isFacilitador = selectedRole?.role === 'facilitador'

  useEffect(() => {
    loadFCPs()
  }, [selectedRole])

  const loadFCPs = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError)
        setFCPs([])
        return
      }

      // Verificar si el usuario es facilitador (directamente en la BD, no solo desde selectedRole)
      // Esto es necesario porque selectedRole puede ser null mientras se carga
      const { data: facilitadorData, error: facilitadorError } = await supabase
        .from('fcp_miembros')
        .select('rol, fcp_id')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)
        .maybeSingle()

      const esFacilitador = !facilitadorError && facilitadorData !== null
      const esFacilitadorDesdeSelectedRole = selectedRole?.role === 'facilitador'
      const usuarioEsFacilitador = esFacilitador || esFacilitadorDesdeSelectedRole

      console.log('👤 [FCPList] Verificación de rol:', {
        esFacilitadorDesdeBD: esFacilitador,
        esFacilitadorDesdeSelectedRole,
        usuarioEsFacilitador,
        selectedRole: selectedRole ? { role: selectedRole.role, fcpId: selectedRole.fcpId } : null
      })

      // Si es facilitador, mostrar TODAS las FCPs donde tiene el rol de facilitador activo
      if (usuarioEsFacilitador) {
        console.log('👤 [FCPList] Usuario es facilitador, cargando FCPs a su cargo')
        
        // Obtener todas las FCPs donde el usuario tiene el rol de facilitador activo
        const { data: fcpMiembrosData, error: fcpMiembrosError } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(*)
          `)
          .eq('usuario_id', user.id)
          .eq('rol', 'facilitador')
          .eq('activo', true)

        if (fcpMiembrosError) {
          console.error('Error obteniendo FCPs del facilitador:', fcpMiembrosError)
          setFCPs([])
          return
        }

        // Extraer las FCPs de los resultados
        const fcpsDelFacilitador = (fcpMiembrosData || [])
          .map((miembro: any) => miembro.fcp)
          .filter((fcp: any) => fcp && fcp.activa) // Solo FCPs activas
          .sort((a: any, b: any) => a.razon_social.localeCompare(b.razon_social))

        console.log(`✅ [FCPList] Cargadas ${fcpsDelFacilitador.length} FCPs a cargo del facilitador`)
        setFCPs(fcpsDelFacilitador)
        return
      }

      // Para otros roles, solo mostrar la FCP del rol seleccionado
      if (!selectedRole?.fcpId) {
        console.log('No hay rol seleccionado o FCP asociada')
        setFCPs([])
        return
      }

      // Obtener solo la FCP del rol seleccionado
      const { data: fcpData, error: fcpError } = await supabase
        .from('fcps')
        .select('*')
        .eq('id', selectedRole.fcpId)
        .eq('activa', true)
        .single()

      if (fcpError) {
        console.error('Error obteniendo FCP:', fcpError)
        setFCPs([])
        return
      }

      if (fcpData) {
        setFCPs([fcpData])
      } else {
        setFCPs([])
      }
    } catch (error) {
      console.error('Error loading FCPs:', error)
      setFCPs([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando FCPs...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {isFacilitador ? 'FCPs a mi Cargo' : 'Mis FCPs'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFacilitador 
              ? 'Como facilitador, puedes crear y gestionar las FCPs que están a tu cargo.'
              : 'Las FCPs a las que perteneces aparecen aquí.'}
          </p>
        </div>
        {isFacilitador && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Nueva FCP
          </Button>
        )}
      </div>

      {fcps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              No tienes FCPs asignadas. Contacta a un facilitador para que te agregue a una FCP.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fcps.map((fcp) => (
            <Card key={fcp.id}>
              <CardHeader>
                <CardTitle>{fcp.razon_social}</CardTitle>
                <CardDescription>ID: {fcp.numero_identificacion}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium">Número de Identificación:</span> {fcp.numero_identificacion}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Razón Social:</span> {fcp.razon_social}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Nombre Completo:</span> {fcp.nombre_completo_contacto}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Teléfono:</span> {fcp.telefono}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Correo Electrónico:</span> {fcp.email}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Ubicación:</span> {fcp.ubicacion}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Rol:</span> {fcp.rol_contacto}
                  </p>
                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          fcp.activa
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {fcp.activa ? 'Activa' : 'Inactiva'}
                      </span>
                      <RoleGuard fcpId={fcp.id} allowedRoles={['facilitador', 'director', 'secretario']}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/fcps/${fcp.id}/miembros`)}
                          className="text-xs"
                        >
                          <Users className="mr-1 h-3 w-3" />
                          Miembros
                        </Button>
                      </RoleGuard>
                    </div>
                    <RoleGuard fcpId={fcp.id} allowedRoles={['facilitador']}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingFCP(fcp)
                          setIsEditDialogOpen(true)
                        }}
                        className="w-full text-xs"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Editar FCP
                      </Button>
                    </RoleGuard>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingFCP && (
        <FCPEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setEditingFCP(null)
          }}
          onSuccess={() => {
            setIsEditDialogOpen(false)
            setEditingFCP(null)
            loadFCPs()
          }}
          fcpId={editingFCP.id}
          initialData={editingFCP}
        />
      )}

      <FCPDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
        }}
        onSuccess={() => {
          setIsCreateDialogOpen(false)
          loadFCPs()
        }}
      />
    </div>
  )
}

