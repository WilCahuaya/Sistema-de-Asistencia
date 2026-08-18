'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

/** Redirige al login si no hay sesión, sin bloquear el pintado del layout. */
export function DashboardAuthRedirect() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/login')
    }
  }, [loading, user])

  return null
}
