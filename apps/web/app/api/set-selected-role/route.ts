import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roleId, role, fcpId } = await request.json()

    let valid = false
    if (role === 'facilitador' && (roleId?.startsWith('facilitador-') || roleId === 'facilitador-sistema')) {
      const { data: facRow } = await supabase
        .from('facilitadores')
        .select('usuario_id')
        .eq('usuario_id', user.id)
        .maybeSingle()
      if (facRow) {
        if (roleId === 'facilitador-sistema' || !fcpId) {
          valid = true
        } else {
          const { data: fcpRow } = await supabase
            .from('fcps')
            .select('id')
            .eq('id', fcpId)
            .eq('facilitador_id', user.id)
            .eq('activa', true)
            .maybeSingle()
          valid = !!fcpRow
        }
      }
    } else {
      const { data: roleData, error } = await supabase
        .from('fcp_miembros')
        .select('id, usuario_id, activo')
        .eq('id', roleId)
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .maybeSingle()
      valid = !error && !!roleData
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Crear respuesta con cookies
    const response = NextResponse.json({ success: true })
    
    console.log('🔍 set-selected-role API - Estableciendo cookies:', {
      roleId,
      role,
      fcpId,
      userId: user.id
    })
    
    // Establecer cookies con configuración explícita
    response.cookies.set('selectedRoleId', roleId, {
      httpOnly: false, // Necesario para que el cliente también pueda leerlo
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: '/',
      domain: undefined // No establecer dominio para que funcione en localhost
    })

    response.cookies.set('selectedRole', role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      domain: undefined
    })

    if (fcpId) {
      response.cookies.set('selectedFcpId', fcpId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        domain: undefined
      })
    } else {
      response.cookies.delete('selectedFcpId')
    }

    console.log('🔍 set-selected-role API - Cookies establecidas correctamente')
    return response
  } catch (error) {
    console.error('Error setting selected role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

