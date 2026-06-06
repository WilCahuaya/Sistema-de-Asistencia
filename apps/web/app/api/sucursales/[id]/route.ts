export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { verificarPermisoGestionSucursalesFcp } from '@/lib/server/sucursalAuth'
import { NextResponse } from 'next/server'

async function obtenerSucursalConPermiso(supabase: Awaited<ReturnType<typeof createClient>>, sucursalId: string) {
  const { data: sucursal, error: sucursalError } = await supabase
    .from('sucursales')
    .select('id, fcp_id, nombre, es_predeterminada')
    .eq('id', sucursalId)
    .single()

  if (sucursalError || !sucursal) {
    return { error: NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 }) }
  }

  const auth = await verificarPermisoGestionSucursalesFcp(supabase, sucursal.fcp_id)
  if ('error' in auth && auth.error) return auth
  const { user } = auth as { user: { id: string } }

  return { user, sucursal }
}

/**
 * PATCH /api/sucursales/[id]
 * Renombra una sucursal (solo el nombre).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sucursalId } = await params

    if (!sucursalId) {
      return NextResponse.json({ error: 'ID de sucursal no proporcionado.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

    if (!nombre) {
      return NextResponse.json({ error: 'Indica un nombre para la sucursal.' }, { status: 400 })
    }

    if (nombre.length > 200) {
      return NextResponse.json({ error: 'El nombre no puede superar 200 caracteres.' }, { status: 400 })
    }

    const supabase = await createClient()
    const auth = await obtenerSucursalConPermiso(supabase, sucursalId)
    if ('error' in auth && auth.error) return auth.error
    const { user, sucursal } = auth as { user: { id: string }; sucursal: { id: string; es_predeterminada: boolean; nombre: string } }

    if (sucursal.es_predeterminada) {
      return NextResponse.json(
        { error: 'No se puede renombrar la sucursal Principal.' },
        { status: 400 }
      )
    }

    const { data: actualizada, error: updateError } = await supabase
      .from('sucursales')
      .update({
        nombre,
        updated_by: user.id,
      })
      .eq('id', sucursalId)
      .select('id, nombre')
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe otra sucursal con ese nombre en el proyecto.' },
          { status: 400 }
        )
      }
      console.error('Error actualizando sucursal:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Error al actualizar la sucursal.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Sucursal renombrada a "${actualizada.nombre}".`,
      sucursal: actualizada,
    })
  } catch (e) {
    console.error('Error en PATCH sucursal:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}

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
    const auth = await obtenerSucursalConPermiso(supabase, sucursalId)
    if ('error' in auth && auth.error) return auth.error
    const { sucursal } = auth as { sucursal: { id: string; es_predeterminada: boolean; nombre: string } }

    if (sucursal.es_predeterminada) {
      return NextResponse.json(
        { error: 'No se puede eliminar la sucursal predeterminada.' },
        { status: 400 }
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
