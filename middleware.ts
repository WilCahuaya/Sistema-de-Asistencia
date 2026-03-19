import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Excluir: _next/static, _next/image, favicon, api, auth/callback, imágenes, y raíz /
     * La raíz / se excluye para evitar timeout 504: la página Home hace el redirect
     */
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback|$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


