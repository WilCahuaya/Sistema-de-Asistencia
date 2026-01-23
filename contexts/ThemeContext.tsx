'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'blue' | 'green' | 'purple' | 'gray' | 'dark-blue' | 'dark-green' | 'dark-purple'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'app-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inicializar con tema guardado o azul por defecto
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
      const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
      if (savedTheme && validThemes.includes(savedTheme)) {
        return savedTheme
      }
    }
    return 'blue'
  })
  const [mounted, setMounted] = useState(false)

  // Aplicar tema inicial al HTML antes del primer render
  useEffect(() => {
    const root = document.documentElement
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
    const initialTheme = (savedTheme && validThemes.includes(savedTheme)) 
      ? savedTheme 
      : 'blue'
    
    // Remover todos los temas anteriores
    root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple')
    // Aplicar el tema inicial inmediatamente
    root.classList.add(`theme-${initialTheme}`)
    
    // Sincronizar el estado
    if (initialTheme !== theme) {
      setThemeState(initialTheme)
    }
    
    setMounted(true)
  }, [])

  // Aplicar tema al HTML cuando cambia
  useEffect(() => {
    if (!mounted) return
    
    const root = document.documentElement
    // Remover todos los temas anteriores
    root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple')
    // Aplicar el tema actual inmediatamente
    root.classList.add(`theme-${theme}`)
    
    // Guardar en localStorage
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (e) {
      console.error('Error saving theme to localStorage:', e)
    }
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  // No renderizar hasta que esté montado para evitar flash de contenido
  if (!mounted) {
    return <>{children}</>
  }

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

