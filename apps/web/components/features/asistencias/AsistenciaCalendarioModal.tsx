'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react'

interface DayInfo {
  day: number
  date: Date
  dayName: string
  fechaStr: string
}

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface AsistenciaCalendarioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  estudiante: Estudiante
  daysInMonth: DayInfo[]
  monthLabel: string
  getEstado: (estudianteId: string, fechaStr: string) => 'presente' | 'falto' | 'permiso' | null
  onDayTap: (estudianteId: string, fechaStr: string) => void
  isSaving: (estudianteId: string, fechaStr: string) => boolean
  puedeEditar: boolean
}

export function AsistenciaCalendarioModal({
  open,
  onOpenChange,
  estudiante,
  daysInMonth,
  monthLabel,
  getEstado,
  onDayTap,
  isSaving,
  puedeEditar,
}: AsistenciaCalendarioModalProps) {
  const getEstadoIcon = (estado: 'presente' | 'falto' | 'permiso' | null, saving: boolean) => {
    if (saving) return <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
    switch (estado) {
      case 'presente':
        return <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
      case 'falto':
        return <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
      case 'permiso':
        return <Clock className="h-6 w-6 text-amber-500" />
      default:
        return <div className="h-6 w-6 rounded border-2 border-dashed border-muted-foreground/40" />
    }
  }

  // Agrupar días por semana (7 columnas)
  const weeks: DayInfo[][] = []
  let week: DayInfo[] = []
  const firstDay = daysInMonth[0]?.date.getDay() ?? 0
  for (let i = 0; i < firstDay; i++) {
    week.push({ day: 0, date: new Date(0), dayName: '', fechaStr: '' })
  }
  daysInMonth.forEach((d) => {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  })
  if (week.length > 0) {
    while (week.length < 7) week.push({ day: 0, date: new Date(0), dayName: '', fechaStr: '' })
    weeks.push(week)
  }

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:p-6 w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            {estudiante.nombre_completo}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">{monthLabel}</p>
        <p className="text-xs text-muted-foreground mb-3">
          {puedeEditar
            ? 'Toca cada día para marcar: presente → faltó → permiso → presente'
            : 'Solo lectura'}
        </p>
        <div className="overflow-x-auto">
          <div className="min-w-[280px]">
            {/* Encabezado días de la semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>
            {/* Días del mes */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((dayInfo, di) => {
                  if (dayInfo.day === 0) {
                    return <div key={di} className="aspect-square" />
                  }
                  const estado = getEstado(estudiante.id, dayInfo.fechaStr)
                  const saving = isSaving(estudiante.id, dayInfo.fechaStr)
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => puedeEditar && onDayTap(estudiante.id, dayInfo.fechaStr)}
                      disabled={!puedeEditar}
                      className={`aspect-square min-w-[36px] flex items-center justify-center rounded-lg transition-colors touch-manipulation ${
                        puedeEditar
                          ? 'active:scale-95 hover:bg-accent/50'
                          : 'cursor-default opacity-80'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-medium">{dayInfo.day}</span>
                        {getEstadoIcon(estado, saving)}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Presente
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-600" /> Faltó
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-amber-500" /> Permiso
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
