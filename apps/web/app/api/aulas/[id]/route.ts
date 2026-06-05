export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/aulas/[id]
 * Elimina un aula o intervención y referencias asociadas.
 * Solo director o secretario de la FCP del aula.
 * Regulares: debe estar vacía (sin estudiantes en aula_id).
 * Intervenciones: elimina roster intervencion_estudiantes (no exige vacío en estudiantes.aula_id).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: aulaId } = await params

    if (!aulaId) {
      return NextResponse.json(
        { error: 'ID de aula no proporcionado.' },
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

    const { data: aula, error: aulaError } = await supabase
      .from('aulas')
      .select('id, fcp_id, nombre, tipo')
      .eq('id', aulaId)
      .single()

    if (aulaError || !aula) {
      return NextResponse.json({ error: 'Aula no encontrada.' }, { status: 404 })
    }

    const esIntervencion = aula.tipo === 'INTERVENTION'

    const { data: miembro, error: miembroError } = await supabase
      .from('fcp_miembros')
      .select('id, rol')
      .eq('usuario_id', user.id)
      .eq('fcp_id', aula.fcp_id)
      .eq('activo', true)
      .in('rol', ['director', 'secretario'])
      .limit(1)
      .maybeSingle()

    if (miembroError || !miembro) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar aulas (solo director o secretario).' },
        { status: 403 }
      )
    }

    if (!esIntervencion) {
      const { count: countEstudiantes } = await supabase
        .from('estudiantes')
        .select('id', { count: 'exact', head: true })
        .eq('aula_id', aulaId)

      if (countEstudiantes && countEstudiantes > 0) {
        return NextResponse.json(
          {
            error: 'No se puede eliminar: el aula tiene estudiantes. Vacíe el salón primero.',
          },
          { status: 400 }
        )
      }
    }

    const { error: tutorError } = await supabase
      .from('tutor_aula')
      .delete()
      .eq('aula_id', aulaId)

    if (tutorError) {
      console.error('Error eliminando tutor_aula:', tutorError)
      return NextResponse.json(
        { error: tutorError.message || 'Error al eliminar asignaciones de tutores.' },
        { status: 500 }
      )
    }

    const { error: intervError } = await supabase
      .from('intervencion_estudiantes')
      .delete()
      .eq('aula_id', aulaId)

    if (intervError) {
      console.error('Error eliminando intervencion_estudiantes:', intervError)
      return NextResponse.json(
        { error: intervError.message || 'Error al eliminar participantes.' },
        { status: 500 }
      )
    }

    if (!esIntervencion) {
      const { error: periodosError } = await supabase
        .from('estudiante_periodos')
        .delete()
        .eq('aula_id', aulaId)

      if (periodosError) {
        console.error('Error eliminando estudiante_periodos:', periodosError)
        return NextResponse.json(
          { error: periodosError.message || 'Error al eliminar períodos.' },
          { status: 500 }
        )
      }
    }

    const { error: asistenciasError } = await supabase
      .from('asistencias')
      .delete()
      .eq('aula_id', aulaId)

    if (asistenciasError) {
      console.error('Error eliminando asistencias:', asistenciasError)
      return NextResponse.json(
        { error: asistenciasError.message || 'Error al eliminar asistencias.' },
        { status: 500 }
      )
    }

    const { error: deleteError } = await supabase
      .from('aulas')
      .delete()
      .eq('id', aulaId)

    if (deleteError) {
      console.error('Error eliminando aula:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Error al eliminar el aula.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: esIntervencion
        ? `Intervención "${aula.nombre}" eliminada correctamente.`
        : `Aula "${aula.nombre}" eliminada correctamente.`,
    })
  } catch (e) {
    console.error('Error en DELETE aula:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
