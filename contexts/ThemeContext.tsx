'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type Theme = 'blue' | 'green' | 'purple' | 'gray' | 'dark-blue' | 'dark-green' | 'dark-purple'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_GUEST = 'app-theme'
const THEME_STORAGE_USER_PREFIX = 'app-theme-user-'
const VALID_THEMES: Theme[] = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']

function getStorageKey(userId: string | undefined): string {
  return userId ? `${THEME_STORAGE_USER_PREFIX}${userId}` : THEME_STORAGE_GUEST
}

function loadTheme(key: string): Theme {
  if (typeof window === 'undefined') return 'blue'
  try {
    const saved = localStorage.getItem(key) as Theme | null
    return (saved && VALID_THEMES.includes(saved)) ? saved : 'blue'
  } catch {
    return 'blue'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const storageKey = getStorageKey(userId)

  const [theme, setThemeState] = useState<Theme>(() => loadTheme(THEME_STORAGE_GUEST))
  const [mounted, setMounted] = useState(false)

  const applyToDom = useCallback((t: Theme) => {
    // No cambiar el tema si estamos en la página de login (siempre debe ser azul)
    if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname.startsWith('/login'))) {
      const root = document.documentElement
      root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple')
      root.classList.add('theme-blue')
      return
    }
    const root = document.documentElement
    root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple')
    root.classList.add(`theme-${t}`)
  }, [])

  // Al montar o al cambiar usuario: cargar tema del usuario (o invitado) y aplicarlo
  useEffect(() => {
    const key = getStorageKey(userId)
    let t: Theme
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (raw && VALID_THEMES.includes(raw as Theme)) {
        t = raw as Theme
      } else if (userId && raw === null) {
        const guest = loadTheme(THEME_STORAGE_GUEST)
        if (guest !== 'blue' && VALID_THEMES.includes(guest)) {
          try {
            localStorage.setItem(key, guest)
            t = guest
          } catch {
            t = 'blue'
          }
        } else {
          t = 'blue'
        }
      } else {
        t = loadTheme(key)
      }
    } catch {
      t = 'blue'
    }
    setThemeState(t)
    applyToDom(t)
    setMounted(true)
  }, [userId, applyToDom])

  // Aplicar y persistir cuando cambia el tema
  useEffect(() => {
    if (!mounted) return
    // No aplicar cambios de tema si estamos en login
    if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname.startsWith('/login'))) {
      return
    }
    applyToDom(theme)
    try {
      localStorage.setItem(storageKey, theme)
    } catch (e) {
      console.error('Error saving theme to localStorage:', e)
    }
  }, [theme, mounted, storageKey, applyToDom])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

