import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/layout/DashboardNav'
import { RoleLogger } from '@/components/debug/RoleLogger'
import { getSelectedRoleOrHighest } from '@/lib/utils/get-selected-role'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar roles: fcp_miembros y/o facilitadores. Manejar errores.
  let rolesData: any[] | null = null
  let isFacilitator = false
  let hasError = false

  try {
    const [miembrosRes, facRes] = await Promise.all([
      supabase
        .from('fcp_miembros')
        .select('id, activo, rol, fcp_id')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .limit(1),
      supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle(),
    ])
    if (miembrosRes.error) {
      console.warn('Error checking roles in layout (may be RLS recursion):', miembrosRes.error.message)
      rolesData = []
      hasError = true
    } else {
      rolesData = miembrosRes.data || []
    }
    if (!facRes.error && facRes.data) isFacilitator = true
  } catch (error: any) {
    console.warn('Exception checking roles in layout:', error?.message)
    rolesData = []
    hasError = true
  }

  const hasAnyRole = (rolesData?.length ?? 0) > 0 || isFacilitator

  if (user && hasAnyRole) {
    try {
      const selectedRoleInfo = await getSelectedRoleOrHighest(user.id)
      console.log('🧭 [DashboardLayout] Navegación detectada:', {
        ruta: 'layout',
        usuario: user.email,
        userId: user.id,
        rolSeleccionado: selectedRoleInfo?.role || 'N/A',
        roleId: selectedRoleInfo?.roleId || 'N/A',
        fcpId: selectedRoleInfo?.fcpId || 'N/A',
        fcpNombre: selectedRoleInfo?.fcp?.razon_social || 'N/A',
        todosLosRoles: rolesData?.map((r: any) => r.rol) ?? [],
        isFacilitator,
      })
    } catch (_) {}
  }

  return (
    <div className="min-h-screen bg-background">
      <RoleLogger />
      {!hasError && hasAnyRole && <DashboardNav />}
      <main>{children}</main>
    </div>
  )
}

