import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MiembrosList } from '@/components/features/fcps/MiembrosList'

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
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
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

