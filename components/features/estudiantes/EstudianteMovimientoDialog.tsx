'use client'

import { useState, useEffect } from 'react'
import { ensureAuthenticated } from '@/lib/supabase/auth-helpers'
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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getTodayInAppTimezone } from '@/lib/utils/dateUtils'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
  aula_id: string
  aula?: {
    nombre: string
  }
  fcp_id: string
}

interface EstudianteMovimientoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  estudiante: Estudiante | null
  aulas: Array<{ id: string; nombre: string }>
}

export function EstudianteMovimientoDialog({
  open,
  onOpenChange,
  onSuccess,
  estudiante,
  aulas,
}: EstudianteMovimientoDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAulaId, setSelectedAulaId] = useState<string>('')
  const [fechaCambio, setFechaCambio] = useState<string>(() => getTodayInAppTimezone())
  const [motivo, setMotivo] = useState<string>('')
  const [fechaCambioMin, setFechaCambioMin] = useState<string | null>(null)

  useEffect(() => {
    if (open && estudiante) {
      setSelectedAulaId('')
      setMotivo('')
      setFechaCambio(getTodayInAppTimezone())
      setFechaCambioMin(null)
      const aulasDisponibles = aulas.filter(a => a.id !== estudiante.aula_id)
      if (aulasDisponibles.length > 0) {
        setSelectedAulaId(aulasDisponibles[0].id)
      }
      ;(async () => {
        try {
          const auth = await ensureAuthenticated()
          if (!auth?.supabase) return
          const { data } = await auth.supabase
            .from('estudiante_periodos')
            .select('fecha_inicio')
            .eq('estudiante_id', estudiante.id)
            .is('fecha_fin', null)
            .single()
          if (data?.fecha_inicio) {
            const d = new Date(data.fecha_inicio + 'T12:00:00')
            d.setDate(d.getDate() + 1)
            setFechaCambioMin(d.toISOString().slice(0, 10))
          }
        } catch {
          // ignorar
        }
      })()
    }
  }, [open, estudiante, aulas])

  const onSubmit = async () => {
    if (!estudiante || !selectedAulaId) {
      toast.warning('Selecciona un aula', 'Por favor, selecciona un aula destino.')
      return
    }

    if (selectedAulaId === estudiante.aula_id) {
      toast.warning('Aula diferente', 'Debes seleccionar un aula diferente a la actual.')
      return
    }

    if (!fechaCambio) {
      toast.warning('Fecha de cambio', 'Indica desde qué fecha cambia de salón.')
      return
    }

    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      if (!authResult || !authResult.user) {
        toast.error('Sesión expirada', 'Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { user, supabase } = authResult

      // Obtener el período activo actual
      const { data: periodoActual } = await supabase
        .from('estudiante_periodos')
        .select('id')
        .eq('estudiante_id', estudiante.id)
        .is('fecha_fin', null)
        .single()

      const [y, m, d] = fechaCambio.split('-').map(Number)
      const fechaCambioDate = new Date(y, m - 1, d)
      fechaCambioDate.setDate(fechaCambioDate.getDate() - 1)
      const fechaFinStr = `${fechaCambioDate.getFullYear()}-${String(fechaCambioDate.getMonth() + 1).padStart(2, '0')}-${String(fechaCambioDate.getDate()).padStart(2, '0')}`

      if (periodoActual) {
        const { data: periodoWithInicio } = await supabase
          .from('estudiante_periodos')
          .select('fecha_inicio')
          .eq('id', periodoActual.id)
          .single()
        if (periodoWithInicio && fechaFinStr < periodoWithInicio.fecha_inicio) {
          toast.error(
            'Fecha inválida',
            `La fecha de cambio no puede ser anterior al inicio del período (${periodoWithInicio.fecha_inicio}).`
          )
          setLoading(false)
          return
        }
        const { error: updateErr } = await supabase
          .from('estudiante_periodos')
          .update({ fecha_fin: fechaFinStr, motivo_retiro: motivo || null })
          .eq('id', periodoActual.id)
        if (updateErr) throw updateErr
      } else {
        // Legacy: crear período cerrado para el aula actual.
        // inicioStr = primer día del mes que contiene fechaFinStr (para garantizar fecha_inicio <= fecha_fin)
        const [yF, mF] = fechaFinStr.split('-').map(Number)
        const inicioStr = `${yF}-${String(mF).padStart(2, '0')}-01`
        const { error: legacyErr } = await supabase.from('estudiante_periodos').insert({
          estudiante_id: estudiante.id,
          aula_id: estudiante.aula_id,
          fecha_inicio: inicioStr,
          fecha_fin: fechaFinStr,
          motivo_retiro: motivo || 'Cambio de salón',
          created_by: user.id,
        })
        if (legacyErr) throw legacyErr
      }

      // Crear nuevo período con el aula destino
      const { error: insertErr } = await supabase
        .from('estudiante_periodos')
        .insert({
          estudiante_id: estudiante.id,
          aula_id: selectedAulaId,
          fecha_inicio: fechaCambio,
          fecha_fin: null,
          created_by: user.id,
        })
      if (insertErr) throw insertErr

      toast.success('Cambio de salón registrado', 'El estudiante fue asignado al nuevo salón.')
      onSuccess()
      setSelectedAulaId('')
      setMotivo('')
    } catch (error: any) {
      console.error('Error moving estudiante:', error)
      const msg = error?.message || 'Intenta nuevamente.'
      if (error?.code === '23514' || msg.includes('chk_fecha_fin')) {
        toast.error('Fecha inválida', 'La fecha de cambio no puede ser anterior al inicio del período. Elige una fecha posterior.')
      } else {
        toast.error('Error al mover el estudiante', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedAulaId('')
      setMotivo('')
      onOpenChange(false)
    }
  }

  if (!estudiante) return null

  const aulasDisponibles = aulas.filter(a => a.id !== estudiante.aula_id)
  const aulaActual = aulas.find(a => a.id === estudiante.aula_id)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cambiar de Salón</DialogTitle>
          <DialogDescription>
            Registra el cambio de salón del estudiante. El histórico se conserva en su perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label className="mb-2 block">Estudiante:</Label>
            <div className="p-3 bg-muted border border-border rounded-md">
              <p className="font-medium text-foreground">{estudiante.nombre_completo}</p>
              <p className="text-sm text-muted-foreground font-mono">{estudiante.codigo}</p>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Aula Actual:</Label>
            <div className="p-3 bg-muted border border-border rounded-md">
              <p className="font-medium text-foreground">{aulaActual?.nombre || 'Sin aula'}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="fecha_cambio" className="mb-2 block">¿Desde qué fecha cambia?</Label>
            <Input
              id="fecha_cambio"
              type="date"
              value={fechaCambio}
              min={fechaCambioMin ?? undefined}
              onChange={(e) => setFechaCambio(e.target.value)}
              title={fechaCambioMin ? `Debe ser al menos un día después del inicio (${fechaCambioMin})` : undefined}
            />
          </div>
          <div>
            <Label htmlFor="aula-destino" className="mb-2 block">
              Nuevo Salón: <span className="text-red-500">*</span>
            </Label>
            {aulasDisponibles.length === 0 ? (
              <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">No hay otras aulas disponibles</p>
                    <p className="mt-1">Necesitas crear otra aula para poder mover estudiantes.</p>
                  </div>
                </div>
              </div>
            ) : (
              <Select value={selectedAulaId} onValueChange={setSelectedAulaId}>
                <SelectTrigger id="aula-destino" className="w-full">
                  <SelectValue placeholder="Selecciona un aula" />
                </SelectTrigger>
                <SelectContent>
                  {aulasDisponibles.map((aula) => (
                    <SelectItem key={aula.id} value={aula.id}>
                      {aula.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="motivo">Motivo (opcional):</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Razón del movimiento del estudiante..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || !selectedAulaId || aulasDisponibles.length === 0}
          >
            {loading ? (
              <>
                <ArrowRight className="mr-2 h-4 w-4 animate-pulse" />
                Moviendo...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Confirmar Cambio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

