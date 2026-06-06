export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { verificarPermisoGestionSucursalesFcp } from '@/lib/server/sucursalAuth'
import { NextResponse } from 'next/server'

/**
 * POST /api/sucursales
 * Crea una sucursal nueva en una FCP.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const fcpId = typeof body.fcp_id === 'string' ? body.fcp_id.trim() : ''
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

    if (!fcpId) {
      return NextResponse.json({ error: 'Indica el proyecto (FCP).' }, { status: 400 })
    }
    if (!nombre) {
      return NextResponse.json({ error: 'Indica un nombre para la sucursal.' }, { status: 400 })
    }
    if (nombre.length > 200) {
      return NextResponse.json({ error: 'El nombre no puede superar 200 caracteres.' }, { status: 400 })
    }

    const supabase = await createClient()
    const auth = await verificarPermisoGestionSucursalesFcp(supabase, fcpId)
    if ('error' in auth && auth.error) return auth.error
    const { user } = auth as { user: { id: string } }

    const { data: maxRow } = await supabase
      .from('sucursales')
      .select('orden')
      .eq('fcp_id', fcpId)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    const orden = (maxRow?.orden ?? 0) + 1

    const { data: nueva, error: insertError } = await supabase
      .from('sucursales')
      .insert({
        fcp_id: fcpId,
        nombre,
        activa: true,
        orden,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id, nombre, es_predeterminada, orden')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una sucursal con ese nombre en el proyecto.' },
          { status: 400 }
        )
      }
      console.error('Error creando sucursal:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Error al crear la sucursal.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Sucursal "${nueva.nombre}" creada correctamente.`,
      sucursal: nueva,
    })
  } catch (e) {
    console.error('Error en POST sucursal:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
