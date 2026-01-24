/**
 * Utilidad para obtener el rol del usuario y determinar la redirección del dashboard
 */

import { createClient } from '@/lib/supabase/server'
import { getUserHighestRoleFromDB } from './get-user-highest-role'

export type UserRole = 'facilitador' | 'director' | 'secretario' | 'tutor' | null

export interface UserRoleInfo {
  role: UserRole
  hasRole: boolean
}

/**
 * Obtiene el rol del usuario autenticado
 * Si el usuario tiene múltiples roles, retorna el de mayor jerarquía
 * Jerarquía: facilitador (4) > director (3) > secretario (2) > tutor (1)
 * 
 * Esta función usa la lógica centralizada de getUserHighestRoleFromDB para asegurar consistencia
 * 
 * @param userId - ID del usuario (auth.users.id) - opcional, si no se proporciona se obtiene del contexto
 * @returns Objeto con role y hasRole
 */
export async function getUserRole(userId?: string): Promise<UserRoleInfo> {
  try {
    const supabase = await createClient()
    
    // Usar la función centralizada para obtener el rol de mayor jerarquía
    const roleFlags = await getUserHighestRoleFromDB(supabase, userId)
    
    return {
      role: roleFlags.highestRole,
      hasRole: roleFlags.highestRole !== null,
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

