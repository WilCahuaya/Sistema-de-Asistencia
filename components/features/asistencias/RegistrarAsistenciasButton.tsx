'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { useTutorPuedeRegistrarAula } from '@/hooks/useTutorPuedeRegistrarAula'

interface RegistrarAsistenciasButtonProps {
  fcpId: string | null
  aulaId: string | null
  onRegistrar: () => void
}

/**
 * Botón para abrir el diálogo de registro de asistencias.
 * Visible para: director, secretario, o tutor con puede_registrar en el aula seleccionada.
 */
export function RegistrarAsistenciasButton({
  fcpId,
  aulaId,
  onRegistrar,
}: RegistrarAsistenciasButtonProps) {
  const { canEdit, role } = useUserRole(fcpId)
  const { puedeRegistrar: tutorPuedeRegistrar } = useTutorPuedeRegistrarAula(fcpId, aulaId)

  const puedeRegistrar =
    (canEdit && (role === 'director' || role === 'secretario')) ||
    (role === 'tutor' && tutorPuedeRegistrar)

  if (!puedeRegistrar) {
    return null
  }

  return (
    <Button
      onClick={onRegistrar}
      disabled={!fcpId || !aulaId}
      className="w-full"
    >
      <Calendar className="mr-2 h-4 w-4" />
      Registrar Asistencias
    </Button>
  )
}
