'use client'

import { useEffect, useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'

const LOGOUT_HINT_MS = 4000
const SIGNOUT_TIMEOUT_MS = 2500

async function cerrarSesionYReiniciar() {
  try {
    localStorage.removeItem('selectedRoleId')
    localStorage.removeItem('selectedRole')
    localStorage.removeItem('selectedFcpId')
  } catch {
    /* ignorar errores de localStorage */
  }

  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim()
    if (!name) return
    const debeBorrar =
      name.startsWith('sb-') ||
      name.startsWith('selectedRole') ||
      name === 'selectedFcpId'
    if (!debeBorrar) return
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), SIGNOUT_TIMEOUT_MS)
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      signal: controller.signal,
    })
  } catch {
    /* Continuar al login aunque el servidor no responda */
  } finally {
    window.clearTimeout(timeoutId)
  }

  window.location.replace('/login?logout=true')
}

export function LoadingConCerrarSesion({
  mensaje = 'Cargando…',
}: {
  mensaje?: string
}) {
  const [lento, setLento] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setLento(true), LOGOUT_HINT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const handleCerrarSesion = () => {
    if (cerrando) return
    setCerrando(true)
    void cerrarSesionYReiniciar()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-center">
        {lento ? 'Está tardando más de lo normal.' : mensaje}
      </p>
      <button
        type="button"
        onClick={handleCerrarSesion}
        disabled={cerrando}
        className={`group inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-60 ${
          lento
            ? 'border-primary/50 bg-primary/10 text-primary shadow-md shadow-primary/10'
            : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary'
        }`}
      >
        {cerrando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        )}
        <span>{cerrando ? 'Cerrando sesión…' : 'Cerrar sesión e iniciar de nuevo'}</span>
      </button>
    </div>
  )
}
