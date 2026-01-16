'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Crear cliente dentro de useEffect para asegurar que solo se ejecute en el cliente
    let mounted = true
    const supabase = createClient()

    // Obtener usuario inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) {
        setUser(user)
        setLoading(false)
      }
    })

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      // Limpiar estado local primero
      setUser(null)

      // Crear cliente para signOut
      const supabase = createClient()

      // Cerrar sesión en el cliente (esto limpia las cookies de Supabase)
      const { error: clientError } = await supabase.auth.signOut({ scope: 'global' })
      
      if (clientError) {
        console.error('Error signing out on client:', clientError)
      }

      // También cerrar sesión en el servidor para asegurar limpieza completa
      try {
        await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (apiError) {
        console.error('Error signing out on server:', apiError)
        // Continuar con la redirección aunque haya error
      }

      // Esperar un momento para asegurar que las cookies se limpien completamente
      // y que el servidor procese el signOut
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Usar window.location.replace para forzar recarga completa sin historial
      // y agregar un parámetro para evitar que el middleware redirija de vuelta
      window.location.replace('/login?logout=true')
    } catch (error) {
      console.error('Error during sign out:', error)
      // Forzar redirección incluso si hay error
      setUser(null)
      window.location.replace('/login?logout=true')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

