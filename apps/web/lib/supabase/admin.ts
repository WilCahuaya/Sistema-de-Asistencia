import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con service role: solo servidor. Usar para auth.admin tras validar permisos.
 * Retorna null si falta SUPABASE_SERVICE_ROLE_KEY.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
