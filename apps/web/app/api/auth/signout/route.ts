import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  // Cerrar sesión en Supabase
  const { error } = await supabase.auth.signOut({ scope: 'global' })

  if (error) {
    console.error('Error signing out:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Devolver respuesta exitosa
  // El cliente hará la redirección
  return NextResponse.json({ success: true })
}

