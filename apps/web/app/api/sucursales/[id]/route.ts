export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/sucursales/[id]
 * Elimina una sucursal.
 * Solo director o secretario de la FCP de la sucursal.
 * No se puede eliminar la sucursal predeterminada ni una sucursal con aulas asociadas.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sucursalId } = await params

    if (!sucursalId) {
      return NextResponse.json(
        { error: 'ID de sucursal no proporcionado.' },
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

    const { data: sucursal, error: sucursalError } = await supabase
      .from('sucursales')
      .select('id, fcp_id, nombre, es_predeterminada')
      .eq('id', sucursalId)
      .single()

    if (sucursalError || !sucursal) {
      return NextResponse.json(
        { error: 'Sucursal no encontrada.' },
        { status: 404 }
      )
    }

    if (sucursal.es_predeterminada) {
      return NextResponse.json(
        { error: 'No se puede eliminar la sucursal predeterminada.' },
        { status: 400 }
      )
    }

    const { data: miembro, error: miembroError } = await supabase
      .from('fcp_miembros')
      .select('id, rol')
      .eq('usuario_id', user.id)
      .eq('fcp_id', sucursal.fcp_id)
      .eq('activo', true)
      .in('rol', ['director', 'secretario'])
      .limit(1)
      .maybeSingle()

    if (miembroError || !miembro) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar sucursales (solo director o secretario).' },
        { status: 403 }
      )
    }

    const { count: countAulas } = await supabase
      .from('aulas')
      .select('id', { count: 'exact', head: true })
      .eq('sucursal_id', sucursalId)

    if (countAulas && countAulas > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: la sucursal tiene ${countAulas} aula(s). Reasigne las aulas a otra sucursal primero.`,
        },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('sucursales')
      .delete()
      .eq('id', sucursalId)

    if (deleteError) {
      console.error('Error eliminando sucursal:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Error al eliminar la sucursal.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Sucursal "${sucursal.nombre}" eliminada correctamente.`,
    })
  } catch (e) {
    console.error('Error en DELETE sucursal:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
