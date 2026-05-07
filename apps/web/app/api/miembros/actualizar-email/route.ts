import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * POST /api/miembros/actualizar-email
 * Actualiza correo en public.usuarios (RPC) y, si hay service role, en Auth.
 * Body: { fcpId: string, usuarioId: string, email: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fcpId = body?.fcpId as string | undefined
    const usuarioId = body?.usuarioId as string | undefined
    const emailRaw = body?.email as string | undefined

    if (!fcpId || !usuarioId || typeof emailRaw !== 'string') {
      return NextResponse.json(
        { error: 'Faltan fcpId, usuarioId o email.' },
        { status: 400 }
      )
    }

    const email = emailRaw.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const { error: rpcError } = await supabase.rpc('actualizar_email_usuario_miembro_fcp', {
      p_fcp_id: fcpId,
      p_usuario_id: usuarioId,
      p_nuevo_email: email,
    })

    if (rpcError) {
      const msg = rpcError.message || 'No se pudo actualizar el correo.'
      const status =
        msg.includes('Sin permiso') || msg.includes('secretario') ? 403 : 400
      return NextResponse.json({ error: msg }, { status })
    }

    let authUpdated = false
    const admin = createServiceRoleClient()
    if (admin) {
      const { error: adminErr } = await admin.auth.admin.updateUserById(usuarioId, {
        email,
      })
      if (!adminErr) {
        authUpdated = true
      } else {
        console.warn(
          'actualizar-email: usuarios actualizado; Auth falló (configura SUPABASE_SERVICE_ROLE_KEY o revisa logs):',
          adminErr.message
        )
      }
    }

    return NextResponse.json({
      success: true,
      authUpdated,
      message: authUpdated
        ? 'Correo actualizado. Si Supabase exige confirmación, revisa la bandeja del nuevo email.'
        : 'Correo guardado en el perfil. Para el inicio de sesión, configura SUPABASE_SERVICE_ROLE_KEY en el servidor o actualiza el correo en Authentication.',
    })
  } catch (e) {
    console.error('actualizar-email:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      { status: 500 }
    )
  }
}
