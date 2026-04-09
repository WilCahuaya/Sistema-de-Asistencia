import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function NoAutorizadoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si no está autenticado, redirigir al login
  if (!user) {
    redirect('/login')
  }

  // Verificar si el usuario existe en public.usuarios
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', user.id)
    .single()

  // Verificar si el usuario ahora tiene FCPs (por si un administrador le asignó una)
  // Intentar con el ID de auth.users directamente
  const { data: fcps, error: fcpsError } = await supabase
    .from('fcp_miembros')
    .select('id, activo, rol, fcp_id')
    .eq('usuario_id', user.id)
    .eq('activo', true)

  // Si tiene FCPs activas, redirigir al dashboard
  if (fcps && fcps.length > 0) {
    redirect('/dashboard')
  }

  // Debug: obtener todos los registros de fcp_miembros (incluso inactivos) para diagnóstico
  const { data: allUserFCPs } = await supabase
    .from('fcp_miembros')
    .select('id, activo, rol, fcp_id, usuario_id')
    .eq('usuario_id', user.id)

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login?logout=true')
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-8 sm:px-6 sm:py-16 lg:px-8">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Acceso No Autorizado</CardTitle>
          <CardDescription>
            No tienes acceso al sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Tu cuenta <strong>{user.email}</strong> no está asociada a ninguna FCP.
            </p>
            <p className="text-sm text-muted-foreground">
              Para obtener acceso, contacta a un facilitador de tu organización para que te agregue al sistema.
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              ¿Necesitas acceso?
            </h3>
            <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
              Un facilitador debe agregar tu email ({user.email}) a una FCP desde el sistema 
              antes de que puedas acceder. Los facilitadores pueden agregar miembros desde la sección de gestión de miembros.
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
              Tu ID de usuario: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{user.id}</code>
            </p>
          </div>

          {/* Información de debug (solo en desarrollo o si hay registros pero inactivos) */}
          {allUserFCPs && allUserFCPs.length > 0 && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
              <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                ⚠️ Información de Diagnóstico
              </h3>
              <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-2">
                Se encontraron {allUserFCPs.length} registro(s) en fcp_miembros, pero ninguno está activo.
              </p>
              <details className="text-xs text-yellow-800 dark:text-yellow-200">
                <summary className="cursor-pointer font-medium mb-1">Ver detalles técnicos</summary>
                <pre className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-[10px] overflow-auto">
                  {JSON.stringify(allUserFCPs, null, 2)}
                </pre>
                <p className="mt-2 text-xs">
                  Si tu registro está como <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">activo: false</code>, 
                  un facilitador debe cambiar <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">activo = true</code> en la base de datos.
                </p>
              </details>
            </div>
          )}

          {!usuarioData && (
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4">
              <h3 className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                ⚠️ Usuario no encontrado en public.usuarios
              </h3>
              <p className="text-xs text-orange-800 dark:text-orange-200">
                Tu usuario existe en auth.users pero no en public.usuarios. 
                Esto debería crearse automáticamente por el trigger. 
                Si persiste, verifica que la migración del trigger se haya ejecutado.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <form action={handleSignOut}>
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

