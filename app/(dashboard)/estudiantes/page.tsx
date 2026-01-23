import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EstudianteList } from '@/components/features/estudiantes/EstudianteList'

export default async function EstudiantesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Gestión de Estudiantes
        </h1>
        <p className="mt-2 text-foreground/80">
          Administra los estudiantes de tus FCPs
        </p>
      </div>

      <EstudianteList />
    </div>
  )
}

