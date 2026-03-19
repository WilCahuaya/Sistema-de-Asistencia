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
    // Si ya tenemos userId (desde middleware), no llamar getUser() de nuevo
    let actualUserId = userId
    if (!actualUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error getting authenticated user:', userError)
        return { hasAccess: false, roleCount: 0 }
      }
      actualUserId = user.id
    }

    let roleCount = 0

    // Ejecutar RPC y consulta de miembros en paralelo para reducir latencia
    const [facilitadorResult, miembrosResult] = await Promise.all([
      supabase.rpc('es_facilitador', { p_usuario_id: actualUserId }),
      supabase
        .from('fcp_miembros')
        .select('id, activo, rol, fcp_id')
        .eq('usuario_id', actualUserId)
        .eq('activo', true)
        .not('fcp_id', 'is', null),
    ])

    const isFacilitador = facilitadorResult.data
    if (isFacilitador) {
      const { count } = await supabase
        .from('fcps')
        .select('id', { count: 'exact', head: true })
        .eq('facilitador_id', actualUserId)
        .eq('activa', true)
      roleCount += count ?? 0
      if (roleCount === 0) roleCount = 1
    }

    if (!miembrosResult.error && miembrosResult.data) {
      roleCount += miembrosResult.data.length
    }

    const hasAccess = roleCount > 0
    return { hasAccess, roleCount }
  } catch (error) {
    console.error('Error in checkUserAccess:', error)
    return { hasAccess: false, roleCount: 0 }
  }
}
