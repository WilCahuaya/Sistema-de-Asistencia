'use client'

import { useState } from 'react'
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
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const isTutor = selectedRole?.role === 'tutor'
  const navigation = (!roleLoading && isTutor)
    ? allNavigation.filter(item => item.name !== 'Reportes')
    : allNavigation

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/80 hover:bg-accent hover:text-foreground'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </>
  )

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="truncate text-base font-bold sm:text-xl">Sistema de Asistencias</span>
            </Link>
            <div className="hidden md:flex md:gap-1">
              <NavLinks />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <UserMenu />
          </div>
        </div>
      </div>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent
          className="fixed inset-y-0 left-0 top-0 flex h-full w-[280px] max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-4 rounded-none border-r p-6 pt-12 sm:max-w-[280px]"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Menú de navegación</DialogTitle>
          </DialogHeader>
          <nav className="flex flex-col gap-1">
            <NavLinks />
          </nav>
        </DialogContent>
      </Dialog>
    </nav>
  )
}

