import { DashboardAuthRedirect } from '@/components/layout/DashboardAuthRedirect'
import { DashboardNavGate } from '@/components/layout/DashboardNavGate'
import { RoleLogger } from '@/components/debug/RoleLogger'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardAuthRedirect />
      <RoleLogger />
      <DashboardNavGate />
      <main>{children}</main>
    </div>
  )
}

