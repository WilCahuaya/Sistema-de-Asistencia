'use client'

import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GraduationCap, Shield, TrendingUp, Zap, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Aplicar tema fijo azul profesional al login siempre
    // El script en layout.tsx ya debería haberlo aplicado, pero lo reforzamos aquí
    const htmlElement = document.documentElement
    // Remover todos los temas existentes
    htmlElement.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 
                                 'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple')
    // Aplicar tema azul profesional
    htmlElement.classList.add('theme-blue')
    
    const supabase = createClient()
    const errorParam = searchParams.get('error')
    const messageParam = searchParams.get('message')
    if (errorParam) {
      const errorMessage = messageParam 
        ? decodeURIComponent(messageParam)
        : 'Error al autenticarse. Por favor, intenta nuevamente.'
      setError(errorMessage)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push('/dashboard')
      }
    })
  }, [router, searchParams])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('Error al iniciar sesión:', error)
        toast.error('Error al iniciar sesión', error.message)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error inesperado:', error)
      toast.error('Error inesperado', 'No se pudo iniciar sesión. Intenta nuevamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left side - Branding */}
        <div className="hidden lg:flex flex-col space-y-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <GraduationCap className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Sistema de Asistencias</h1>
                <p className="text-gray-600 text-sm mt-1">Gestión inteligente de asistencias estudiantiles</p>
              </div>
            </div>
            
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
              Plataforma completa para gestionar asistencias estudiantiles con reportes automáticos y exportación a Excel y PDF.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:bg-blue-50 hover:border-blue-200 transition-all">
              <Zap className="h-6 w-6 mb-3 text-blue-600" />
              <h3 className="font-semibold mb-1.5 text-gray-900">Registro Rápido</h3>
              <p className="text-sm text-gray-600">Registra asistencias en segundos con interfaz intuitiva</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:bg-blue-50 hover:border-blue-200 transition-all">
              <Shield className="h-6 w-6 mb-3 text-blue-600" />
              <h3 className="font-semibold mb-1.5 text-gray-900">100% Seguro</h3>
              <p className="text-sm text-gray-600">Autenticación con Google OAuth y Row Level Security</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:bg-blue-50 hover:border-blue-200 transition-all">
              <TrendingUp className="h-6 w-6 mb-3 text-blue-600" />
              <h3 className="font-semibold mb-1.5 text-gray-900">Reportes Automáticos</h3>
              <p className="text-sm text-gray-600">Genera reportes en Excel y PDF al instante</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:bg-blue-50 hover:border-blue-200 transition-all">
              <Sparkles className="h-6 w-6 mb-3 text-blue-600" />
              <h3 className="font-semibold mb-1.5 text-gray-900">Multi-FCP</h3>
              <p className="text-sm text-gray-600">Gestiona múltiples proyectos desde una sola cuenta</p>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="w-full">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 md:p-8 lg:p-10 shadow-sm">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <GraduationCap className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Sistema de Asistencias</h1>
                </div>
              </div>
            </div>

            {/* Desktop title */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 sm:text-3xl">Bienvenido</h2>
              <p className="text-gray-600">Inicia sesión para continuar</p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Login button */}
            <div className="space-y-6">
              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Iniciando sesión...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar con Google
                  </span>
                )}
              </Button>

              {/* Divider */}
              <div className="relative py-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-4 text-gray-500">Acceso rápido y seguro</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 sm:text-2xl">100%</div>
                  <div className="text-xs text-gray-600 mt-1">Seguro</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 sm:text-2xl">24/7</div>
                  <div className="text-xs text-gray-600 mt-1">Disponible</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 sm:text-2xl">∞</div>
                  <div className="text-xs text-gray-600 mt-1">Escalable</div>
                </div>
              </div>

              {/* Terms */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Al iniciar sesión, aceptas nuestros{' '}
                  <a href="/terminos" className="text-blue-600 hover:underline font-medium">Términos</a>
                  {' y '}
                  <a href="/privacidad" className="text-blue-600 hover:underline font-medium">Privacidad</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
