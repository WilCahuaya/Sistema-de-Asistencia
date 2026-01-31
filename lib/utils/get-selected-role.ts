/**
 * Utilidad para obtener el rol seleccionado desde cookies (server-side)
 * El rol seleccionado se guarda en cookies después de ser seleccionado en la página de selección
 */

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { type RolType } from './roles'

export interface SelectedRoleInfo {
  roleId: string
  role: RolType
  fcpId: string | null
  fcp?: {
    id: string
    razon_social: string
    numero_identificacion?: string
  }
}

/**
 * Obtiene el rol seleccionado desde cookies y verifica que todavía sea válido
 */
export async function getSelectedRoleFromCookies(userId: string): Promise<SelectedRoleInfo | null> {
  try {
    const cookieStore = await cookies()
    const selectedRoleId = cookieStore.get('selectedRoleId')?.value
    const selectedRole = cookieStore.get('selectedRole')?.value as RolType | null
    const selectedFcpId = cookieStore.get('selectedFcpId')?.value || null

    console.log('🔍 getSelectedRoleFromCookies - Cookies leídas:', {
      selectedRoleId,
      selectedRole,
      selectedFcpId,
      userId
    })

    if (!selectedRoleId || !selectedRole) {
      console.log('🔍 getSelectedRoleFromCookies - No hay cookies de rol seleccionado')
      return null
    }

    const supabase = await createClient()

    if (selectedRole === 'facilitador' && (selectedRoleId.startsWith('facilitador-') || selectedRoleId === 'facilitador-sistema')) {
      const { data: facRow } = await supabase
        .from('facilitadores')
        .select('usuario_id')
        .eq('usuario_id', userId)
        .maybeSingle()
      if (!facRow) return null
      const fcpIdVal = selectedFcpId || (selectedRoleId !== 'facilitador-sistema' && selectedRoleId.startsWith('facilitador-') ? selectedRoleId.replace(/^facilitador-/, '') : null)
      let fcp: { id: string; razon_social: string; numero_identificacion?: string } | undefined
      if (fcpIdVal) {
        const { data: fcpRow } = await supabase
          .from('fcps')
          .select('id, razon_social, numero_identificacion')
          .eq('id', fcpIdVal)
          .eq('facilitador_id', userId)
          .eq('activa', true)
          .maybeSingle()
        if (!fcpRow) return null
        fcp = { id: fcpRow.id, razon_social: fcpRow.razon_social ?? '', numero_identificacion: fcpRow.numero_identificacion ?? undefined }
      } else {
        fcp = { id: '', razon_social: 'Facilitador', numero_identificacion: undefined }
      }
      return {
        roleId: selectedRoleId,
        role: 'facilitador' as RolType,
        fcpId: fcpIdVal || null,
        fcp,
      }
    }

    const { data: roleData, error } = await supabase
      .from('fcp_miembros')
      .select(`
        id,
        rol,
        fcp_id,
        activo,
        fcp:fcps(
          id,
          razon_social,
          numero_identificacion
        )
      `)
      .eq('id', selectedRoleId)
      .eq('usuario_id', userId)
      .eq('activo', true)
      .maybeSingle()

    if (error) {
      console.error('🔍 getSelectedRoleFromCookies - Error verificando rol:', error)
      return null
    }

    if (!roleData || !roleData.activo) {
      console.log('🔍 getSelectedRoleFromCookies - Rol no encontrado o inactivo:', {
        roleId: selectedRoleId,
        found: !!roleData,
        activo: roleData?.activo
      })
      return null
    }

    console.log('🔍 getSelectedRoleFromCookies - Rol encontrado y válido:', {
      roleId: roleData.id,
      role: roleData.rol,
      fcpId: roleData.fcp_id
    })

    return {
      roleId: roleData.id,
      role: roleData.rol as RolType,
      fcpId: roleData.fcp_id,
      fcp: roleData.fcp || undefined
    }
  } catch (error) {
    console.error('Error getting selected role from cookies:', error)
    return null
  }
}

