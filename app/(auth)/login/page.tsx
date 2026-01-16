'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Crear cliente dentro de useEffect para asegurar que solo se ejecute en el cliente
    const supabase = createClient()

    // Verificar si hay un error en la URL
    const errorParam = searchParams.get('error')
    const messageParam = searchParams.get('message')
    if (errorParam) {
      const errorMessage = messageParam 
        ? decodeURIComponent(messageParam)
        : 'Error al autenticarse. Por favor, intenta nuevamente.'
      setError(errorMessage)
    }

    // Verificar si el usuario ya está autenticado
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push('/dashboard')
      }
    })
  }, [router, searchParams])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      // Crear cliente dentro de la función para asegurar que solo se ejecute en el cliente
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
      // Si no hay error, el usuario será redirigido automáticamente
      // No necesitamos hacer nada más aquí
    } catch (error) {
      console.error('Error inesperado:', error)
      alert('Error inesperado al iniciar sesión')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Sistema de Asistencias
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Inicia sesión con tu cuenta de Google
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="mt-8">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              'Iniciando sesión...'
            ) : (
              <>
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Iniciar sesión con Google
              </>
            )}
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Al iniciar sesión, aceptas nuestros términos y condiciones
        </p>
      </div>
    </div>
  )
}

