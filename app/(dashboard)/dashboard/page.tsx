import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, GraduationCap, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { ReportesMensualesResumen } from '@/components/features/dashboard/ReportesMensualesResumen'
import { ReporteMensualResumen } from '@/components/features/dashboard/ReporteMensualResumen'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
  let isSecretario = false
  let isTutor = false
  
  if (!isFacilitador) {
    const { data: fcpMiembrosData } = await supabase
      .from('fcp_miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('activo', true)
      .limit(1)

    userRole = fcpMiembrosData && fcpMiembrosData.length > 0 ? fcpMiembrosData[0].rol : null
    isDirector = userRole === 'director'
    isSecretario = userRole === 'secretario'
    isTutor = userRole === 'tutor'
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

  // Si es tutor, mostrar solo sus aulas, cantidad de estudiantes y perfil
  if (isTutor) {
    // Obtener las aulas asignadas al tutor
    // Primero obtener los fcp_miembros del tutor
    const { data: tutorMiembrosData, error: tutorMiembrosError } = await supabase
      .from('fcp_miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('rol', 'tutor')
      .eq('activo', true)

    let tutorAulas: any[] = []
    let totalEstudiantesTutor = 0

    if (!tutorMiembrosError && tutorMiembrosData && tutorMiembrosData.length > 0) {
      const tutorMiembroIds = tutorMiembrosData.map((tm: any) => tm.id)
      
      // Obtener las aulas asignadas al tutor
      const { data: tutorAulasData, error: tutorAulasError } = await supabase
        .from('tutor_aula')
        .select(`
          aula_id,
          aula:aulas(
            id,
            nombre,
            fcp_id,
            fcp:fcps(id, razon_social, numero_identificacion)
          )
        `)
        .in('fcp_miembro_id', tutorMiembroIds)
        .eq('activo', true)

      if (!tutorAulasError && tutorAulasData) {
        tutorAulas = tutorAulasData.map((ta: any) => ta.aula).filter((aula: any) => aula)
        
        // Obtener mes actual para estadísticas
        const now = new Date()
        const mesActual = now.getMonth()
        const añoActual = now.getFullYear()
        const inicioMes = new Date(añoActual, mesActual, 1)
        const finMes = new Date(añoActual, mesActual + 1, 0)
        finMes.setHours(23, 59, 59, 999)
        
        // Contar estudiantes y obtener estadísticas de asistencia por aula
        for (const aula of tutorAulas) {
          if (aula && aula.id) {
            const { count } = await supabase
              .from('estudiantes')
              .select('id', { count: 'exact' })
              .eq('aula_id', aula.id)
              .eq('activo', true)
            
            totalEstudiantesTutor += count || 0
            
            // Obtener estadísticas de asistencia del mes actual para esta aula
            const { data: estudiantesAula } = await supabase
              .from('estudiantes')
              .select('id')
              .eq('aula_id', aula.id)
              .eq('activo', true)
            
            if (estudiantesAula && estudiantesAula.length > 0) {
              const estudianteIds = estudiantesAula.map((e: any) => e.id)
              
              // Obtener asistencias del mes actual
              const { data: asistenciasData } = await supabase
                .from('asistencias')
                .select('estado')
                .in('estudiante_id', estudianteIds)
                .gte('fecha', inicioMes.toISOString().split('T')[0])
                .lte('fecha', finMes.toISOString().split('T')[0])
              
              // Contar por estado
              let presentes = 0
              let faltos = 0
              let permisos = 0
              
              if (asistenciasData) {
                asistenciasData.forEach((asist: any) => {
                  if (asist.estado === 'presente') presentes++
                  else if (asist.estado === 'falto') faltos++
                  else if (asist.estado === 'permiso') permisos++
                })
              }
              
              // Agregar estadísticas al objeto aula
              aula.estadisticas = {
                presentes,
                faltos,
                permisos,
                totalEstudiantes: count || 0
              }
            } else {
              aula.estadisticas = {
                presentes: 0,
                faltos: 0,
                permisos: 0,
                totalEstudiantes: count || 0
              }
            }
          }
        }
      }
    }

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="mt-2 text-foreground/80">
            Bienvenido, {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || user.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card de Mis Aulas */}
          <Link href="/aulas">
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mis Aulas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tutorAulas.length}</div>
                <p className="text-xs text-muted-foreground">Aulas asignadas</p>
              </CardContent>
            </Card>
          </Link>

          {/* Card de Estudiantes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estudiantes</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEstudiantesTutor}</div>
              <p className="text-xs text-muted-foreground">Estudiantes en mis aulas</p>
            </CardContent>
          </Card>
        </div>

        {/* Estadísticas de asistencia por salón */}
        {tutorAulas.length > 0 && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Asistencia por Salón - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</CardTitle>
                <CardDescription>Estadísticas de asistencia del mes actual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salón</TableHead>
                        <TableHead className="text-center">Asistió</TableHead>
                        <TableHead className="text-center">Faltó</TableHead>
                        <TableHead className="text-center">Permiso</TableHead>
                        <TableHead className="text-center">Total Estudiantes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tutorAulas.map((aula: any) => (
                        <TableRow key={aula.id}>
                          <TableCell className="font-medium">{aula.nombre}</TableCell>
                          <TableCell className="text-center text-green-600 dark:text-green-400">
                            {aula.estadisticas?.presentes || 0}
                          </TableCell>
                          <TableCell className="text-center text-red-600 dark:text-red-400">
                            {aula.estadisticas?.faltos || 0}
                          </TableCell>
                          <TableCell className="text-center text-yellow-600 dark:text-yellow-400">
                            {aula.estadisticas?.permisos || 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {aula.estadisticas?.totalEstudiantes || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
                {tutorAulas.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Mis Aulas:</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {tutorAulas.map((aula: any) => (
                        <div
                          key={aula.id}
                          className="rounded border border-border p-3"
                        >
                          <p className="font-medium text-sm">{aula.nombre}</p>
                          {aula.fcp && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {aula.fcp.numero_identificacion} - {aula.fcp.razon_social}
                            </p>
                          )}
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

  // Si es facilitador, mostrar solo reportes mensuales y perfil
  if (isFacilitador) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="mt-2 text-foreground/80">
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
                            className="rounded border border-border p-3"
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
        <h1 className="text-3xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Bienvenido, {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || user.email}
        </p>
      </div>

      <div className={`grid gap-6 ${(isDirector || isSecretario) ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {/* Card de FCPs - Solo para usuarios que no son director ni secretario */}
        {!isDirector && !isSecretario && (
          <Link href="/fcps">
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

        {/* Card de Asistencias - Solo para usuarios que no son director ni secretario */}
        {!isDirector && !isSecretario && (
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

      {/* Reporte Mensual del Mes Actual - Para directores y secretarios */}
      {(isDirector || isSecretario) && (
        <div className="mt-8">
          <ReporteMensualResumen />
        </div>
      )}

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
