'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, User, Loader2 } from 'lucide-react'
import { getRolDisplayName, getRolBadgeColor } from '@/lib/utils/roles'

interface RolFCP {
  id: string
  rol: 'facilitador' | 'director' | 'secretario' | 'tutor'
  fcp_id: string | null
  fcp?: {
    id: string
    razon_social: string
    numero_identificacion?: string
  }
}

export default function SeleccionarRolPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RolFCP[]>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') {
      return
    }
    
    loadRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRoles = async () => {
    // Asegurar que solo se ejecute en el cliente
    if (typeof window === 'undefined') {
      return
    }
    
    try {
      setLoading(true)
      
      // Crear cliente solo cuando se necesita, dentro de la función
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Obtener todos los roles activos del usuario con sus FCPs
      const { data: fcpMiembrosData, error } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          rol,
          fcp_id,
          created_at,
          fcp:fcps(
            id,
            razon_social,
            numero_identificacion
          )
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading roles:', error)
        setLoading(false)
        return
      }

      if (!fcpMiembrosData || fcpMiembrosData.length === 0) {
        // Si no tiene roles, redirigir a pendiente
        router.push('/pendiente')
        return
      }

      // Deduplicar roles: para facilitadores, mostrar solo uno por FCP
      // Excluir facilitadores del sistema (fcp_id = null)
      const uniqueRoles: RolFCP[] = []
      const seenFacilitadorKeys = new Set<string>()

      for (const role of fcpMiembrosData) {
        if (role.rol === 'facilitador') {
          // Excluir facilitadores del sistema (sin FCP asignada)
          if (role.fcp_id === null) {
            continue
          }
          
          // Para facilitadores, usar una clave única basada en fcp_id
          const key = role.fcp_id
          
          if (!seenFacilitadorKeys.has(key)) {
            seenFacilitadorKeys.add(key)
            uniqueRoles.push(role as RolFCP)
          }
          // Si ya existe un facilitador para esta FCP, omitir este
        } else {
          // Para otros roles, agregar directamente (pueden tener múltiples roles por FCP)
          uniqueRoles.push(role as RolFCP)
        }
      }

      if (uniqueRoles.length === 0) {
        router.push('/pendiente')
        return
      }

      // Si solo tiene un rol único, guardarlo y redirigir directamente
      if (uniqueRoles.length === 1) {
        const singleRole = uniqueRoles[0]
        await saveSelectedRole(singleRole.id, singleRole.rol, singleRole.fcp_id)
        // Esperar un momento para asegurar que las cookies se establezcan
        await new Promise(resolve => setTimeout(resolve, 500))
        // Forzar recarga completa de la página
        window.location.href = '/dashboard'
        return
      }

      // Si tiene múltiples roles, mostrar la página de selección
      setRoles(uniqueRoles)
      setLoading(false)
    } catch (err) {
      console.error('Error in loadRoles:', err)
      setLoading(false)
    }
  }

  const saveSelectedRole = async (roleId: string, rol: string, fcpId: string | null) => {
    // Esta función ya no se usa directamente, se maneja en handleSelectRole
    // Se mantiene para compatibilidad con el código que redirige automáticamente cuando hay un solo rol
    localStorage.setItem('selectedRoleId', roleId)
    localStorage.setItem('selectedRole', rol)
    if (fcpId) {
      localStorage.setItem('selectedFcpId', fcpId)
    } else {
      localStorage.removeItem('selectedFcpId')
    }

    // También guardar en cookies para que el servidor pueda leerlo
    try {
      const response = await fetch('/api/set-selected-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleId,
          role: rol,
          fcpId
        })
      })
      
      if (!response.ok) {
        console.error('Error setting selected role cookie:', await response.text())
      }
    } catch (err) {
      console.error('Error setting selected role cookie:', err)
    }
  }

  const handleSelectRole = async (role: RolFCP) => {
    try {
      setSubmitting(true)
      
      console.log('🔍 Seleccionando rol:', {
        roleId: role.id,
        role: role.rol,
        fcpId: role.fcp_id
      })
      
      // Guardar primero en localStorage (para acceso inmediato del cliente)
      localStorage.setItem('selectedRoleId', role.id)
      localStorage.setItem('selectedRole', role.rol)
      if (role.fcp_id) {
        localStorage.setItem('selectedFcpId', role.fcp_id)
      } else {
        localStorage.removeItem('selectedFcpId')
      }

      // Luego establecer las cookies en el servidor
      const response = await fetch('/api/set-selected-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleId: role.id,
          role: role.rol,
          fcpId: role.fcp_id
        }),
        credentials: 'include' // Importante: incluir cookies en la petición
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error al establecer el rol seleccionado:', errorText)
        throw new Error(`Error al establecer el rol seleccionado: ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ Rol guardado correctamente en servidor:', {
        roleId: role.id,
        role: role.rol,
        fcpId: role.fcp_id,
        serverResponse: result
      })
      
      // Esperar un momento para asegurar que las cookies se establezcan en el navegador
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Verificar que las cookies se establecieron (solo en el cliente)
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)
      
      console.log('🔍 Cookies después de establecer:', {
        selectedRoleId: cookies['selectedRoleId'],
        selectedRole: cookies['selectedRole'],
        selectedFcpId: cookies['selectedFcpId']
      })
      
      // Forzar recarga completa de la página para asegurar que las cookies se lean correctamente
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Error selecting role:', err)
      setSubmitting(false)
      alert('Error al seleccionar el rol. Por favor, intenta nuevamente.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tus roles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Selecciona tu Rol
          </h1>
          <p className="text-muted-foreground">
            Tienes múltiples roles asignados. Selecciona con cuál rol deseas acceder a la aplicación.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card
              key={role.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedRole === role.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedRole(role.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRolBadgeColor(role.rol)}`}>
                    {getRolDisplayName(role.rol)}
                  </span>
                </div>
                <CardTitle className="text-lg">
                  {role.fcp?.razon_social || 'Sistema'}
                </CardTitle>
                {role.fcp?.numero_identificacion && (
                  <CardDescription className="text-xs">
                    {role.fcp.numero_identificacion}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectRole(role)
                  }}
                  disabled={submitting}
                >
                  {submitting && selectedRole === role.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accediendo...
                    </>
                  ) : (
                    'Acceder con este rol'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {roles.length === 0 && (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No tienes roles asignados. Contacta al administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

