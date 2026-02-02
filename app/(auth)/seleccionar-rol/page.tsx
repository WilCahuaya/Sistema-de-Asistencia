'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, User, Loader2, LogOut } from 'lucide-react'
import { getRolDisplayName, getRolBadgeColor } from '@/lib/utils/roles'
import { toast } from '@/lib/toast'

interface FcpInfo {
  id: string
  razon_social: string
  numero_identificacion?: string
}

interface RolFCP {
  id: string
  rol: 'facilitador' | 'director' | 'secretario' | 'tutor'
  fcp_id: string | null
  fcp?: FcpInfo
  /** Solo para facilitador unificado: lista de FCPs que administra */
  fcps?: FcpInfo[]
}

export default function SeleccionarRolPage() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RolFCP[]>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') {
      return
    }
    
    loadRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRoles = async () => {
    if (typeof window === 'undefined') return

    try {
      setLoading(true)
      setLoadError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        setLoading(false)
        return
      }

      let hadError = false
      const rolesFacilitador: RolFCP[] = []

      const { data: facilitadorRow, error: facilErr } = await supabase
        .from('facilitadores')
        .select('usuario_id')
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (facilErr) {
        console.error('Error loading facilitadores:', facilErr)
        setLoadError('Error al verificar rol facilitador.')
        hadError = true
      }

      if (facilitadorRow) {
        const { data: fcpsFac, error: fcpsErr } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('facilitador_id', user.id)
          .eq('activa', true)
          .order('razon_social', { ascending: true })

        if (fcpsErr) {
          console.error('Error loading facilitator FCPs:', fcpsErr)
          setLoadError('Error al cargar FCPs de facilitador.')
          hadError = true
        }
        const fcpsList: FcpInfo[] = (fcpsFac || []).map((f) => ({
          id: f.id,
          razon_social: f.razon_social ?? '',
          numero_identificacion: f.numero_identificacion ?? undefined,
        }))
        rolesFacilitador.push({
          id: 'facilitador-sistema',
          rol: 'facilitador',
          fcp_id: null,
          fcp: { id: '', razon_social: 'Facilitador', numero_identificacion: undefined },
          fcps: fcpsList,
        })
      }

      const { data: fcpMiembrosData, error } = await supabase
        .from('fcp_miembros')
        .select(`
          id,
          rol,
          fcp_id,
          created_at,
          fcp:fcps(id, razon_social, numero_identificacion)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading fcp_miembros:', error)
        setLoadError('Error al cargar roles de miembro.')
        hadError = true
      }

      const rolesMiembros: RolFCP[] = (fcpMiembrosData || [])
        .filter((r: any) => r.fcp_id != null && r.fcp)
        .map((r: any) => ({
          id: r.id,
          rol: r.rol,
          fcp_id: r.fcp_id,
          fcp: { id: r.fcp.id, razon_social: r.fcp.razon_social ?? '', numero_identificacion: r.fcp.numero_identificacion },
        })) as RolFCP[]

      const uniqueRoles: RolFCP[] = [...rolesFacilitador]
      const seen = new Set<string>()
      for (const r of rolesFacilitador) seen.add(`facilitador-${r.id}`)
      for (const r of rolesMiembros) {
        const key = `${r.fcp_id}-${r.rol}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueRoles.push(r)
        }
      }

      if (uniqueRoles.length === 0 && !hadError) {
        router.push('/pendiente')
        setLoading(false)
        return
      }

      setRoles(uniqueRoles)
      if (uniqueRoles.length === 1) setSelectedRole(uniqueRoles[0].id)
      setLoading(false)
    } catch (err) {
      console.error('Error in loadRoles:', err)
      setLoadError('Error al cargar roles. Reintenta.')
      setRoles([])
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
      toast.error('Error al seleccionar el rol', 'Por favor, intenta nuevamente.')
    }
  }

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('selectedRoleId')
      localStorage.removeItem('selectedRole')
      localStorage.removeItem('selectedFcpId')
      await signOut()
    } catch (err) {
      console.error('Error signing out:', err)
      toast.error('Error al cerrar sesión', 'Por favor, intenta nuevamente.')
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
    <div className="min-h-screen flex items-center justify-center bg-background px-3 py-6 sm:px-4 sm:py-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2 sm:text-3xl">
            Selecciona tu Rol
          </h1>
          <p className="text-muted-foreground">
            {roles.length === 1
              ? 'Tienes un rol asignado. Haz clic en &quot;Acceder con este rol&quot; para continuar.'
              : 'Tienes varios roles. Elige uno como rol activo para operar. Al cambiar de rol mantienes la misma sesión; la interfaz y permisos dependen solo del rol seleccionado.'}
          </p>

          {/* Botón de cerrar sesión elegante con tema adaptativo */}
          <div className="mt-6">
            <button
              onClick={handleSignOut}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full 
                         bg-muted/50 hover:bg-primary/10 
                         border border-border hover:border-primary/50
                         text-muted-foreground hover:text-primary
                         transition-all duration-300 ease-in-out
                         hover:shadow-md hover:shadow-primary/10
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
            >
              <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {loadError && roles.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => loadRoles()}>
              Reintentar
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const isFacilitadorUnificado = role.rol === 'facilitador' && role.fcps != null
            return (
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
                  {isFacilitadorUnificado ? (
                    <>
                      <CardTitle className="text-base sm:text-lg">Facilitador</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        FCPs que administras:
                      </CardDescription>
                      {role.fcps && role.fcps.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {role.fcps.map((f) => (
                            <li key={f.id} className="flex items-baseline gap-2">
                              <span className="font-medium text-foreground">{f.razon_social}</span>
                              {f.numero_identificacion && (
                                <span className="text-xs">({f.numero_identificacion})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Sin FCPs asignadas</p>
                      )}
                    </>
                  ) : (
                    <>
                      <CardTitle className="text-base sm:text-lg">
                        {role.fcp?.razon_social || 'Sistema'}
                      </CardTitle>
                      {role.fcp?.numero_identificacion && (
                        <CardDescription className="text-xs">
                          {role.fcp.numero_identificacion}
                        </CardDescription>
                      )}
                    </>
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
            )
          })}
        </div>

        {roles.length === 0 && (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {loadError ? loadError : 'No tienes roles asignados. Contacta al administrador.'}
                </p>
                {loadError && (
                  <Button variant="outline" onClick={() => loadRoles()}>
                    Reintentar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

