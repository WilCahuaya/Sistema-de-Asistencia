'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Users, Edit, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ONGEditDialog } from './ONGEditDialog'
import { ONGDialog } from './ONGDialog'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'

interface ONG {
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

export function ONGList() {
  const [ongs, setONGs] = useState<ONG[]>([])
  const [loading, setLoading] = useState(true)
  const [editingONG, setEditingONG] = useState<ONG | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isFacilitador, setIsFacilitador] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadONGs()
    checkIfFacilitador()
  }, [])

  const checkIfFacilitador = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el usuario es facilitador en alguna FCP
      const { data: fcpMiembrosData, error: fcpMiembrosError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (fcpMiembrosError) {
        console.error('Error checking facilitador:', fcpMiembrosError)
        return
      }

      setIsFacilitador(fcpMiembrosData && fcpMiembrosData.length > 0)
    } catch (error) {
      console.error('Error checking facilitador:', error)
    }
  }

  const loadONGs = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError)
        setONGs([])
        return
      }

      // Verificar si el usuario es facilitador
      const { data: fcpMiembrosData, error: fcpMiembrosError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      const isFacilitadorUser = fcpMiembrosData && fcpMiembrosData.length > 0

      let fcpsList: ONG[] = []

      if (isFacilitadorUser) {
        // Facilitadores pueden ver todas las FCPs del sistema
        const { data: todasLasFCPs, error: fcpsError } = await supabase
          .from('fcps')
          .select('*')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (fcpsError) throw fcpsError
        fcpsList = todasLasFCPs || []
      } else {
        // Usuarios no facilitadores solo ven sus FCPs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            *,
            fcp:fcps(*)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        // Filtrar y mapear FCPs, eliminando duplicados por ID
        const fcpsMap = new Map<string, ONG>()
        data?.forEach((item: any) => {
          if (item.fcp && item.fcp.id) {
            fcpsMap.set(item.fcp.id, item.fcp)
          }
        })
        
        fcpsList = Array.from(fcpsMap.values())
      }
      
      setONGs(fcpsList)
    } catch (error) {
      console.error('Error loading ONGs:', error)
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
            {isFacilitador ? 'FCPs del Sistema' : 'Mis FCPs'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFacilitador 
              ? 'Como facilitador, puedes crear y gestionar FCPs del sistema.'
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

      {ongs.length === 0 ? (
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
          {ongs.map((ong) => (
            <Card key={ong.id}>
              <CardHeader>
                <CardTitle>{ong.razon_social}</CardTitle>
                <CardDescription>ID: {ong.numero_identificacion}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium">Número de Identificación:</span> {ong.numero_identificacion}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Razón Social:</span> {ong.razon_social}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Nombre Completo:</span> {ong.nombre_completo_contacto}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Teléfono:</span> {ong.telefono}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Correo Electrónico:</span> {ong.email}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Ubicación:</span> {ong.ubicacion}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Rol:</span> {ong.rol_contacto}
                  </p>
                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          ong.activa
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {ong.activa ? 'Activa' : 'Inactiva'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/ongs/${ong.id}/miembros`)}
                        className="text-xs"
                      >
                        <Users className="mr-1 h-3 w-3" />
                        Miembros
                      </Button>
                    </div>
                    <RoleGuard fcpId={ong.id} allowedRoles={['facilitador']}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingONG(ong)
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

      {editingONG && (
        <ONGEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setEditingONG(null)
          }}
          onSuccess={() => {
            setIsEditDialogOpen(false)
            setEditingONG(null)
            loadONGs()
          }}
          ongId={editingONG.id}
          initialData={editingONG}
        />
      )}

      <ONGDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
        }}
        onSuccess={() => {
          setIsCreateDialogOpen(false)
          loadONGs()
          checkIfFacilitador()
        }}
      />
    </div>
  )
}

