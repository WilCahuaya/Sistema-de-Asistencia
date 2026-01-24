import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getUserRole } from '@/lib/utils/get-user-role'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const origin = requestUrl.origin

  // Si hay un error de OAuth (usuario canceló, flow expiró, etc.)
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/login?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`)
  }

  // Si no hay código, redirigir a login con error
  if (!code) {
    console.error('No code parameter in callback URL')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  try {
    const cookieStore = await cookies()
    
    // Crear respuesta temporal para capturar las cookies que Supabase establece
    let response = NextResponse.next({ request })

    // Crear cliente de Supabase con manejo correcto de cookies
    // Las cookies se establecerán tanto en cookieStore como en la respuesta HTTP
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // Establecer en cookieStore (para uso del servidor)
                cookieStore.set(name, value, options)
                // También establecer en la respuesta HTTP para que el navegador las reciba
                response.cookies.set(name, value, {
                  sameSite: options?.sameSite || 'lax',
                  path: options?.path || '/',
                  maxAge: options?.maxAge,
                  expires: options?.expires,
                  secure: options?.secure !== undefined ? options.secure : process.env.NODE_ENV === 'production',
                  httpOnly: options?.httpOnly || false,
                })
              })
              console.log('Cookies set in callback:', cookiesToSet.map(c => c.name))
            } catch (error) {
              console.error('Error setting cookies in callback:', error)
            }
          },
        },
      }
    )

    // Intercambiar código por sesión
    // Esto establecerá las cookies de autenticación
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`)
    }

    // Verificar que el usuario se autenticó correctamente
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()
    
    if (getUserError || !user) {
      console.error('Error getting user after auth:', getUserError)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    console.log('User authenticated successfully:', user.email)
    console.log('Cookies in response:', response.cookies.getAll().map(c => c.name))

    // Verificar si el usuario tiene algún rol asignado
    const roleInfo = await getUserRole(user.id)
    
    if (!roleInfo.hasRole) {
      // Si no tiene roles, redirigir a pendiente
      const redirectResponse = NextResponse.redirect(`${origin}/pendiente`)
      response.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: false,
        })
      })
      return redirectResponse
    }

    // Verificar cuántos roles tiene el usuario
    const { data: rolesData } = await supabase
      .from('fcp_miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('activo', true)

    // Si tiene múltiples roles, redirigir a la página de selección
    // Si solo tiene un rol, redirigir directamente al dashboard
    const redirectPath = (rolesData && rolesData.length > 1) ? '/seleccionar-rol' : '/dashboard'

    // Crear respuesta de redirección con las cookies establecidas
    const redirectResponse = NextResponse.redirect(`${origin}${redirectPath}`)
    
    // Copiar todas las cookies de la respuesta temporal a la respuesta de redirección
    // Esto asegura que el navegador reciba las cookies de autenticación
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false, // Las cookies de Supabase no deben ser httpOnly para que el cliente pueda leerlas
      })
    })

    console.log('Redirecting with cookies:', redirectResponse.cookies.getAll().map(c => c.name))
    console.log('User has roles:', roleInfo.hasRole ? 'Yes' : 'No')
    console.log('User role:', roleInfo.role || 'None')
    console.log('Redirecting to:', redirectPath)
    return redirectResponse
  } catch (error: any) {
    console.error('Unexpected error in callback:', error)
    return NextResponse.redirect(`${origin}/login?error=unexpected&message=${encodeURIComponent(error.message || 'Unknown error')}`)
  }
}
