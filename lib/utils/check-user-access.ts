/**
 * Utilidad para verificar si un usuario tiene acceso al sistema
 * (tiene al menos un rol asignado en alguna FCP)
 */

import { createClient } from '@/lib/supabase/server'

export interface UserAccessCheck {
  hasAccess: boolean
  roleCount: number
}

/**
 * Verifica si el usuario autenticado tiene al menos un rol activo asignado
 * 
 * @param userId - ID del usuario (auth.users.id) - opcional, si no se proporciona se obtiene del contexto
 * @returns Objeto con hasAccess y roleCount
 */
export async function checkUserAccess(userId?: string): Promise<UserAccessCheck> {
  try {
    const supabase = await createClient()
    
    // Obtener el usuario del contexto de autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error getting authenticated user:', userError)
      return { hasAccess: false, roleCount: 0 }
    }

    // Usar el userId proporcionado o el del usuario autenticado
    const actualUserId = userId || user.id
    
    console.log('Checking access for user:', actualUserId, 'email:', user.email)

    // Verificar en fcp_miembros si tiene algún rol activo
    // Esto incluye facilitadores del sistema (fcp_id IS NULL) y otros roles
    // RLS debería permitir que el usuario vea sus propias membresías (usuario_id = auth.uid())
    const { data, error } = await supabase
      .from('fcp_miembros')
      .select('id, activo, rol, fcp_id', { count: 'exact' })
      .eq('usuario_id', actualUserId)
      .eq('activo', true)

    if (error) {
      console.error('Error checking user access in fcp_miembros:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: actualUserId,
      })
      return { hasAccess: false, roleCount: 0 }
    }

    const roleCount = data?.length || 0
    
    // Log para debug
    if (roleCount > 0) {
      console.log(`✅ User ${actualUserId} (${user.email}) has access with ${roleCount} role(s)`)
      console.log('Roles details:', data.map((fm: any) => ({ fcp_id: fm.fcp_id, rol: fm.rol })))
    } else {
      console.log(`❌ User ${actualUserId} (${user.email}) has NO access - no active roles found`)
      console.log('Tip: Verifica que el usuario tenga un registro en fcp_miembros con activo=true y un rol asignado')
    }

    return {
      hasAccess: roleCount > 0,
      roleCount,
    }
  } catch (error) {
    console.error('Error in checkUserAccess:', error)
    return { hasAccess: false, roleCount: 0 }
  }
}

