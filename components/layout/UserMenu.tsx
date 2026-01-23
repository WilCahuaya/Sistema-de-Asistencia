'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, LogOut, Palette, Check } from 'lucide-react'

const themes = [
  {
    value: 'blue' as const,
    label: 'Azul',
    description: 'Profesional y educativo',
    color: 'bg-blue-500',
    category: 'claro',
  },
  {
    value: 'green' as const,
    label: 'Verde',
    description: 'Natural y crecimiento',
    color: 'bg-green-500',
    category: 'claro',
  },
  {
    value: 'purple' as const,
    label: 'Púrpura',
    description: 'Creativo e innovador',
    color: 'bg-purple-500',
    category: 'claro',
  },
  {
    value: 'gray' as const,
    label: 'Gris',
    description: 'Neutro y elegante',
    color: 'bg-gray-500',
    category: 'claro',
  },
  {
    value: 'dark-blue' as const,
    label: 'Azul Oscuro',
    description: 'Profesional y moderno',
    color: 'bg-blue-700',
    category: 'oscuro',
  },
  {
    value: 'dark-green' as const,
    label: 'Verde Oscuro',
    description: 'Natural y relajante',
    color: 'bg-green-700',
    category: 'oscuro',
  },
  {
    value: 'dark-purple' as const,
    label: 'Púrpura Oscuro',
    description: 'Elegante y sofisticado',
    color: 'bg-purple-700',
    category: 'oscuro',
  },
]

type Theme = typeof themes[number]['value']

export function UserMenu() {
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'blue'
    const savedTheme = localStorage.getItem('app-theme') as Theme | null
    const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
    return (savedTheme && validThemes.includes(savedTheme)) ? savedTheme : 'blue'
  })

  useEffect(() => {
    setMounted(true)
    // Intentar obtener el tema del contexto si está disponible
    try {
      // Dynamic import para evitar errores en SSR
      import('@/contexts/ThemeContext').then(({ useTheme }) => {
        try {
          const themeContext = useTheme()
          setThemeState(themeContext.theme)
        } catch {
          // Si no está disponible, usar localStorage
          const savedTheme = localStorage.getItem('app-theme') as Theme | null
          const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
          if (savedTheme && validThemes.includes(savedTheme)) {
            setThemeState(savedTheme)
          }
        }
      }).catch(() => {
        // Si el módulo no está disponible, usar localStorage
        const savedTheme = localStorage.getItem('app-theme') as Theme | null
        const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
        if (savedTheme && validThemes.includes(savedTheme)) {
          setThemeState(savedTheme)
        }
      })
    } catch {
      // Fallback a localStorage
      const savedTheme = localStorage.getItem('app-theme') as Theme | null
      const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
      if (savedTheme && validThemes.includes(savedTheme)) {
        setThemeState(savedTheme)
      }
    }
  }, [])

  const handleThemeChange = (newTheme: Theme) => {
    setThemeState(newTheme)
    // Forzar actualización inmediata
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple')
      root.classList.add(`theme-${newTheme}`)
      localStorage.setItem('app-theme', newTheme)
      
      // Intentar actualizar el contexto si está disponible
      try {
        import('@/contexts/ThemeContext').then(({ useTheme }) => {
          try {
            const themeContext = useTheme()
            themeContext.setTheme(newTheme)
          } catch {
            // Ignorar si no está disponible
          }
        }).catch(() => {
          // Ignorar si el módulo no está disponible
        })
      } catch {
        // Ignorar errores
      }
    }
  }

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
      setSigningOut(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Menú de usuario"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Opciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Selector de tema */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Tema</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[400px] overflow-y-auto">
            {/* Temas claros */}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
              Temas Claros
            </div>
            {themes.filter(t => t.category === 'claro').map((themeOption) => (
              <DropdownMenuItem
                key={themeOption.value}
                onClick={() => handleThemeChange(themeOption.value)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full ${themeOption.color} border-2 ${
                      theme === themeOption.value
                        ? 'border-foreground'
                        : 'border-transparent'
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{themeOption.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {themeOption.description}
                    </span>
                  </div>
                </div>
                {theme === themeOption.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            {/* Separador */}
            <div className="h-px bg-border my-1 mx-2" />
            {/* Temas oscuros */}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
              Temas Oscuros
            </div>
            {themes.filter(t => t.category === 'oscuro').map((themeOption) => (
              <DropdownMenuItem
                key={themeOption.value}
                onClick={() => handleThemeChange(themeOption.value)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full ${themeOption.color} border-2 ${
                      theme === themeOption.value
                        ? 'border-foreground'
                        : 'border-transparent'
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{themeOption.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {themeOption.description}
                    </span>
                  </div>
                </div>
                {theme === themeOption.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        
        {/* Cerrar sesión */}
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{signingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
