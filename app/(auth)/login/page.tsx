'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GraduationCap, Sparkles, Shield, Zap, TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
        alert('Error al iniciar sesión: ' + error.message)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error inesperado:', error)
      alert('Error inesperado al iniciar sesión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-400/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-fuchsia-400/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        
        {/* Animated gradient mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)] animate-pulse"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left side - Branding */}
          <div className="hidden lg:flex flex-col space-y-8 text-white">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 shadow-xl">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <GraduationCap className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Sistema de Asistencias</h1>
                  <p className="text-white/80 text-sm">Gestión inteligente</p>
                </div>
              </div>
              
              <h2 className="text-5xl font-bold leading-tight">
                Transforma la gestión
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-pink-200 to-cyan-200">
                  educativa
                </span>
              </h2>
              <p className="text-xl text-white/90 leading-relaxed">
                Plataforma completa para gestionar asistencias estudiantiles con reportes automáticos y exportación a Excel y PDF.
          </p>
        </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/15 transition-all duration-300">
                <Zap className="h-6 w-6 mb-2 text-yellow-300" />
                <h3 className="font-semibold mb-1">Registro Rápido</h3>
                <p className="text-sm text-white/70">Registra asistencias en segundos con interfaz intuitiva</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/15 transition-all duration-300">
                <Shield className="h-6 w-6 mb-2 text-green-300" />
                <h3 className="font-semibold mb-1">100% Seguro</h3>
                <p className="text-sm text-white/70">Autenticación con Google OAuth y Row Level Security</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/15 transition-all duration-300">
                <TrendingUp className="h-6 w-6 mb-2 text-blue-300" />
                <h3 className="font-semibold mb-1">Reportes Automáticos</h3>
                <p className="text-sm text-white/70">Genera reportes en Excel y PDF al instante</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/15 transition-all duration-300">
                <Sparkles className="h-6 w-6 mb-2 text-pink-300" />
                <h3 className="font-semibold mb-1">Multi-FCP</h3>
                <p className="text-sm text-white/70">Gestiona múltiples proyectos desde una sola cuenta</p>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="w-full">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 lg:p-10 shadow-2xl">
              {/* Mobile logo */}
              <div className="lg:hidden text-center mb-8">
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <GraduationCap className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Sistema de Asistencias</h1>
                  </div>
                </div>
              </div>

              {/* Desktop title */}
              <div className="hidden lg:block mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Bienvenido</h2>
                <p className="text-white/80">Inicia sesión para continuar</p>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-6 rounded-xl bg-red-500/20 backdrop-blur-md p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-red-200 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-100">{error}</p>
                  </div>
          </div>
        )}

              {/* Login button */}
              <div className="space-y-6">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
                  className="w-full h-14 text-base font-semibold bg-white hover:bg-white/90 text-purple-600 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] rounded-xl"
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
                  <div className="flex items-center justify-center">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <span className="px-4 text-sm text-white/70">
                      Acceso rápido y seguro
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">100%</div>
                    <div className="text-xs text-white/70 mt-1">Seguro</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">24/7</div>
                    <div className="text-xs text-white/70 mt-1">Disponible</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">∞</div>
                    <div className="text-xs text-white/70 mt-1">Escalable</div>
                  </div>
                </div>

                {/* Terms */}
                <div className="text-center pt-4">
                  <p className="text-xs text-white/60">
                    Al iniciar sesión, aceptas nuestros{' '}
                    <a href="#" className="text-white hover:underline font-medium">Términos</a>
                    {' y '}
                    <a href="#" className="text-white hover:underline font-medium">Privacidad</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

      {/* Animated particles effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
