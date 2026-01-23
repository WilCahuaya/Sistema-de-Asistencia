'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useFCP } from '@/contexts/FCPContext'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FCPSelector } from '@/components/features/fcps/FCPSelector'
import { UserMenu } from '@/components/layout/UserMenu'
import {
  Home,
  Building2,
  Users,
  GraduationCap,
  ClipboardList,
  BarChart3,
} from 'lucide-react'

const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'FCPs', href: '/fcps', icon: Building2 },
  { name: 'Aulas', href: '/aulas', icon: Users },
  { name: 'Estudiantes', href: '/estudiantes', icon: GraduationCap },
  { name: 'Asistencias', href: '/asistencias', icon: ClipboardList },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
]

export function DashboardNav() {
  const pathname = usePathname()
  const { userFCPs } = useFCP()
  const [isTutor, setIsTutor] = useState(false)

  useEffect(() => {
    checkIfTutor()
  }, [])

  const checkIfTutor = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: tutorData, error: tutorError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'tutor')
        .eq('activo', true)
        .limit(1)

      if (!tutorError && tutorData && tutorData.length > 0) {
        setIsTutor(true)
      }
    } catch (error) {
      console.error('Error checking tutor role:', error)
    }
  }

  // Filtrar navegación: ocultar "Reportes" para tutores
  const navigation = isTutor
    ? allNavigation.filter(item => item.name !== 'Reportes')
    : allNavigation

  return (
    <nav className="border-b bg-background">
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
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userFCPs.length > 1 && <FCPSelector />}
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}

