'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'

interface MobileAsistenciaDatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: string
  onDateChange: (date: string) => void
}

export function MobileAsistenciaDatePickerDialog({
  open,
  onOpenChange,
  selectedDate,
  onDateChange,
}: MobileAsistenciaDatePickerDialogProps) {
  const [tempDate, setTempDate] = React.useState(selectedDate)

  React.useEffect(() => {
    if (open) {
      setTempDate(selectedDate)
    }
  }, [open, selectedDate])

  const handleAceptar = () => {
    onDateChange(tempDate)
    onOpenChange(false)
  }

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>Seleccionar fecha</DialogTitle>
          <DialogDescription>
            Elige el día para registrar o ver las asistencias
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{formatDisplayDate(tempDate)}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile-date">Fecha</Label>
            <Input
              id="mobile-date"
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAceptar}>
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
