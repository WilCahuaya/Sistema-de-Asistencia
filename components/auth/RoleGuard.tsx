'use client'

import { ReactNode } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import type { RolType } from '@/hooks/useUserRole'

interface RoleGuardProps {
  ongId: string | null
  allowedRoles: RolType[]
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Componente que protege elementos UI basándose en el rol del usuario
 * Solo muestra los children si el usuario tiene uno de los roles permitidos
 * 
 * @param ongId - ID de la ONG
 * @param allowedRoles - Array de roles permitidos
 * @param fallback - Contenido a mostrar si el usuario no tiene permisos (opcional)
 * @param children - Contenido a mostrar si el usuario tiene permisos
 * 
 * @example
 * <RoleGuard ongId={selectedONG} allowedRoles={['facilitador', 'secretario']}>
 *   <Button>Acción restringida</Button>
 * </RoleGuard>
 * 
 * @example
 * <RoleGuard 
 *   ongId={selectedONG} 
 *   allowedRoles={['facilitador']}
 *   fallback={<p>No tienes permisos para esta acción</p>}
 * >
 *   <Button>Solo para facilitadores</Button>
 * </RoleGuard>
 */
export function RoleGuard({ 
  ongId, 
  allowedRoles, 
  fallback = null, 
  children 
}: RoleGuardProps) {
  const { role, loading } = useUserRole(ongId)

  if (loading) {
    // Mientras carga, no mostrar nada (evita parpadeo)
    return null
  }

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

