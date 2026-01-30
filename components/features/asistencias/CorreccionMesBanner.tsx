'use client'

import { AlertCircle, CheckCircle2, Lock } from 'lucide-react'
import type { EstadoCorreccionMes } from '@/hooks/useCorreccionMes'
import { cn } from '@/lib/utils'

interface CorreccionMesBannerProps {
  estado: EstadoCorreccionMes
  habilitadoPorNombre: string | null
  fechaLimite: string | null
  mesLabel: string
  esFacilitador?: boolean
  className?: string
}

function formatFecha(s: string | null): string {
  if (!s) return ''
  try {
    const d = new Date(s + 'T12:00:00')
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return s
  }
}

export function CorreccionMesBanner({
  estado,
  habilitadoPorNombre,
  fechaLimite,
  mesLabel,
  esFacilitador = false,
  className,
}: CorreccionMesBannerProps) {
  if (estado === 'cerrado') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30',
          className
        )}
      >
        <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <span className="text-amber-800 dark:text-amber-200">
          {esFacilitador ? (
            <>
              <strong>Mes cerrado.</strong> Las asistencias de {mesLabel} están en solo lectura. Puedes habilitar la corrección del mes anterior para que el secretario registre o corrija asistencias; usa el botón &quot;Habilitar corrección&quot;.
            </>
          ) : (
            <>
              <strong>Mes cerrado.</strong> Las asistencias de {mesLabel} están en solo lectura. El facilitador puede habilitar la corrección del mes anterior.
            </>
          )}
        </span>
      </div>
    )
  }

  if (estado === 'correccion_habilitada') {
    return (
      <div
        className={cn(
          'flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
          <span className="font-medium text-emerald-800 dark:text-emerald-200">
            Corrección habilitada para {mesLabel}
          </span>
        </div>
        <div className="ml-6 text-emerald-700 dark:text-emerald-300">
          {habilitadoPorNombre && (
            <span>Habilitado por: {habilitadoPorNombre}. </span>
          )}
          {fechaLimite && (
            <span>Fecha límite para realizar cambios: {formatFecha(fechaLimite)}.</span>
          )}
        </div>
      </div>
    )
  }

  if (estado === 'bloqueado') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="text-slate-700 dark:text-slate-300">
          <strong>Período de corrección finalizado.</strong>{' '}
          Las asistencias de {mesLabel} vuelven a estar bloqueadas.
          {habilitadoPorNombre && ` La corrección fue habilitada por ${habilitadoPorNombre}.`}
        </span>
      </div>
    )
  }

  return null
}
