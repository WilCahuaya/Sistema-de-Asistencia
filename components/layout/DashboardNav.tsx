'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
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
  const { selectedRole, loading: roleLoading } = useSelectedRole()
  
  // Usar el rol seleccionado para determinar qué opciones mostrar
  const isTutor = selectedRole?.role === 'tutor'
  const isDirector = selectedRole?.role === 'director'
  const isSecretario = selectedRole?.role === 'secretario'
  const isFacilitador = selectedRole?.role === 'facilitador'
  
  console.log('🧭 [DashboardNav] Navegación actualizada:', {
    rolSeleccionado: selectedRole?.role,
    roleLoading,
    isTutor,
    isDirector,
    isSecretario,
    isFacilitador,
    mostrarReportes: !isTutor,
    selectedRoleCompleto: selectedRole
  })

  // Filtrar navegación: ocultar "Reportes" solo para tutores
  // Directores, Secretarios y Facilitadores pueden ver reportes
  // Si el rol aún se está cargando, mostrar todas las opciones por defecto
  const navigation = (!roleLoading && isTutor)
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
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}

