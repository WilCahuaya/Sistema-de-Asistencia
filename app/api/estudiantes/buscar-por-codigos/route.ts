import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/estudiantes/buscar-por-codigos?fcpId=xxx&codigos=["A001","A002"]
 * Busca estudiantes por códigos en una FCP. Solo director/secretario.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fcpId = searchParams.get('fcpId')
    const codigosParam = searchParams.get('codigos')

    if (!fcpId || !codigosParam) {
      return NextResponse.json(
        { error: 'Se requieren fcpId y codigos (JSON array).' },
        { status: 400 }
      )
    }

    let codigos: string[]
    try {
      codigos = JSON.parse(codigosParam) as string[]
    } catch {
      return NextResponse.json({ error: 'codigos debe ser un array JSON.' }, { status: 400 })
    }

    if (!Array.isArray(codigos) || codigos.length === 0) {
      return NextResponse.json(
        { error: 'codigos debe ser un array no vacío.' },
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

    const { data: miembro } = await supabase
      .from('fcp_miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('fcp_id', fcpId)
      .eq('activo', true)
      .in('rol', ['director', 'secretario'])
      .limit(1)
      .maybeSingle()

    if (!miembro) {
      return NextResponse.json(
        { error: 'No tienes permiso para esta operación.' },
        { status: 403 }
      )
    }

    const { data: estudiantes, error } = await supabase
      .from('estudiantes')
      .select('id, codigo, nombre_completo')
      .eq('fcp_id', fcpId)
      .eq('activo', true)
      .in('codigo', codigos)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Error al buscar.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      estudiantes: estudiantes || [],
    })
  } catch (e) {
    console.error('Error buscar-por-codigos:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
