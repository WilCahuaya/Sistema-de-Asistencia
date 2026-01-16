'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Home,
  Building2,
  Users,
  GraduationCap,
  ClipboardList,
  BarChart3,
  LogOut,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'ONGs', href: '/ongs', icon: Building2 },
  { name: 'Aulas', href: '/aulas', icon: Users },
  { name: 'Estudiantes', href: '/estudiantes', icon: GraduationCap },
  { name: 'Asistencias', href: '/asistencias', icon: ClipboardList },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
]

export function DashboardNav() {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
      setSigningOut(false)
    }
  }

  return (
    <nav className="border-b bg-white dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Sistema de Asistencias</span>
            </Link>
            <div className="hidden space-x-4 md:flex">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={handleSignOut} 
            disabled={signingOut}
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>{signingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
          </Button>
        </div>
      </div>
    </nav>
  )
}

