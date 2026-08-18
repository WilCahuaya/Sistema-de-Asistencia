'use client'

import { usePathname } from 'next/navigation'
import { DashboardNav } from '@/components/layout/DashboardNav'

const SIN_NAV = ['/pendiente', '/no-autorizado']

export function DashboardNavGate() {
  const pathname = usePathname()
  if (SIN_NAV.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))) {
    return null
  }
  return <DashboardNav />
}
