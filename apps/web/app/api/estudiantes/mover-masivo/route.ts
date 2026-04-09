import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCurrentMonthYearInAppTimezone, getMonthRangeInAppTimezone } from '@/lib/utils/dateUtils'

/**
 * POST /api/estudiantes/mover-masivo
 * Mueve varios estudiantes al mismo salón de destino.
 * Solo director o secretario de la FCP.
 * Body: { estudianteIds: string[], aulaDestinoId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const estudianteIds = body?.estudianteIds as string[] | undefined
    const aulaDestinoId = body?.aulaDestinoId as string | undefined

    if (
      !Array.isArray(estudianteIds) ||
      estudianteIds.length === 0 ||
      !aulaDestinoId ||
      typeof aulaDestinoId !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Se requieren estudianteIds (array) y aulaDestinoId.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    // Verificar que el aula destino existe y obtener fcp_id
    const { data: aulaDestino, error: aulaError } = await supabase
      .from('aulas')
      .select('id, fcp_id, nombre')
      .eq('id', aulaDestinoId)
      .single()

    if (aulaError || !aulaDestino) {
      return NextResponse.json({ error: 'Aula destino no encontrada.' }, { status: 404 })
    }

    // Verificar permisos (director o secretario de la FCP)
    const { data: miembro, error: miembroError } = await supabase
      .from('fcp_miembros')
      .select('id, rol')
      .eq('usuario_id', user.id)
      .eq('fcp_id', aulaDestino.fcp_id)
      .eq('activo', true)
      .in('rol', ['director', 'secretario'])
      .limit(1)
      .maybeSingle()

    if (miembroError || !miembro) {
      return NextResponse.json(
        { error: 'No tienes permiso para mover estudiantes (solo director o secretario).' },
        { status: 403 }
      )
    }

    // Obtener estudiantes y verificar que pertenecen a la misma FCP
    const { data: estudiantes, error: estError } = await supabase
      .from('estudiantes')
      .select('id, aula_id, fcp_id, activo')
      .in('id', estudianteIds)
      .eq('fcp_id', aulaDestino.fcp_id)
      .eq('activo', true)

    if (estError) {
      return NextResponse.json(
        { error: estError.message || 'Error al cargar estudiantes.' },
        { status: 500 }
      )
    }

    if (!estudiantes || estudiantes.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron estudiantes válidos para mover.' },
        { status: 400 }
      )
    }

    const { year, month } = getCurrentMonthYearInAppTimezone()
    const { start: firstCur, end: lastCur } = getMonthRangeInAppTimezone(year, month)

    let movidos = 0
    const errores: string[] = []

    for (const est of estudiantes) {
      if (est.aula_id === aulaDestinoId) {
        continue // Ya está en el aula destino
      }

      try {
        const { data: periodos, error: periodosError } = await supabase
          .from('estudiante_periodos')
          .select('id, fecha_inicio, fecha_fin, aula_id')
          .eq('estudiante_id', est.id)

        if (periodosError) {
          errores.push(`Est. ${est.id}: ${periodosError.message}`)
          continue
        }

        let periodoActual = (periodos || []).find(
          (p: { fecha_inicio: string; fecha_fin: string | null }) =>
            p.fecha_inicio <= lastCur && (p.fecha_fin === null || p.fecha_fin >= firstCur)
        )

        if (!periodoActual) {
          const { data: inserted, error: insertError } = await supabase
            .from('estudiante_periodos')
            .insert({
              estudiante_id: est.id,
              aula_id: est.aula_id,
              fecha_inicio: firstCur,
              fecha_fin: lastCur,
              created_by: user.id,
            })
            .select('id')
            .single()

          if (insertError) {
            errores.push(`Est. ${est.id}: ${insertError.message}`)
            continue
          }
          periodoActual = inserted
        }

        const { error: updateError } = await supabase
          .from('estudiante_periodos')
          .update({ aula_id: aulaDestinoId })
          .eq('id', periodoActual.id)

        if (updateError) {
          errores.push(`Est. ${est.id}: ${updateError.message}`)
          continue
        }

        movidos++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        errores.push(`Est. ${est.id}: ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      movidos,
      total: estudiantes.length,
      errores: errores.length > 0 ? errores : undefined,
      message:
        movidos === estudiantes.length
          ? `Se movieron ${movidos} estudiante(s) a "${aulaDestino.nombre}".`
          : `Se movieron ${movidos} de ${estudiantes.length} estudiante(s).${errores.length > 0 ? ' Algunos fallaron.' : ''}`,
    })
  } catch (e) {
    console.error('Error en mover-masivo:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
