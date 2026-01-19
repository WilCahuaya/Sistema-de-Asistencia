import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/layout/DashboardNav'

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

  // Intentar verificar roles, pero SIEMPRE manejar errores gracefully
  // Esto permite que la página pendiente se renderice incluso si hay recursión
  let rolesData: any[] | null = null
  let hasError = false
  
  try {
    const { data, error } = await supabase
      .from('fcp_miembros')
      .select('id, activo, rol, fcp_id')
      .eq('usuario_id', user.id)
      .eq('activo', true)
      .limit(1)
    
    if (error) {
      // Si hay error (como recursión infinita), asumir que no tiene roles
      // Esto permite que la página pendiente se renderice
      console.warn('Error checking roles in layout (may be RLS recursion):', error.message)
      rolesData = []
      hasError = true
    } else {
      rolesData = data || []
    }
  } catch (error: any) {
    // Manejar cualquier otro error - SIEMPRE permitir renderizado
    console.warn('Exception checking roles in layout:', error?.message)
    rolesData = []
    hasError = true
  }

  // El layout principal NO debe redirigir aquí
  // La verificación de roles y redirección se maneja en:
  // 1. El middleware (lib/supabase/middleware.ts)
  // 2. Las páginas individuales (como dashboard/page.tsx)
  // Esto permite que /pendiente se renderice correctamente
  // Incluso si hay errores de RLS, siempre renderizamos el layout

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Solo mostrar navegación si el usuario tiene rol Y no hay error */}
      {/* Si hay error, no mostramos navegación para evitar problemas */}
      {!hasError && rolesData && rolesData.length > 0 && <DashboardNav />}
      <main>{children}</main>
    </div>
  )
}

