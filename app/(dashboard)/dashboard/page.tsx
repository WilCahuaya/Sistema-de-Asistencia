import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, GraduationCap, ClipboardList } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener información del usuario
  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  // Si no existe el usuario en la tabla, se creará automáticamente por el trigger
  // pero mostramos la información del auth.users por ahora
  if (usuarioError) {
    console.log('Usuario no encontrado en tabla usuarios (se creará automáticamente):', usuarioError)
  }

  // Obtener ONGs del usuario
  const { data: ongs, error: ongsError } = await supabase
    .from('usuario_ong')
    .select(`
      *,
      ong:ongs(*)
    `)
    .eq('usuario_id', user.id)
    .eq('activo', true)

  if (ongsError) {
    console.error('Error loading ONGs:', ongsError)
  }

  // Obtener estadísticas básicas (primera ONG como ejemplo)
  let estadisticas = null
  if (ongs && ongs.length > 0) {
    const primeraOng = ongs[0].ong
    if (primeraOng) {
      const { count: countAulas } = await supabase
        .from('aulas')
        .select('*', { count: 'exact', head: true })
        .eq('ong_id', primeraOng.id)
        .eq('activa', true)

      const { count: countEstudiantes } = await supabase
        .from('estudiantes')
        .select('*', { count: 'exact', head: true })
        .eq('ong_id', primeraOng.id)
        .eq('activo', true)

      estadisticas = {
        aulas: countAulas || 0,
        estudiantes: countEstudiantes || 0,
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Bienvenido, {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || user.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card de ONGs */}
        <Link href="/dashboard/ongs">
          <Card className="cursor-pointer transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ONGs</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ongs?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Organizaciones activas
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card de Aulas */}
        <Link href="/dashboard/aulas">
          <Card className="cursor-pointer transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aulas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticas?.aulas || 0}</div>
              <p className="text-xs text-muted-foreground">Aulas activas</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card de Estudiantes */}
        <Link href="/dashboard/estudiantes">
          <Card className="cursor-pointer transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estudiantes</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticas?.estudiantes || 0}</div>
              <p className="text-xs text-muted-foreground">Estudiantes registrados</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card de Asistencias */}
        <Link href="/dashboard/asistencias">
          <Card className="cursor-pointer transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Asistencias</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Registros hoy</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Información del usuario */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Mi Perfil</CardTitle>
            <CardDescription>Información de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Email:</span> {user.email}
              </p>
              {(usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name) && (
                <p className="text-sm">
                  <span className="font-medium">Nombre:</span>{' '}
                  {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name}
                </p>
              )}
              {user.user_metadata?.avatar_url && (
                <div className="mt-2">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full"
                  />
                </div>
              )}
              {ongs && ongs.length > 0 ? (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Mis ONGs:</p>
                  <div className="space-y-1">
                    {ongs.map((usuarioOng: any) => (
                      <div
                        key={usuarioOng.id}
                        className="rounded border p-2 dark:border-gray-700"
                      >
                        <p className="font-medium">{usuarioOng.ong?.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          Rol: {usuarioOng.rol}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    No tienes ONGs asignadas aún. Crea una desde la sección ONGs.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

