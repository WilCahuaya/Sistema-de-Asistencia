import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ONGList } from '@/components/features/ongs/ONGList'

export default async function ONGsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Gestión de ONGs
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Administra las Organizaciones No Gubernamentales
        </p>
      </div>

      <ONGList />
    </div>
  )
}

