'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingConCerrarSesion } from '@/components/layout/LoadingConCerrarSesion'

const SLOW_MS = 4000

/** Si la sesión inicial no resuelve, cubre la pantalla y permite cerrar sesión. */
export function CargaLentaOverlay() {
  const pathname = usePathname()
  const { loading } = useAuth()
  const [lento, setLento] = useState(false)

  useEffect(() => {
    if (!loading) {
      setLento(false)
      return
    }
    const timeoutId = window.setTimeout(() => setLento(true), SLOW_MS)
    return () => window.clearTimeout(timeoutId)
  }, [loading])

  if (pathname.startsWith('/login')) return null
  if (!loading || !lento) return null

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      <LoadingConCerrarSesion mensaje="Verificando sesión…" />
    </div>
  )
}
