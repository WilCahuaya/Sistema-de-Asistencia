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

      // Unir FCPs como facilitador (fcps.facilitador_id) + como miembro (fcp_miembros).
      const { data: facilitadorRow } = await supabase
        .from('facilitadores')
        .select('usuario_id')
        .eq('usuario_id', user.id)
        .maybeSingle()

      const fcpMap = new Map<string, FCP>()
      if (facilitadorRow) {
        const { data: fcpsData } = await supabase
          .from('fcps')
          .select('*')
          .eq('facilitador_id', user.id)
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        if (fcpsData) for (const f of fcpsData) fcpMap.set(f.id, f)
      }

      const memberOnlyIds = new Set<string>()
      const { data: miembrosData } = await supabase
        .from('fcp_miembros')
        .select('fcp_id, fcp:fcps(*)')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .not('fcp_id', 'is', null)
      if (miembrosData) {
        for (const m of miembrosData) {
          if (m.fcp && m.fcp_id && !fcpMap.has(m.fcp_id)) {
            const fcp = Array.isArray((m as any).fcp) ? (m as any).fcp[0] : (m as any).fcp
            fcpMap.set(m.fcp_id, fcp as FCP)
            memberOnlyIds.add(m.fcp_id)
          }
        }
      }

      let merged = Array.from(fcpMap.values()).sort((a, b) => (a.razon_social || '').localeCompare(b.razon_social || ''))

      if (selectedRole) {
        if (selectedRole.role === 'facilitador') {
          merged = merged.filter(f => !memberOnlyIds.has(f.id))
        } else if (selectedRole.fcpId) {
          const sole = merged.find(f => f.id === selectedRole.fcpId)
          merged = sole ? [sole] : []
        }
      }
      setFCPs(merged)
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
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
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
              {isFacilitador
                ? 'Aún no tienes FCPs creadas. Haz clic en "Crear Nueva FCP" para comenzar.'
                : 'No tienes FCPs asignadas. Contacta a un facilitador para que te agregue a una FCP.'}
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

