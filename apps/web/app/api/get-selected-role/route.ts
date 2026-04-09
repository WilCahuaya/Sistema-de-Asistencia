import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSelectedRoleOrHighest } from '@/lib/utils/get-selected-role'

/**
 * GET /api/get-selected-role
 * Devuelve el rol seleccionado del usuario desde las cookies (servidor).
 * El cliente usa esto cuando localStorage está vacío o para sincronizar con el servidor.
 * Las cookies se envían automáticamente en la petición (same-origin).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ role: null }, { status: 200 })
    }

    const roleInfo = await getSelectedRoleOrHighest(user.id)

    if (!roleInfo) {
      return NextResponse.json({ role: null }, { status: 200 })
    }

    return NextResponse.json({
      role: {
        roleId: roleInfo.roleId,
        role: roleInfo.role,
        fcpId: roleInfo.fcpId,
        fcp: roleInfo.fcp
      }
    })
  } catch (error) {
    console.error('Error en get-selected-role:', error)
    return NextResponse.json({ role: null }, { status: 200 })
  }
}
