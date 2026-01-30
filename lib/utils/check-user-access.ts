/**
 * Utilidad para verificar si un usuario tiene acceso al sistema
 * (facilitador en facilitadores + fcps, o director/secretario/tutor en fcp_miembros)
 */

import { createClient } from '@/lib/supabase/server'

export interface UserAccessCheck {
  hasAccess: boolean
  roleCount: number
}

/**
 * Verifica si el usuario autenticado tiene al menos un rol activo.
 *
 * @param userId - ID del usuario (auth.users.id) - opcional
 * @returns Objeto con hasAccess y roleCount
 */
export async function checkUserAccess(userId?: string): Promise<UserAccessCheck> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Error getting authenticated user:', userError)
      return { hasAccess: false, roleCount: 0 }
    }

    const actualUserId = userId || user.id
    let roleCount = 0

    const { data: facRow } = await supabase
      .from('facilitadores')
      .select('usuario_id')
      .eq('usuario_id', actualUserId)
      .maybeSingle()

    if (facRow) {
      const { count } = await supabase
        .from('fcps')
        .select('id', { count: 'exact', head: true })
        .eq('facilitador_id', actualUserId)
        .eq('activa', true)
      roleCount += count ?? 0
      if (roleCount === 0) roleCount = 1
    }

    const { data: miembros, error } = await supabase
      .from('fcp_miembros')
      .select('id, activo, rol, fcp_id')
      .eq('usuario_id', actualUserId)
      .eq('activo', true)
      .not('fcp_id', 'is', null)

    if (!error && miembros) roleCount += miembros.length

    const hasAccess = roleCount > 0
    return { hasAccess, roleCount }
  } catch (error) {
    console.error('Error in checkUserAccess:', error)
    return { hasAccess: false, roleCount: 0 }
  }
}
