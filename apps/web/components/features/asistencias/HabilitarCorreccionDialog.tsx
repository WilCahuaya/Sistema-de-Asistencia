'use client'

import { useState } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'
import { toast } from '@/lib/toast'

interface HabilitarCorreccionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
  fcpId: string
  anio: number
  mes: number
  mesLabel: string
}

const DIAS_OPCIONES = [3, 5, 7] as const

export function HabilitarCorreccionDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  anio,
  mes,
  mesLabel,
}: HabilitarCorreccionDialogProps) {
  const [dias, setDias] = useState<3 | 5 | 7>(5)
  const [loading, setLoading] = useState(false)
  const [loadingAnual, setLoadingAnual] = useState(false)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('habilitar_correccion_mes_anterior', {
        p_fcp_id: fcpId,
        p_dias: dias,
        p_anio: anio,
        p_mes: mes,
      })
      if (error) throw error
      const result = data as { ok?: boolean; error?: string }
      if (!result?.ok && result?.error) {
        throw new Error(result.error)
      }
      toast.success('Corrección habilitada', `Mes ${mesLabel} disponible para corrección.`)
      await onSuccess()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error('Error habilitando corrección:', e)
      toast.error('Error al habilitar corrección', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handlePermisoAnual = async () => {
    try {
      setLoadingAnual(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('habilitar_permiso_tardio_anual', {
        p_fcp_id: fcpId,
        p_dias: 15,
      })
      if (error) throw error
      const result = data as { ok?: boolean; error?: string; fecha_limite?: string }
      if (!result?.ok && result?.error) {
        throw new Error(result.error)
      }
      toast.success(
        'Permiso anual habilitado',
        `Ventana anual activada. Fecha límite: ${result?.fecha_limite ?? 'N/A'}.`
      )
      await onSuccess()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error('Error habilitando permiso anual:', e)
      toast.error('Error al habilitar permiso anual', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setLoadingAnual(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Habilitar corrección de {mesLabel}
          </DialogTitle>
          <DialogDescription>
            Permite al secretario de esta FCP registrar o corregir asistencias únicamente del mes{' '}
            <strong>{mesLabel}</strong>. Define el período en el que estará habilitada la corrección.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Período de corrección</Label>
            <RadioGroup
              value={String(dias)}
              onValueChange={(v) => setDias(Number(v) as 3 | 5 | 7)}
              className="flex gap-4"
            >
              {DIAS_OPCIONES.map((d) => (
                <div key={d} className="flex items-center space-x-2">
                  <RadioGroupItem value={String(d)} id={`dias-${d}`} />
                  <Label htmlFor={`dias-${d}`} className="font-normal cursor-pointer">
                    {d} días
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Permiso anual único</p>
            <p>
              Si la FCP empezó tarde, puedes habilitar una ventana excepcional para registro/corrección
              de meses pasados por 15 días. Solo se puede usar una vez por año.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || loadingAnual}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handlePermisoAnual} disabled={loading || loadingAnual}>
            {loadingAnual ? 'Habilitando anual...' : 'Habilitar permiso anual'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || loadingAnual}>
            {loading ? 'Habilitando…' : 'Habilitar corrección'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
