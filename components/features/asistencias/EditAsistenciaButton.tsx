'use client'

import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { useTutorPuedeRegistrarAula } from '@/hooks/useTutorPuedeRegistrarAula'
import { ReactNode } from 'react'

interface AsistenciaForEdit {
  fcp_id: string
  estudiante?: { aula_id?: string }
}

interface EditAsistenciaButtonProps {
  asistencia: AsistenciaForEdit
  onEdit: () => void
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  fallback?: ReactNode
  children?: ReactNode
}

/**
 * Botón de editar asistencia que solo se muestra cuando el usuario tiene permisos:
 * - Director o secretario siempre
 * - Tutor si tiene puede_registrar_asistencia para el aula del estudiante
 */
export function EditAsistenciaButton({
  asistencia,
  onEdit,
  variant = 'ghost',
  size = 'sm',
  fallback = <span className="text-sm text-muted-foreground">Solo lectura</span>,
  children,
}: EditAsistenciaButtonProps) {
  const { canEdit, role } = useUserRole(asistencia.fcp_id)
  const aulaId = asistencia.estudiante?.aula_id ?? null
  const { puedeRegistrar: tutorPuedeRegistrar } = useTutorPuedeRegistrarAula(asistencia.fcp_id, aulaId)

  const puedeEditar =
    (canEdit && (role === 'director' || role === 'secretario')) ||
    (role === 'tutor' && tutorPuedeRegistrar)

  if (!puedeEditar) {
    return <>{fallback}</>
  }

  return (
    <Button variant={variant} size={size} onClick={onEdit}>
      <Edit className={`h-4 w-4 ${children ? 'mr-1' : ''}`} />
      {children}
    </Button>
  )
}
