'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, AlertCircle, Users } from 'lucide-react'
import { toast } from '@/lib/toast'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: { nombre: string }
  fcp_id: string
}

interface EstudianteMovimientoMasivoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiantes: Estudiante[]
  aulas: Array<{ id: string; nombre: string; codigo_aula?: string; tutor_display?: string | null }>
}

export function EstudianteMovimientoMasivoDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiantes,
  aulas,
}: EstudianteMovimientoMasivoDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAulaId, setSelectedAulaId] = useState<string>('')

  // Aulas destino: excluir las que tienen todos los seleccionados (al menos una diferente)
  const aulasDestino = aulas.filter((a) => {
    const algunoEnOtra = estudiantes.some((e) => e.aula_id !== a.id)
    return algunoEnOtra
  })

  useEffect(() => {
    if (open && estudiantes.length > 0 && aulas.length > 0) {
      const destinos = aulas.filter((a) => estudiantes.some((e) => e.aula_id !== a.id))
      setSelectedAulaId(destinos[0]?.id || '')
    }
  }, [open, estudiantes, aulas])

  const onSubmit = async () => {
    if (!selectedAulaId || estudiantes.length === 0) {
      toast.warning('Configuración', 'Selecciona el salón destino.')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/estudiantes/mover-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudianteIds: estudiantes.map((e) => e.id),
          aulaDestinoId: selectedAulaId,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error('Error al mover', data.error || res.statusText)
        return
      }

      toast.success(
        'Movimiento masivo completado',
        data.message || `Se movieron ${data.movidos ?? 0} estudiante(s).`
      )
      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo completar.'
      toast.error('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedAulaId('')
      onOpenChange(false)
    }
  }

  if (estudiantes.length === 0) return null

  const aulaDestino = aulas.find((a) => a.id === selectedAulaId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mover alumnos a nuevo salón
          </DialogTitle>
          <DialogDescription>
            Los {estudiantes.length} estudiante(s) seleccionado(s) cambiarán de salón este mes. El histórico se
            conserva en cada perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label className="mb-2 block">Estudiantes seleccionados ({estudiantes.length}):</Label>
            <div className="h-[120px] overflow-y-auto rounded-md border border-border p-3">
              <ul className="space-y-1 text-sm">
                {estudiantes.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{e.nombre_completo}</span>
                    <span className="text-muted-foreground font-mono shrink-0">{e.codigo}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <Label htmlFor="aula-destino-masivo" className="mb-2 block">
              Nuevo salón destino: <span className="text-red-500">*</span>
            </Label>
            {aulasDestino.length === 0 ? (
              <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">No hay otros salones disponibles</p>
                    <p className="mt-1">Crea más aulas para poder mover estudiantes entre salones.</p>
                  </div>
                </div>
              </div>
            ) : (
              <Select value={selectedAulaId} onValueChange={setSelectedAulaId}>
                <SelectTrigger id="aula-destino-masivo" className="w-full">
                  <SelectValue placeholder="Selecciona el salón destino" />
                </SelectTrigger>
                <SelectContent>
                  {aulasDestino.map((aula) => (
                    <SelectItem key={aula.id} value={aula.id}>
                      {aula.nombre} | {aula.tutor_display || 'Sin tutor'}
                      {aula.codigo_aula ? ` | ${aula.codigo_aula}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedAulaId && aulaDestino && (
            <p className="text-sm text-muted-foreground">
              Todos los estudiantes se moverán a <strong>{aulaDestino.nombre}</strong>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || !selectedAulaId || aulasDestino.length === 0}
          >
            {loading ? (
              <>
                <ArrowRight className="mr-2 h-4 w-4 animate-pulse" />
                Moviendo...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Mover {estudiantes.length} alumno(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
