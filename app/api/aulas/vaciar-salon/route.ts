import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/aulas/vaciar-salon
 * Elimina todos los estudiantes de un salón (base de datos e historial).
 * Solo director o secretario de la FCP del aula.
 * Body: { aulaId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const aulaId = body?.aulaId as string | undefined

    if (!aulaId || typeof aulaId !== 'string') {
      return NextResponse.json(
        { error: 'Falta aulaId en el cuerpo de la petición.' },
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
      .select('id, fcp_id, nombre')
      .eq('id', aulaId)
      .single()

    if (aulaError || !aula) {
      return NextResponse.json({ error: 'Aula no encontrada.' }, { status: 404 })
    }

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
        { error: 'No tienes permiso para vaciar este salón (solo director o secretario).' },
        { status: 403 }
      )
    }

    const { data: estudiantesEliminados, error: deleteError } = await supabase
      .from('estudiantes')
      .delete()
      .eq('aula_id', aulaId)
      .select('id')

    if (deleteError) {
      console.error('Error vaciando salón:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Error al eliminar estudiantes.' },
        { status: 500 }
      )
    }

    const count = estudiantesEliminados?.length ?? 0
    return NextResponse.json({
      success: true,
      deleted: count,
      message: count === 0
        ? 'No había estudiantes en este salón.'
        : `Se eliminaron ${count} estudiante(s) y todo su historial (asistencias y períodos).`,
    })
  } catch (e) {
    console.error('Error en vaciar-salon:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
