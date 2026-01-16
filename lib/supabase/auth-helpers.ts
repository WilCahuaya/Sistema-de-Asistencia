import { createClient } from './client'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Refresca la sesión de Supabase y verifica que el usuario esté autenticado.
 * Si la sesión está expirada, intenta refrescarla usando el refresh token.
 * 
 * @returns El usuario autenticado o null si no hay sesión válida
 */
export async function ensureAuthenticated(): Promise<{
  user: any
  supabase: SupabaseClient
} | null> {
  const supabase = createClient()

  try {
    // Primero obtener la sesión actual para ver si existe
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Error getting session:', sessionError)
      return null
    }

    // Si hay una sesión, intentar refrescarla si es necesario
    if (currentSession) {
      // Verificar si la sesión está próxima a expirar (menos de 5 minutos)
      const expiresAt = currentSession.expires_at
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt ? expiresAt - now : 0

      // Si la sesión está próxima a expirar o ya expiró, intentar refrescarla
      if (timeUntilExpiry < 300) { // 5 minutos
        console.log('Session expiring soon, attempting refresh...')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          console.error('Error refreshing session:', refreshError)
          // Continuar con la sesión actual si el refresh falla
        } else if (refreshedSession?.user) {
          console.log('Session refreshed successfully')
          return { user: refreshedSession.user, supabase }
        }
      }

      // Si hay sesión y usuario, retornar
      if (currentSession.user) {
        console.log('Using existing session')
        return { user: currentSession.user, supabase }
      }
    }

    // Si no hay sesión, intentar obtener el usuario directamente (puede que las cookies tengan la info)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('Error getting user:', userError)
      console.error('User error details:', {
        message: userError.message,
        status: userError.status,
        name: userError.name,
      })
      return null
    }

    if (!user) {
      console.error('No user found')
      return null
    }

    console.log('User authenticated successfully:', user.id)
    return { user, supabase }
  } catch (error: any) {
    console.error('Error ensuring authentication:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    })
    return null
  }
}

