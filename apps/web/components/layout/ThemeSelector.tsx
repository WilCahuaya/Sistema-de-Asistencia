'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Palette, Check } from 'lucide-react'

const themes = [
  {
    value: 'blue' as const,
    label: 'Azul',
    description: 'Profesional y educativo',
    color: 'bg-blue-500',
  },
  {
    value: 'green' as const,
    label: 'Verde',
    description: 'Natural y crecimiento',
    color: 'bg-green-500',
  },
  {
    value: 'purple' as const,
    label: 'Púrpura',
    description: 'Creativo e innovador',
    color: 'bg-purple-500',
  },
  {
    value: 'gray' as const,
    label: 'Gris',
    description: 'Neutro y elegante',
    color: 'bg-gray-500',
  },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: typeof theme) => {
    setTheme(newTheme)
    // Forzar actualización inmediata
    const root = document.documentElement
    root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray')
    root.classList.add(`theme-${newTheme}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          aria-label="Cambiar tema"
        >
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Seleccionar tema
        </div>
        {themes.map((themeOption) => (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

