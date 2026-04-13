'use client'

import { ReactNode } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import type { RolType } from '@/hooks/useUserRole'

interface RoleGuardProps {
  fcpId: string | null
  allowedRoles: RolType[]
  fallback?: ReactNode
  children: ReactNode
  /**
   * Si es true (por defecto), cuenta los roles reales en `fcp_miembros` para esta FCP,
   * no solo el rol elegido en el menú. Así un usuario secretario+tutor sigue viendo
   * acciones de director/secretario aunque tenga seleccionado «tutor».
   * Desactiva solo si necesitas depender exclusivamente del rol mostrado.
   */
  matchMembership?: boolean
}

/**
 * Componente que protege elementos UI basándose en el rol del usuario
 * Solo muestra los children si el usuario tiene uno de los roles permitidos
 * 
 * @param fcpId - ID de la FCP
 * @param allowedRoles - Array de roles permitidos
 * @param fallback - Contenido a mostrar si el usuario no tiene permisos (opcional)
 * @param children - Contenido a mostrar si el usuario tiene permisos
 * 
 * @example
 * <RoleGuard fcpId={selectedFCP} allowedRoles={['facilitador', 'secretario']}>
 *   <Button>Acción restringida</Button>
 * </RoleGuard>
 * 
 * @example
 * <RoleGuard 
 *   fcpId={selectedFCP} 
 *   allowedRoles={['facilitador']}
 *   fallback={<p>No tienes permisos para esta acción</p>}
 * >
 *   <Button>Solo para facilitadores</Button>
 * </RoleGuard>
 */
export function RoleGuard({ 
  fcpId, 
  allowedRoles, 
  fallback = null, 
  children,
  matchMembership = true,
}: RoleGuardProps) {
  const { role, loading, rolesInFcp, membershipsLoading } = useUserRole(fcpId)

  if (loading) {
    return null
  }

  if (fcpId && matchMembership && membershipsLoading) {
    return null
  }

  const bySelectedRole = role !== null && allowedRoles.includes(role)
  const byMembership =
    matchMembership &&
    rolesInFcp.some((r) => r !== null && allowedRoles.includes(r))

  if (!bySelectedRole && !byMembership) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

