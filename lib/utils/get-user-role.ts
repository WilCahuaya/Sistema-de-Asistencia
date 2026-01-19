/**
 * Utilidad para obtener el rol del usuario y determinar la redirección del dashboard
 */

import { createClient } from '@/lib/supabase/server'

export type UserRole = 'facilitador' | 'director' | 'secretario' | 'tutor' | null

export interface UserRoleInfo {
  role: UserRole
  hasRole: boolean
}

/**
 * Obtiene el rol del usuario autenticado
 * 
 * @param userId - ID del usuario (auth.users.id) - opcional, si no se proporciona se obtiene del contexto
 * @returns Objeto con role y hasRole
 */
export async function getUserRole(userId?: string): Promise<UserRoleInfo> {
  try {
    const supabase = await createClient()
    
    // Obtener el usuario del contexto de autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error getting authenticated user:', userError)
      return { role: null, hasRole: false }
    }

    // Usar el userId proporcionado o el del usuario autenticado
    const actualUserId = userId || user.id
    
    // Obtener el primer rol activo del usuario
    const { data, error } = await supabase
      .from('fcp_miembros')
      .select('rol')
      .eq('usuario_id', actualUserId)
      .eq('activo', true)
      .limit(1)

    if (error) {
      console.error('Error getting user role:', error)
      return { role: null, hasRole: false }
    }

    if (!data || data.length === 0) {
      return { role: null, hasRole: false }
    }

    const role = data[0].rol as UserRole
    return {
      role,
      hasRole: true,
    }
  } catch (error) {
    console.error('Error in getUserRole:', error)
    return { role: null, hasRole: false }
  }
}

/**
 * Obtiene la ruta del dashboard según el rol del usuario
 * 
 * @param userId - ID del usuario (opcional)
 * @returns Ruta del dashboard o null si no tiene rol
 */
export async function getDashboardRoute(userId?: string): Promise<string | null> {
  const roleInfo = await getUserRole(userId)
  
  if (!roleInfo.hasRole) {
    return '/pendiente'
  }

  // Todos los roles van al mismo dashboard, pero el contenido se adapta según el rol
  // Facilitador → Dashboard Facilitador (solo reportes mensuales y perfil)
  // Director/Secretario → Dashboard completo
  // Tutor → Vista limitada
  return '/dashboard'
}

