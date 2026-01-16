'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Verificar que estamos en el navegador
  if (typeof window === 'undefined') {
    throw new Error(
      'createClient can only be called from client components. ' +
      'Make sure you are using this function inside a client component (marked with "use client") ' +
      'or inside useEffect/event handlers that only run in the browser.'
    )
  }

  // IMPORTANTE: createBrowserClient necesita configuración de cookies para leer
  // el token JWT desde las cookies establecidas por el servidor
  // Sin esto, usará localStorage y no funcionará correctamente con RLS
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') {
            return []
          }
          // Leer todas las cookies del documento
          // Supabase espera un formato específico: { name: string, value: string }[]
          const cookies: Array<{ name: string; value: string }> = []
          const cookieString = document.cookie
          
          if (!cookieString) {
            return []
          }

          cookieString.split(';').forEach((cookie) => {
            const equalIndex = cookie.indexOf('=')
            if (equalIndex === -1) return
            
            const name = cookie.substring(0, equalIndex).trim()
            const value = cookie.substring(equalIndex + 1).trim()
            
            if (name && value) {
              // Decodificar el valor de la cookie
              try {
                cookies.push({ 
                  name, 
                  value: decodeURIComponent(value) 
                })
              } catch {
                // Si falla decodeURIComponent, usar el valor tal cual
                cookies.push({ name, value })
              }
            }
          })
          
          return cookies
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') {
            return
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              // Construir la cadena de cookie
              let cookieString = `${name}=${encodeURIComponent(value)}`
              
              if (options?.path) {
                cookieString += `; Path=${options.path}`
              } else {
                cookieString += `; Path=/`
              }
              
              if (options?.maxAge) {
                cookieString += `; Max-Age=${options.maxAge}`
              } else if (options?.expires) {
                cookieString += `; Expires=${options.expires.toUTCString()}`
              }
              
              if (options?.sameSite) {
                cookieString += `; SameSite=${options.sameSite}`
              } else {
                cookieString += `; SameSite=Lax`
              }
              
              if (options?.secure) {
                cookieString += `; Secure`
              }
              
              // httpOnly no se puede establecer desde JavaScript
              // debe establecerse desde el servidor
              
              document.cookie = cookieString
            } catch (error) {
              console.error('Error setting cookie:', name, error)
            }
          })
        },
      },
    }
  )
}
