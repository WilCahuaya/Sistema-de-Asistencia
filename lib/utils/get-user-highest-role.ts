/**
 * Función centralizada para obtener el rol de mayor jerarquía del usuario
 * Esta función asegura que siempre se seleccione el rol correcto cuando un usuario tiene múltiples roles
 */

import { getHighestPriorityRole, getRolPriority, type RolType } from './roles'

export interface UserRoleFlags {
  isFacilitador: boolean
  isDirector: boolean
  isSecretario: boolean
  isTutor: boolean
  highestRole: RolType | null
  allRoles: RolType[]
}

/**
 * Determina el rol de mayor jerarquía y los flags correspondientes
 * basándose en un array de roles activos del usuario
 * 
 * @param roles - Array de roles activos del usuario
 * @returns Objeto con flags booleanos y el rol de mayor jerarquía
 */
export function determineUserRoleFlags(roles: RolType[]): UserRoleFlags {
  // Si no hay roles, retornar todos los flags en false
  if (!roles || roles.length === 0) {
    return {
      isFacilitador: false,
      isDirector: false,
      isSecretario: false,
      isTutor: false,
      highestRole: null,
      allRoles: []
    }
  }

  // Obtener roles únicos
  const uniqueRoles = [...new Set(roles)] as RolType[]
  
  // Seleccionar el rol de mayor jerarquía
  const highestRole = getHighestPriorityRole(uniqueRoles)
  
  // Debug: Verificar que getHighestPriorityRole está funcionando correctamente
  if (uniqueRoles.length > 1) {
    const priorities = uniqueRoles.map(r => ({ rol: r, prioridad: getRolPriority(r) }))
    console.log('🔍 Debug getHighestPriorityRole:', {
      roles: uniqueRoles,
      priorities: priorities,
      highestRole: highestRole,
      highestPriority: getRolPriority(highestRole)
    })
  }
  
  // Establecer flags basándose SOLO en el rol de mayor jerarquía
  // Esto asegura que si un usuario tiene Director y Tutor, solo se active isDirector
  const isFacilitador = highestRole === 'facilitador'
  const isDirector = highestRole === 'director'
  const isSecretario = highestRole === 'secretario'
  // IMPORTANTE: isTutor solo debe ser true si el rol de mayor jerarquía es tutor
  // Y no es ningún otro rol de mayor jerarquía
  const isTutor = highestRole === 'tutor' && !isDirector && !isSecretario && !isFacilitador
  
  // Log para debugging cuando hay múltiples roles
  if (uniqueRoles.length > 1) {
    console.log('🔍 Usuario con múltiples roles detectado:', {
      todosLosRoles: uniqueRoles,
      rolSeleccionado: highestRole,
      flags: {
        isFacilitador,
        isDirector,
        isSecretario,
        isTutor
      },
      'Verificación isTutor': {
        'highestRole === tutor': highestRole === 'tutor',
        '!isDirector': !isDirector,
        '!isSecretario': !isSecretario,
        '!isFacilitador': !isFacilitador,
        'resultado final': isTutor
      }
    })
  }
  
  return {
    isFacilitador,
    isDirector,
    isSecretario,
    isTutor,
    highestRole,
    allRoles: uniqueRoles
  }
}

/**
 * Obtiene los roles activos del usuario desde la base de datos y determina el rol de mayor jerarquía
 * Esta función puede ser usada tanto en el servidor como en el cliente
 * 
 * @param supabase - Cliente de Supabase (server o client)
 * @param userId - ID del usuario (opcional, si no se proporciona se obtiene del contexto)
 * @returns Objeto con flags booleanos y el rol de mayor jerarquía
 */
export async function getUserHighestRoleFromDB(
  supabase: any,
  userId?: string
): Promise<UserRoleFlags> {
  try {
    // Obtener el usuario del contexto de autenticación si no se proporciona userId
    let actualUserId = userId
    
    if (!actualUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('Error getting authenticated user:', userError)
        return {
          isFacilitador: false,
          isDirector: false,
          isSecretario: false,
          isTutor: false,
          highestRole: null,
          allRoles: []
        }
      }
      
      actualUserId = user.id
    }
    
    // Facilitador solo desde BD (tabla facilitadores). Mayor jerarquía.
    const { data: facilitadorRow } = await supabase
      .from('facilitadores')
      .select('usuario_id')
      .eq('usuario_id', actualUserId)
      .maybeSingle()

    if (facilitadorRow) {
      return {
        isFacilitador: true,
        isDirector: false,
        isSecretario: false,
        isTutor: false,
        highestRole: 'facilitador',
        allRoles: ['facilitador']
      }
    }

    // Obtener todos los roles activos del usuario en fcp_miembros (director, secretario, tutor)
    const { data, error } = await supabase
      .from('fcp_miembros')
      .select('rol')
      .eq('usuario_id', actualUserId)
      .eq('activo', true)

    if (error) {
      console.error('Error getting user roles:', error)
      return {
        isFacilitador: false,
        isDirector: false,
        isSecretario: false,
        isTutor: false,
        highestRole: null,
        allRoles: []
      }
    }

    if (!data || data.length === 0) {
      return {
        isFacilitador: false,
        isDirector: false,
        isSecretario: false,
        isTutor: false,
        highestRole: null,
        allRoles: []
      }
    }

    // Obtener todos los roles únicos
    const roles = [...new Set(data.map(item => item.rol))] as RolType[]
    
    // Debug: Log antes de determinar los flags
    console.log('🔍 getUserHighestRoleFromDB - Roles obtenidos de BD:', {
      userId: actualUserId,
      rolesFromDB: data.map(item => item.rol),
      uniqueRoles: roles,
      rolesCount: roles.length
    })
    
    // Usar la función centralizada para determinar los flags
    const result = determineUserRoleFlags(roles)
    
    // Debug: Log después de determinar los flags
    if (roles.length > 1) {
      console.log('🔍 getUserHighestRoleFromDB - Resultado final:', {
        allRoles: result.allRoles,
        highestRole: result.highestRole,
        flags: {
          isFacilitador: result.isFacilitador,
          isDirector: result.isDirector,
          isSecretario: result.isSecretario,
          isTutor: result.isTutor
        }
      })
    }
    
    return result
  } catch (error) {
    console.error('Error in getUserHighestRoleFromDB:', error)
    return {
      isFacilitador: false,
      isDirector: false,
      isSecretario: false,
      isTutor: false,
      highestRole: null,
      allRoles: []
    }
  }
}

