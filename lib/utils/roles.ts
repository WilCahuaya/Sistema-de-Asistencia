/**
 * Utilidades para manejo de roles
 */

export type RolType = 'facilitador' | 'secretario' | 'tutor'
export type RolDisplayName = 'Facilitador' | 'Secretario' | 'Tutor'

/**
 * Mapea el rol interno (BD) al nombre de display (UI)
 */
export function getRolDisplayName(rol: RolType | null): RolDisplayName | string {
  switch (rol) {
    case 'facilitador':
      return 'Facilitador'
    case 'secretario':
      return 'Secretario'
    case 'tutor':
      return 'Tutor'
    default:
      return 'Sin rol'
  }
}

/**
 * Mapea el nombre de display (UI) al rol interno (BD)
 */
export function getRolFromDisplayName(displayName: string): RolType | null {
  switch (displayName.toLowerCase()) {
    case 'facilitador':
      return 'facilitador'
    case 'secretario':
      return 'secretario'
    case 'tutor':
      return 'tutor'
    default:
      return null
  }
}

/**
 * Obtiene el color del badge según el rol
 */
export function getRolBadgeColor(rol: RolType | null): string {
  switch (rol) {
    case 'facilitador':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    case 'secretario':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'tutor':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

/**
 * Verifica si un rol tiene permisos de edición
 */
export function canEdit(rol: RolType | null): boolean {
  return rol === 'facilitador' || rol === 'secretario'
}

/**
 * Verifica si un rol puede ver reportes
 */
export function canViewReports(rol: RolType | null): boolean {
  return rol === 'facilitador' || rol === 'secretario'
}

/**
 * Verifica si un rol puede gestionar miembros
 */
export function canManageMembers(rol: RolType | null): boolean {
  return rol === 'facilitador'
}

