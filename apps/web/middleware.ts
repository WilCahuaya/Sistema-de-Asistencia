import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Solo ejecutar middleware en auth/callback (OAuth). Evita 504 en resto de rutas.
  // Las páginas manejan auth con createClient; la sesión se lee de cookies.
  matcher: ['/auth/callback'],
}


