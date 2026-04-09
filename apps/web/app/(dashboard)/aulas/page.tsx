import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AulaList } from '@/components/features/aulas/AulaList'

export default async function AulasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Gestión de Aulas
        </h1>
        <p className="mt-2 text-foreground/80">
          Administra las aulas de tus FCPs
        </p>
      </div>

      <AulaList />
    </div>
  )
}