/**
 * Obtiene el rol seleccionado o el rol de mayor jerarquía como fallback
 * IMPORTANTE: Solo usa el fallback si NO hay cookies de rol seleccionado
 * 
 * NOTA: Esta función NO debe usarse cuando el usuario viene de la página de selección de roles.
 * En ese caso, siempre debe haber cookies con el rol seleccionado.
 */
export async function getSelectedRoleOrHighest(userId: string): Promise<SelectedRoleInfo | null> {
  // Primero intentar obtener el rol desde cookies
  const selectedRole = await getSelectedRoleFromCookies(userId)
  
  if (selectedRole) {
    console.log('✅ getSelectedRoleOrHighest - Usando rol seleccionado desde cookies:', {
      roleId: selectedRole.roleId,
      role: selectedRole.role,
      fcpId: selectedRole.fcpId
    })
    return selectedRole
  }

  console.warn('⚠️ getSelectedRoleOrHighest - No hay rol en cookies, usando fallback de mayor jerarquía. Esto no debería pasar si el usuario viene de /seleccionar-rol')

  const supabase = await createClient()

  // Facilitador global (tabla facilitadores): puede no tener FCPs aún
  const { data: facRow } = await supabase
    .from('facilitadores')
    .select('usuario_id')
    .eq('usuario_id', userId)
    .maybeSingle()
  if (facRow) {
    console.log('🔍 getSelectedRoleOrHighest - Usando rol facilitador (sin FCPs asignadas aún)')
    return {
      roleId: 'facilitador-sistema',
      role: 'facilitador' as RolType,
      fcpId: null,
      fcp: { id: '', razon_social: 'Facilitador', numero_identificacion: undefined }
    }
  }

  // Roles en fcp_miembros
  const { data: allRolesData, error } = await supabase
    .from('fcp_miembros')
    .select(`
      id,
      rol,
      fcp_id,
      fcp:fcps(
        id,
        razon_social,
        numero_identificacion
      )
    `)
    .eq('usuario_id', userId)
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (error || !allRolesData || allRolesData.length === 0) {
    console.log('🔍 getSelectedRoleOrHighest - No se encontraron roles activos')
    return null
  }

  // Si solo tiene un rol, usarlo
  if (allRolesData.length === 1) {
    const singleRole = allRolesData[0]
    console.log('🔍 getSelectedRoleOrHighest - Usando único rol disponible:', {
      roleId: singleRole.id,
      role: singleRole.rol,
      fcpId: singleRole.fcp_id
    })
    return {
      roleId: singleRole.id,
      role: singleRole.rol as RolType,
      fcpId: singleRole.fcp_id,
      fcp: singleRole.fcp || undefined
    }
  }

  // Si tiene múltiples roles, usar el de mayor jerarquía
  // PERO: Si el usuario viene de /seleccionar-rol, esto NO debería pasar
  // porque siempre debería haber cookies con el rol seleccionado
  const { getHighestPriorityRole } = await import('./roles')
  const roles = allRolesData.map(r => r.rol) as RolType[]
  const highestRole = getHighestPriorityRole(roles)
  const highestRoleData = allRolesData.find(r => r.rol === highestRole)

  if (highestRoleData) {
    console.warn('⚠️ getSelectedRoleOrHighest - Usando rol de mayor jerarquía como fallback (esto no debería pasar si el usuario viene de /seleccionar-rol):', {
      roleId: highestRoleData.id,
      role: highestRoleData.rol,
      fcpId: highestRoleData.fcp_id,
      allRoles: roles,
      highestRole,
      'ADVERTENCIA': 'Si el usuario seleccionó un rol específico, debería estar en las cookies. Verificar que las cookies se establezcan correctamente.'
    })
    return {
      roleId: highestRoleData.id,
      role: highestRoleData.rol as RolType,
      fcpId: highestRoleData.fcp_id,
      fcp: highestRoleData.fcp || undefined
    }
  }

  return null
}

