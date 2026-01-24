'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

export function RoleLogger() {
  const pathname = usePathname()
  const { selectedRole, loading } = useSelectedRole()

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return

    const logRole = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          logger.navigation('[RoleLogger] Usuario no autenticado en:', pathname)
          return
        }

        if (loading) {
          logger.navigation('[RoleLogger] Cargando rol... en:', pathname)
          return
        }

        logger.navigation('[RoleLogger] Navegación detectada:', {
          ruta: pathname,
          usuario: user.email,
          userId: user.id,
          rolSeleccionado: selectedRole?.role || 'N/A',
          roleId: selectedRole?.roleId || 'N/A',
          fcpId: selectedRole?.fcpId || 'N/A',
          fcpNombre: selectedRole?.fcp?.razon_social || 'N/A',
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        logger.error('❌ [RoleLogger] Error al obtener información del rol:', error)
      }
    }

    logRole()
  }, [pathname, selectedRole, loading])

  // Este componente no renderiza nada
  return null
}

