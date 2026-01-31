import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, GraduationCap, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { ReportesMensualesResumen } from '@/components/features/dashboard/ReportesMensualesResumen'
import { ReporteMensualResumen } from '@/components/features/dashboard/ReporteMensualResumen'
import { getUserHighestRoleFromDB } from '@/lib/utils/get-user-highest-role'
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

  // Obtener el rol seleccionado desde cookies o usar el de mayor jerarquía como fallback
  const { getSelectedRoleOrHighest, getSelectedRoleFromCookies } = await import('@/lib/utils/get-selected-role')
  
  // PRIMERO intentar obtener el rol desde cookies (sin fallback)
  const selectedRoleFromCookies = await getSelectedRoleFromCookies(user.id)
  
  let selectedRoleInfo
  if (selectedRoleFromCookies) {
    // Si hay rol en cookies, usarlo directamente
    selectedRoleInfo = selectedRoleFromCookies
    console.log('✅ Dashboard - Usando rol desde cookies:', {
      roleId: selectedRoleInfo.roleId,
      role: selectedRoleInfo.role,
      fcpId: selectedRoleInfo.fcpId
    })
  } else {
    // Si no hay cookies, usar el fallback (solo para casos donde el usuario no viene de /seleccionar-rol)
    console.warn('⚠️ Dashboard - No hay rol en cookies, usando fallback. El usuario debería venir de /seleccionar-rol')
    selectedRoleInfo = await getSelectedRoleOrHighest(user.id)
  }
  
  if (!selectedRoleInfo) {
    console.error('❌ Dashboard - No se pudo obtener ningún rol, redirigiendo a /seleccionar-rol')
    redirect('/seleccionar-rol')
  }

  // Determinar los flags basándose en el rol seleccionado
  const userRole = selectedRoleInfo.role
  const isFacilitador = userRole === 'facilitador'
  const isDirector = userRole === 'director'
  const isSecretario = userRole === 'secretario'
  // IMPORTANTE: isTutor solo debe ser true si el rol es tutor Y no es ningún otro rol de mayor jerarquía
  const isTutor = userRole === 'tutor' && !isDirector && !isSecretario && !isFacilitador
  const allRoles: string[] = [userRole] // Solo el rol seleccionado
  
  // Debug: Verificar que los flags se establezcan correctamente
  console.log('🧭 [Dashboard] Navegación a dashboard:', {
    usuario: user.email,
    userId: user.id,
    rolSeleccionado: selectedRoleInfo.role,
    roleId: selectedRoleInfo.roleId,
    fcpId: selectedRoleInfo.fcpId,
    fcpNombre: selectedRoleInfo.fcp?.razon_social || 'N/A',
    flags: {
      isFacilitador,
      isDirector,
      isSecretario,
      isTutor
    },
    'shouldShowReports': isDirector || isSecretario,
    'shouldShowTutorView': isTutor && !isDirector && !isSecretario && !isFacilitador,
    'fromCookies': !!selectedRoleFromCookies
  })
  
  // Validación adicional: Si el rol seleccionado es director pero isDirector es false, hay un problema
  if (userRole === 'director' && !isDirector) {
    console.error('❌ ERROR CRÍTICO: Rol seleccionado es director pero isDirector es false!', {
      userRole,
      isDirector,
      isSecretario,
      isFacilitador,
      isTutor,
      selectedRoleInfo
    })
  }
  
  // Validación: Si el rol seleccionado es tutor pero debería ser director, hay un problema
  if (userRole === 'tutor' && (isDirector || isSecretario)) {
    console.error('❌ ERROR CRÍTICO: Rol seleccionado es tutor pero tiene flags de director/secretario!', {
      userRole,
      isDirector,
      isSecretario,
      isFacilitador,
      isTutor,
      selectedRoleInfo
    })
  }
  
  // Log para debugging - SIEMPRE mostrar cuando hay múltiples roles
  if (allRoles.length > 1) {
    console.log('✅ Usuario con múltiples roles detectado en dashboard:', {
      todosLosRoles: allRoles,
      rolSeleccionado: userRole,
      flags: {
        isFacilitador,
        isDirector,
        isSecretario,
        isTutor
      },
      'Verificación de condiciones de renderizado': {
        'isFacilitador': isFacilitador,
        'isDirector': isDirector,
        'isSecretario': isSecretario,
        'isTutor': isTutor,
        'isDirector || isSecretario': isDirector || isSecretario,
        'isTutor && !isDirector && !isSecretario && !isFacilitador': isTutor && !isDirector && !isSecretario && !isFacilitador
      }
    })
  }
  
  // Log adicional para verificar siempre los valores
  console.log('🔍 Dashboard - Valores finales de flags:', {
    userId: user.id,
    userEmail: user.email,
    allRoles,
    highestRole: userRole,
    isFacilitador,
    isDirector,
    isSecretario,
    isTutor
  })

  let fcps: any[] = []
  let fcpsError: any = null
  const fcpMap = new Map<string, { fcp_id: string; fcp: any; rol: string; activo: boolean }>()

  const { data: facRow } = await supabase.from('facilitadores').select('usuario_id').eq('usuario_id', user.id).maybeSingle()
  const esFacilitador = !!facRow

  if (esFacilitador) {
    const { data: fcpsData, error: e } = await supabase
      .from('fcps')
      .select('*')
      .eq('facilitador_id', user.id)
      .eq('activa', true)
      .order('razon_social')
    if (e) fcpsError = e
    else if (fcpsData) {
      for (const f of fcpsData) {
        fcpMap.set(f.id, { fcp_id: f.id, fcp: f, rol: 'facilitador', activo: true })
      }
    }
  }

  const { data: miembrosData, error: miembrosErr } = await supabase
    .from('fcp_miembros')
    .select('*, fcp:fcps(*)')
    .eq('usuario_id', user.id)
    .eq('activo', true)
    .not('fcp_id', 'is', null)
  if (miembrosErr) fcpsError = miembrosErr
  else if (miembrosData) {
    const { getRolPriority } = await import('@/lib/utils/roles')
    for (const m of miembrosData) {
      if (!m.fcp || !m.fcp_id) continue
      const existing = fcpMap.get(m.fcp_id)
      const useNew = !existing || getRolPriority(m.rol as 'facilitador' | 'director' | 'secretario' | 'tutor') > getRolPriority(existing.rol as 'facilitador' | 'director' | 'secretario' | 'tutor' | null)
      if (useNew) fcpMap.set(m.fcp_id, { fcp_id: m.fcp_id, fcp: m.fcp, rol: m.rol, activo: true })
    }
  }

  fcps = Array.from(fcpMap.values()).sort((a, b) => (a.fcp?.razon_social || '').localeCompare(b.fcp?.razon_social || ''))

  // Filtrar por rol seleccionado: toda la app se enfoca en ese rol
  if (selectedRoleInfo) {
    if (selectedRoleInfo.role === 'facilitador') {
      fcps = fcps.filter((f: any) => f.rol === 'facilitador')
    } else if (selectedRoleInfo.fcpId) {
      const sole = fcps.find((f: any) => f.fcp?.id === selectedRoleInfo.fcpId)
      fcps = sole ? [sole] : []
    }
  }

  const { data: rolesCheck } = await supabase
    .from('fcp_miembros')
    .select('id, activo, rol, fcp_id')
    .eq('usuario_id', user.id)
    .eq('activo', true)
    .not('fcp_id', 'is', null)
    .limit(1)

  if (!esFacilitador && (!rolesCheck || rolesCheck.length === 0)) {
    redirect('/pendiente')
  }

  // No redirigir facilitadores sin FCPs: deben poder ver el dashboard y crear su primera FCP
  if ((!fcps || fcps.length === 0) && !esFacilitador) {
    redirect('/pendiente')
  }

  // Obtener estadísticas básicas usando queries directas que respetan RLS
  // Esto asegura que las políticas se apliquen correctamente para todos los roles
  let estadisticas = null
  if (fcps && fcps.length > 0) {
    let totalAulas = 0
    let totalEstudiantes = 0

    // Usar el fcpId del rol seleccionado si está disponible, de lo contrario usar todas las FCPs
    const fcpIdForStats = selectedRoleInfo?.fcpId
    
    // Si hay un rol seleccionado con fcpId específico, obtener stats solo de esa FCP
    if (fcpIdForStats) {
      const fcpMiembro = fcps.find(f => f.fcp?.id === fcpIdForStats)
      if (fcpMiembro?.fcp) {
        // Obtener estadísticas según el rol
        if (isFacilitador || isDirector || isSecretario) {
          // Facilitadores, Directores y Secretarios ven todas las aulas y estudiantes de la FCP
          const { count: countAulas } = await supabase
            .from('aulas')
            .select('id', { count: 'exact' })
            .eq('fcp_id', fcpIdForStats)
            .eq('activa', true)

          const { count: countEstudiantes } = await supabase
            .from('estudiantes')
            .select('id', { count: 'exact' })
            .eq('fcp_id', fcpIdForStats)
            .eq('activo', true)

          totalAulas = countAulas || 0
          totalEstudiantes = countEstudiantes || 0
        } else if (isTutor) {
          // Tutores solo ven sus aulas asignadas
          // Obtener el fcp_miembro_id del rol seleccionado (que es el roleId)
          const fcpMiembroId = selectedRoleInfo?.roleId
          
          if (fcpMiembroId) {
            const { data: tutorAulas } = await supabase
              .from('tutor_aula')
              .select('aula_id')
              .eq('fcp_id', fcpIdForStats)
              .eq('activo', true)
              .eq('fcp_miembro_id', fcpMiembroId)

            if (tutorAulas && tutorAulas.length > 0) {
              const aulaIds = tutorAulas.map(ta => ta.aula_id)
              
              const { count: countAulas } = await supabase
                .from('aulas')
                .select('id', { count: 'exact' })
                .in('id', aulaIds)
                .eq('activa', true)

              const { count: countEstudiantes } = await supabase
                .from('estudiantes')
                .select('id', { count: 'exact' })
                .in('aula_id', aulaIds)
                .eq('activo', true)

              totalAulas = countAulas || 0
              totalEstudiantes = countEstudiantes || 0
            }
          }
        }
      }
    } else {
      // Si no hay fcpId específico, obtener stats de todas las FCPs del usuario
      for (const fcpMiembro of fcps) {
        if (fcpMiembro.fcp) {
          if (isFacilitador || isDirector || isSecretario) {
            // Facilitadores, Directores y Secretarios ven todas las aulas y estudiantes
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
          } else if (isTutor) {
            // Tutores solo ven sus aulas asignadas
            // Obtener todos los fcp_miembro_id del usuario que sean tutores en esta FCP
            const { data: tutorMiembros } = await supabase
              .from('fcp_miembros')
              .select('id')
              .eq('usuario_id', user.id)
              .eq('fcp_id', fcpMiembro.fcp.id)
              .eq('rol', 'tutor')
              .eq('activo', true)

            if (tutorMiembros && tutorMiembros.length > 0) {
              const tutorMiembroIds = tutorMiembros.map(tm => tm.id)
              
              const { data: tutorAulas } = await supabase
                .from('tutor_aula')
                .select('aula_id')
                .eq('fcp_id', fcpMiembro.fcp.id)
                .eq('activo', true)
                .in('fcp_miembro_id', tutorMiembroIds)

              if (tutorAulas && tutorAulas.length > 0) {
                const aulaIds = tutorAulas.map(ta => ta.aula_id)
                
                const { count: countAulas } = await supabase
                  .from('aulas')
                  .select('id', { count: 'exact' })
                  .in('id', aulaIds)
                  .eq('activa', true)

                const { count: countEstudiantes } = await supabase
                  .from('estudiantes')
                  .select('id', { count: 'exact' })
                  .in('aula_id', aulaIds)
                  .eq('activo', true)

                totalAulas += countAulas || 0
                totalEstudiantes += countEstudiantes || 0
              }
            }
          }
        }
      }
    }

    estadisticas = {
      aulas: totalAulas,
      estudiantes: totalEstudiantes,
    }
  }

  // ORDEN CRÍTICO: Verificar primero Facilitador, luego Director/Secretario, finalmente Tutor
  // La función getUserHighestRoleFromDB ya asegura que los flags estén correctamente establecidos
  // basándose en el rol de mayor jerarquía
  
  // IMPORTANTE: Verificar primero Facilitador antes de cualquier otra condición
  // Si es facilitador, mostrar solo reportes mensuales y perfil
  if (isFacilitador) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-foreground/80 sm:text-base">
            Bienvenido, {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || user.email}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
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
  
  // Si es tutor (y NO es director ni secretario ni facilitador), mostrar solo sus aulas, cantidad de estudiantes y perfil
  // IMPORTANTE: Esta verificación debe estar DESPUÉS de verificar facilitador
  if (isTutor && !isDirector && !isSecretario && !isFacilitador) {
    console.log('🔍 Dashboard - Mostrando vista de Tutor (verificación de condiciones):', {
      isTutor,
      isDirector,
      isSecretario,
      isFacilitador,
      'Condición completa': isTutor && !isDirector && !isSecretario && !isFacilitador
    })
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
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-foreground/80 sm:text-base">
            Bienvenido, {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || user.email}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
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
                <p className="mb-2 text-xs text-muted-foreground sm:hidden">Desliza para ver más columnas →</p>
                <div className="table-responsive">
                  <Table className="min-w-[400px]">
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

  // Dashboard normal para Director/Secretario (o cualquier otro rol que no sea Facilitador ni Tutor puro)
  // Si llegamos aquí, significa que el usuario es Director, Secretario, o tiene un rol de mayor jerarquía
  console.log('🔍 Dashboard - Mostrando vista de Director/Secretario (verificación de condiciones):', {
    isFacilitador,
    isDirector,
    isSecretario,
    isTutor,
    highestRole: userRole,
    'Condición Director/Secretario': isDirector || isSecretario,
    'Condición Tutor': isTutor && !isDirector && !isSecretario && !isFacilitador
  })
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Bienvenido, {usuario?.nombre_completo || user.user_metadata?.full_name || user.user_metadata?.name || user.email}
        </p>
      </div>

      <div className={`grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 ${(isDirector || isSecretario) ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
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
