import type { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export async function verificarPermisoGestionSucursalesFcp(
  supabase: SupabaseServer,
  fcpId: string
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) }
  }

  const { data: miembroDirectorSecretario } = await supabase
    .from('fcp_miembros')
    .select('id, rol')
    .eq('usuario_id', user.id)
    .eq('fcp_id', fcpId)
    .eq('activo', true)
    .in('rol', ['director', 'secretario'])
    .limit(1)
    .maybeSingle()

  const { data: miembroFacilitador } = await supabase
    .from('fcp_miembros')
    .select('id, rol')
    .eq('usuario_id', user.id)
    .eq('activo', true)
    .eq('rol', 'facilitador')
    .limit(1)
    .maybeSingle()

  if (!miembroDirectorSecretario && !miembroFacilitador) {
    return {
      error: NextResponse.json(
        { error: 'No tienes permiso para gestionar sucursales (solo director, secretario o facilitador).' },
        { status: 403 }
      ),
    }
  }

  return { user }
}
