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

  // createBrowserClient de @supabase/ssr maneja automáticamente las cookies del navegador
  // Lee las cookies establecidas por el servidor y las usa para autenticación
  // No necesitamos configurar manualmente las cookies - @supabase/ssr lo hace automáticamente
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
