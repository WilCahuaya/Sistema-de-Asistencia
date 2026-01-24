'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserX, LogOut, Mail, MessageCircle, AlertCircle, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'

export default function SinRolPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isChecking, setIsChecking] = useState(false)
  const [usuarioData, setUsuarioData] = useState<{ nombre_completo?: string; email?: string } | null>(null)
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null)

  // Cargar datos del usuario
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return
      
      const supabase = createClient()
      try {
        const { data } = await supabase
          .from('usuarios')
          .select('id, email, nombre_completo')
          .eq('id', user.id)
          .single()
        setUsuarioData(data)
      } catch (error: any) {
        console.warn('Error getting usuario data:', error?.message)
        setUsuarioData(null)
      }
    }

    loadUserData()
  }, [user])

  // Función para verificar si el usuario tiene roles
  const checkForRoles = async () => {
    if (!user) return false

    setIsChecking(true)
    const supabase = createClient()

    try {
      // Verificar si tiene roles activos
      const { data, error } = await supabase
        .from('fcp_miembros')
        .select('id, activo, rol, fcp_id', { count: 'exact' })
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (error) {
        console.error('Error checking roles:', error)
        setIsChecking(false)
        return false
      }

      const roleCount = data?.length || 0

      if (roleCount > 0) {
        console.log(`✅ Usuario ahora tiene ${roleCount} rol(es) asignado(s)`)
        
        // Detener el polling
        if (checkInterval) {
          clearInterval(checkInterval)
          setCheckInterval(null)
        }

        // Redirigir según la cantidad de roles
        if (roleCount === 1) {
          router.push('/dashboard')
        } else {
          router.push('/seleccionar-rol')
        }
        
        return true
      }

      setIsChecking(false)
      return false
    } catch (error) {
      console.error('Error in checkForRoles:', error)
      setIsChecking(false)
      return false
    }
  }

  // Verificación automática cada 10 segundos
  useEffect(() => {
    if (!user) return

    // Verificar inmediatamente al cargar
    checkForRoles()

    // Configurar polling cada 10 segundos
    const interval = setInterval(() => {
      checkForRoles()
    }, 10000) // 10 segundos

    setCheckInterval(interval)

    // Limpiar intervalo al desmontar
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [user])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?logout=true')
  }

  const handleManualCheck = async () => {
    await checkForRoles()
  }

  if (!user) {
    router.push('/login')
    return null
  }

  // Obtener el nombre del usuario para personalizar el mensaje
  const nombreUsuario = usuarioData?.nombre_completo || user.email?.split('@')[0] || 'Usuario'
  const nombreMostrar = usuarioData?.nombre_completo || nombreUsuario

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header con icono grande */}
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-lg animate-pulse">
            <UserX className="h-12 w-12 text-white" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Acceso Pendiente
            </h1>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 border-orange-200 dark:border-orange-800">
              <p className="text-xl text-gray-800 dark:text-gray-200 leading-relaxed">
                <span className="font-semibold text-orange-600 dark:text-orange-400">{nombreMostrar}</span> se registró correctamente, pero{' '}
                <span className="font-semibold text-red-600 dark:text-red-400">no cuenta con un rol asignado</span>.
              </p>
              <p className="text-lg text-gray-700 dark:text-gray-300 mt-3 font-medium">
                Por favor, <span className="text-blue-600 dark:text-blue-400 font-semibold">contáctese con la administración</span> para obtener acceso al sistema.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Verificando automáticamente cada 10 segundos...</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card principal */}
        <Card className="border-2 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6" />
              <div>
                <CardTitle className="text-2xl text-white">
                  Acceso Pendiente
                </CardTitle>
                <CardDescription className="text-blue-100 mt-1">
                  Necesitas un rol asignado para continuar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            {/* Sección de contacto con administración */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-white">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      Contacta con la Administración
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      Para poder navegar y cumplir tus funciones correspondientes, 
                      debes comunicarte con el administrador del sistema para que te asigne un rol.
                    </p>
                  </div>

                  {/* Pasos a seguir */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Pasos a seguir:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center p-0 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                          1
                        </Badge>
                        <p className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">
                          Contacta con el <strong>administrador</strong> o <strong>facilitador</strong> de tu organización
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center p-0 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                          2
                        </Badge>
                        <p className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">
                          Proporciona tu correo electrónico: 
                          <code className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs border border-gray-300 dark:border-gray-600">
                            {user.email}
                          </code>
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center p-0 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                          3
                        </Badge>
                        <div className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">
                          El administrador te asignará el rol correspondiente 
                          <span className="inline-flex gap-1 ml-2">
                            <Badge variant="secondary" className="text-xs">Facilitador</Badge>
                            <Badge variant="secondary" className="text-xs">Director</Badge>
                            <Badge variant="secondary" className="text-xs">Secretario</Badge>
                            <Badge variant="secondary" className="text-xs">Tutor</Badge>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center p-0 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </Badge>
                        <p className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">
                          Una vez asignado el rol, <strong className="text-green-600 dark:text-green-400">serás redirigido automáticamente</strong> a todas las funcionalidades del sistema
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Información de la cuenta */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Información de tu cuenta
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Email:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                </div>
                {usuarioData?.nombre_completo && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Nombre:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{usuarioData.nombre_completo}</p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">ID de usuario:</span>
                  <code className="ml-2 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs border border-gray-300 dark:border-gray-600">
                    {user.id}
                  </code>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t">
              <Button 
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Verificando...' : 'Verificar Ahora'}
              </Button>
              <Button 
                onClick={handleSignOut}
                variant="outline" 
                className="w-full sm:w-auto border-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>

            {/* Footer */}
            <div className="text-center pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Si crees que esto es un error, contacta al soporte técnico del sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
