import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, GraduationCap, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { ReportesMensualesResumen } from '@/components/features/dashboard/ReportesMensualesResumen'

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
  if (usuarioError) {
    console.log('Usuario no encontrado en tabla usuarios (se creará automáticamente):', usuarioError)
  }

  // Verificar el rol del usuario (primero verificar si es facilitador del sistema)
  const { data: facilitadorData } = await supabase
    .from('fcp_miembros')
    .select('rol')
    .eq('usuario_id', user.id)
    .is('fcp_id', null)
    .eq('rol', 'facilitador')
    .eq('activo', true)
    .limit(1)

  const isFacilitador = facilitadorData && facilitadorData.length > 0

  // Si no es facilitador, obtener su rol en las FCPs
  let userRole: string | null = null
  let isDirector = false
  
  if (!isFacilitador) {
    const { data: fcpMiembrosData } = await supabase
      .from('fcp_miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('activo', true)
      .limit(1)

    userRole = fcpMiembrosData && fcpMiembrosData.length > 0 ? fcpMiembrosData[0].rol : null
    isDirector = userRole === 'director'
  }

  let fcps: any[] = []
  let fcpsError: any = null

  if (isFacilitador) {
    // Facilitadores pueden ver todas las FCPs del sistema
    const { data: todasLasFCPs, error: fcpsErrorFacilitador } = await supabase
      .from('fcps')
      .select('*')
      .eq('activa', true)
      .order('razon_social', { ascending: true })
    
    if (fcpsErrorFacilitador) {
      console.error('Error loading FCPs:', fcpsErrorFacilitador)
      fcpsError = fcpsErrorFacilitador
    } else {
      // Mapear a formato similar para mantener compatibilidad
      fcps = todasLasFCPs?.map((fcp: any) => ({
        id: `facilitador-${fcp.id}`,
        fcp_id: fcp.id,
        usuario_id: user.id,
        rol: 'facilitador',
        activo: true,
        fcp: fcp
      })) || []
    }
  } else {
    // Usuarios no facilitadores solo ven sus FCPs
    const { data: fcpsData, error: fcpsErrorUsuario } = await supabase
      .from('fcp_miembros')
      .select(`
        *,
        fcp:fcps(*)
      `)
      .eq('usuario_id', user.id)
      .eq('activo', true)

    if (fcpsErrorUsuario) {
      console.error('Error loading FCPs:', fcpsErrorUsuario)
      fcpsError = fcpsErrorUsuario
    } else {
      fcps = fcpsData || []
    }
  }

  // Verificar si el usuario tiene algún rol asignado
  const { data: rolesCheck } = await supabase
    .from('fcp_miembros')
    .select('id, activo, rol, fcp_id')
    .eq('usuario_id', user.id)
    .eq('activo', true)
    .limit(1)

  // Si no tiene ningún rol activo, redirigir a la página pendiente
  if (!rolesCheck || rolesCheck.length === 0) {
    redirect('/pendiente')
  }

  // Bloquear acceso si el usuario no tiene FCPs asignadas (solo para no facilitadores)
  if (!isFacilitador && (!fcps || fcps.length === 0)) {
    redirect('/pendiente')
  }

  // Obtener estadísticas básicas usando función RPC que respeta RLS
  // Esto asegura que las políticas se apliquen correctamente para todos los roles
  let estadisticas = null
  if (fcps && fcps.length > 0) {
    let totalAulas = 0
    let totalEstudiantes = 0

    // Usar función RPC que respeta explícitamente las políticas RLS
    // Llamar sin parámetros para obtener stats de todas las FCPs del usuario
    const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats', { p_fcp_id: null })

    if (statsError) {
      console.error('Error obteniendo estadísticas del dashboard:', statsError)
      // Fallback a método anterior si la función RPC no está disponible
      for (const fcpMiembro of fcps) {
        if (fcpMiembro.fcp) {
          const { count: countAulas } = await supabase
            .from('aulas')
            .select('id', { count: 'exact' })
            .eq('fcp_id', fcpMiembro.fcp.id)
            .eq('activa', true)

          const { count: countEstudiantes } = await supabase
            .from('estudiantes')
            .select('id', { count: 'exact' })
            .eq('fcp_id', fcpMiembro.fcp.id)
            .eq('activo', true)

          totalAulas += countAulas || 0
          totalEstudiantes += countEstudiantes || 0
        }
      }
    } else if (statsData && statsData.length > 0) {
      // Sumar estadísticas de todas las FCPs
      for (const stat of statsData) {
        totalAulas += stat.total_aulas || 0
        totalEstudiantes += stat.total_estudiantes || 0
      }
    }

    estadisticas = {
      aulas: totalAulas,
      estudiantes: totalEstudiantes,
    }
  }

  // Si es facilitador, mostrar solo reportes mensuales y perfil
  if (isFacilitador) {
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Reportes Mensuales del Mes Actual */}
          <div>
            <ReportesMensualesResumen />
          </div>

          {/* Información del usuario */}
          <div>
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
                  {fcps && fcps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">FCPs del Sistema:</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {fcps.map((fcpMiembro: any) => (
                          <div
                            key={fcpMiembro.id || fcpMiembro.fcp_id}
                            className="rounded border p-3 dark:border-gray-700"
                          >
                            <p className="font-medium text-sm">{fcpMiembro.fcp?.razon_social}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {fcpMiembro.fcp?.numero_identificacion || 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fcpMiembro.fcp?.nombre_completo_contacto || 'N/A'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard normal para no facilitadores
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

      <div className={`grid gap-6 ${isDirector ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {/* Card de ONGs - Solo para secretarios, no para directores */}
        {!isDirector && (
          <Link href="/ongs">
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">FCPs</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fcps?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  FCPs activas
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Card de Aulas */}
        <Link href="/aulas">
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
        <Link href="/estudiantes">
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

        {/* Card de Asistencias - Solo para secretarios, no para directores */}
        {!isDirector && (
          <Link href="/asistencias">
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
        )}
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
              {fcps && fcps.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Mis FCPs:</p>
                  <div className="space-y-2">
                    {fcps.map((fcpMiembro: any) => (
                      <div
                        key={fcpMiembro.id || fcpMiembro.fcp_id}
                        className="rounded border p-3 dark:border-gray-700"
                      >
                        <p className="font-medium text-sm">{fcpMiembro.fcp?.razon_social}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fcpMiembro.fcp?.numero_identificacion || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fcpMiembro.fcp?.nombre_completo_contacto || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
