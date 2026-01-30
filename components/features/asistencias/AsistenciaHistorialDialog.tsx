'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Calendar, Edit, Clock } from 'lucide-react'
import { getRolDisplayName, getRolBadgeColor } from '@/lib/utils/roles'

interface AsistenciaHistorial {
  id: string
  fecha: string
  estado: 'presente' | 'falto' | 'permiso'
  estudiante?: {
    codigo: string
    nombre_completo: string
  }
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
  // Campos de auditoría directos (guardados en la BD)
  created_by_nombre?: string | null
  created_by_email?: string | null
  created_by_rol?: string | null
  updated_by_nombre?: string | null
  updated_by_email?: string | null
  updated_by_rol?: string | null
  registro_tardio?: boolean
  fcp_id?: string
  // Campos legacy (para compatibilidad)
  creador?: {
    email?: string
    nombre_completo?: string
    rol?: string | null
  } | null
  editor?: {
    email?: string
    nombre_completo?: string
    rol?: string | null
  } | null
}

interface AsistenciaHistorialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asistencia: AsistenciaHistorial | null
}

export function AsistenciaHistorialDialog({
  open,
  onOpenChange,
  asistencia,
}: AsistenciaHistorialDialogProps) {
  if (!asistencia) return null

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible'
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'presente':
        return 'Presente'
      case 'falto':
        return 'Faltó'
      case 'permiso':
        return 'Permiso'
      default:
        return estado
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Historial de Asistencia</DialogTitle>
          <DialogDescription>
            Información de auditoría del registro de asistencia
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Información del estudiante */}
          {asistencia.estudiante && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Estudiante</p>
                  <p className="text-base font-semibold">{asistencia.estudiante.nombre_completo}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    Código: {asistencia.estudiante.codigo}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información de la fecha */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                </div>
                <p className="text-base">
                  {new Date(asistencia.fecha).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    Estado: <span className="font-semibold">{getEstadoLabel(asistencia.estado)}</span>
                  </p>
                  {asistencia.registro_tardio && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 text-xs">
                      Registro tardío
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de quién registró */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Registrado por</p>
                </div>
                {asistencia.created_by ? (
                  (asistencia.created_by_nombre || asistencia.created_by_email || asistencia.creador) ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold">
                          {asistencia.created_by_nombre || asistencia.creador?.nombre_completo || 'Usuario sin nombre'}
                        </p>
                        {(asistencia.created_by_rol || asistencia.creador?.rol) && (
                          <Badge className={getRolBadgeColor((asistencia.created_by_rol || asistencia.creador?.rol) as any)}>
                            {getRolDisplayName((asistencia.created_by_rol || asistencia.creador?.rol) as any)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {asistencia.created_by_email || asistencia.creador?.email || 'No disponible'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {formatDate(asistencia.created_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground italic">
                        Usuario ID: {asistencia.created_by.substring(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        (No se encontró información del usuario en la base de datos)
                      </p>
                      {asistencia.created_at && (
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {formatDate(asistencia.created_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground italic">
                      No disponible
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Esta asistencia fue creada antes de implementar el historial de auditoría.
                    </p>
                    {asistencia.created_at && (
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Fecha de creación: {formatDate(asistencia.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Información de quién editó (solo si fue editado) */}
          {asistencia.updated_by && asistencia.updated_by !== asistencia.created_by && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Última edición por</p>
                  </div>
                  {(asistencia.updated_by_nombre || asistencia.updated_by_email || asistencia.editor) ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold">
                          {asistencia.updated_by_nombre || asistencia.editor?.nombre_completo || 'Usuario sin nombre'}
                        </p>
                        {(asistencia.updated_by_rol || asistencia.editor?.rol) && (
                          <Badge className={getRolBadgeColor((asistencia.updated_by_rol || asistencia.editor?.rol) as any)}>
                            {getRolDisplayName((asistencia.updated_by_rol || asistencia.editor?.rol) as any)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {asistencia.updated_by_email || asistencia.editor?.email || 'No disponible'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {formatDate(asistencia.updated_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No disponible
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

