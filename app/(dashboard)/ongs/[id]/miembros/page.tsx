import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MiembrosList } from '@/components/features/ongs/MiembrosList'

interface MiembrosPageProps {
  params: Promise<{
    id: string
  }> | {
    id: string
  }
}

export default async function MiembrosPage({ params }: MiembrosPageProps) {
  // Manejar params como Promise o objeto según la versión de Next.js
  const resolvedParams = await (params instanceof Promise ? params : Promise.resolve(params))
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Gestión de Miembros
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Administra los miembros y roles de esta FCP
        </p>
      </div>

      <MiembrosList fcpId={resolvedParams.id} />
    </div>
  )
}

