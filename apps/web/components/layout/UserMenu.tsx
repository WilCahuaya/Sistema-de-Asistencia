'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { createClient } from '@/lib/supabase/client'
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
import { Badge } from '@/components/ui/badge'
import { MoreVertical, LogOut, Palette, Check, User, Building2, Shield, Mail, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

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

const roleLabels: Record<string, string> = {
  director: 'Director',
  secretario: 'Secretario',
  tutor: 'Tutor',
  facilitador: 'Facilitador',
}

const roleColors: Record<string, string> = {
  director: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700',
  secretario: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700',
  tutor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700',
  facilitador: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700',
}

const roleIcons: Record<string, string> = {
  director: '👔',
  secretario: '📋',
  tutor: '👨‍🏫',
  facilitador: '🌐',
}

export function UserMenu() {
  const { signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { selectedRole, loading: roleLoading } = useSelectedRole()
  const [signingOut, setSigningOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [userInfo, setUserInfo] = useState<{
    nombre: string
    email: string
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          return
        }

        // Intentar obtener información del usuario desde public.usuarios
        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('nombre_completo, email')
          .eq('id', user.id)
          .maybeSingle()

        if (usuarioData) {
          setUserInfo({
            nombre: usuarioData.nombre_completo || user.email || 'Usuario',
            email: usuarioData.email || user.email || '',
          })
        } else {
          // Fallback a información de auth.users
          setUserInfo({
            nombre: user.user_metadata?.full_name || user.email || 'Usuario',
            email: user.email || '',
          })
        }
      } catch (error) {
        console.error('Error loading user info:', error)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserInfo({
            nombre: user.email || 'Usuario',
            email: user.email || '',
          })
        }
      }
    }

    loadUserInfo()
  }, [])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
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
      <DropdownMenuContent align="end" className="w-72">
        {/* Información del usuario */}
        {userInfo && selectedRole && (
          <>
            <div className="px-2 py-3 space-y-2">
              {/* Nombre y Avatar */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {userInfo.nombre}
                  </span>
                  <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {userInfo.email}
                  </span>
                </div>
              </div>

              {/* Rol */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <Badge 
                  variant="outline" 
                  className={cn("text-xs font-medium border shrink-0", roleColors[selectedRole.role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200')}
                >
                  <span className="mr-1">{roleIcons[selectedRole.role] || '👤'}</span>
                  {roleLabels[selectedRole.role] || selectedRole.role}
                </Badge>
              </div>

              {/* FCP */}
              {selectedRole.fcp && (
                <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0 flex-1">
                    {selectedRole.fcp.numero_identificacion && (
                      <span className="text-xs font-semibold text-foreground">
                        {selectedRole.fcp.numero_identificacion}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedRole.fcp.razon_social || 'Sin FCP seleccionada'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel>Opciones</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Cambiar rol: misma sesión, cambia contexto de permisos y datos */}
        <DropdownMenuItem asChild>
          <Link href="/seleccionar-rol" className="cursor-pointer flex items-center">
            <RefreshCw className="mr-2 h-4 w-4" />
            Cambiar rol
          </Link>
        </DropdownMenuItem>

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
