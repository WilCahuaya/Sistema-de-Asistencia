import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkUserAccess } from '@/lib/utils/check-user-access'
import { getUserRole } from '@/lib/utils/get-user-role'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Permitir acceso a rutas de autenticación y páginas públicas sin redirigir
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || 
                      request.nextUrl.pathname.startsWith('/auth') ||
                      request.nextUrl.pathname.startsWith('/seleccionar-rol')
  const isPublicRoute = request.nextUrl.pathname.startsWith('/terminos') ||
                        request.nextUrl.pathname.startsWith('/privacidad')
  
  // No redirigir si es la ruta de callback (necesita procesar el código) o ruta pública
  if (!user && !isAuthRoute && !isPublicRoute) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si el usuario está autenticado y está en /login, verificar acceso y redirigir
  // EXCEPTO si hay un parámetro logout=true (indicando que estamos cerrando sesión)
  const isLogout = request.nextUrl.searchParams.get('logout') === 'true'
  if (user && request.nextUrl.pathname.startsWith('/login') && !isLogout) {
    // Verificar si el usuario tiene acceso (tiene al menos un rol asignado)
    const accessCheck = await checkUserAccess(user.id)
    const url = request.nextUrl.clone()
    
    if (accessCheck.hasAccess) {
      // Si tiene múltiples roles, redirigir a selección; si uno solo, al dashboard
      url.pathname = accessCheck.roleCount > 1 ? '/seleccionar-rol' : '/dashboard'
    } else {
      // Sin rol → /pendiente
      url.pathname = '/pendiente'
    }
    return NextResponse.redirect(url)
  }

  // Si el usuario está autenticado y accede a rutas del dashboard, verificar que tenga roles
  // EXCEPTO la ruta /pendiente que debe ser accesible
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isPendienteRoute = request.nextUrl.pathname.startsWith('/pendiente')
  if (user && isDashboardRoute && !isPendienteRoute) {
    const accessCheck = await checkUserAccess(user.id)
    if (!accessCheck.hasAccess) {
      const url = request.nextUrl.clone()
      url.pathname = '/pendiente'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse
}


