/**
 * Utilidad para verificar si un usuario tiene acceso al sistema
 * (tiene al menos una ONG asignada)
 */

import { createClient } from '@/lib/supabase/server'

export interface UserAccessCheck {
  hasAccess: boolean
  ongCount: number
}

/**
 * Verifica si el usuario autenticado tiene al menos una ONG activa asignada
 * 
 * @param userId - ID del usuario (auth.users.id) - opcional, si no se proporciona se obtiene del contexto
 * @returns Objeto con hasAccess y ongCount
 */
export async function checkUserAccess(userId?: string): Promise<UserAccessCheck> {
  try {
    const supabase = await createClient()
    
    // Obtener el usuario del contexto de autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error getting authenticated user:', userError)
      return { hasAccess: false, ongCount: 0 }
    }

    // Usar el userId proporcionado o el del usuario autenticado
    const actualUserId = userId || user.id
    
    console.log('Checking access for user:', actualUserId, 'email:', user.email)

    // Verificar en usuario_ong
    // RLS debería permitir que el usuario vea sus propias membresías (usuario_id = auth.uid())
    // No necesitamos filtrar por usuario_id explícitamente si RLS está funcionando,
    // pero lo hacemos por seguridad adicional
    const { data, error } = await supabase
      .from('usuario_ong')
      .select('id, activo, rol, ong_id', { count: 'exact' })
      .eq('usuario_id', actualUserId)
      .eq('activo', true)

    if (error) {
      console.error('Error checking user access in usuario_ong:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: actualUserId,
      })
      return { hasAccess: false, ongCount: 0 }
    }

    const ongCount = data?.length || 0
    
    // Log para debug
    if (ongCount > 0) {
      console.log(`✅ User ${actualUserId} (${user.email}) has access with ${ongCount} ONG(s)`)
      console.log('ONGs details:', data.map((uo: any) => ({ ong_id: uo.ong_id, rol: uo.rol })))
    } else {
      console.log(`❌ User ${actualUserId} (${user.email}) has NO access - no active ONGs found`)
      console.log('Tip: Verifica que el usuario tenga un registro en usuario_ong con activo=true')
    }

    return {
      hasAccess: ongCount > 0,
      ongCount,
    }
  } catch (error) {
    console.error('Error in checkUserAccess:', error)
    return { hasAccess: false, ongCount: 0 }
  }
}

