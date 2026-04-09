import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener información del usuario desde la tabla usuarios
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  // Obtener ONGs del usuario
  const { data: ongs } = await supabase
    .from('usuario_ong')
    .select(`
      *,
      ong:ongs(*)
    `)
    .eq('usuario_id', user.id)
    .eq('activo', true)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Bienvenido, {usuario?.nombre_completo || user.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Información del usuario */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mi Perfil
            </h2>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Email:</span> {user.email}
              </p>
              {usuario?.nombre_completo && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Nombre:</span>{' '}
                  {usuario.nombre_completo}
                </p>
              )}
            </div>
          </div>

          {/* ONGs del usuario */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mis ONGs
            </h2>
            {ongs && ongs.length > 0 ? (
              <div className="mt-4 space-y-2">
                {ongs.map((usuarioOng: any) => (
                  <div
                    key={usuarioOng.id}
                    className="rounded border p-2 dark:border-gray-700"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">
                      {usuarioOng.ong?.nombre}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Rol: {usuarioOng.rol}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                No tienes ONGs asignadas aún
              </p>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Acciones Rápidas
            </h2>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Funcionalidades próximamente...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

