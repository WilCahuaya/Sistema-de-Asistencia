'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/lib/toast'
import { ClipboardCheck } from 'lucide-react'

interface TutorAulaRow {
  id: string
  fcp_miembro_id: string
  puede_registrar_asistencia: boolean
  displayName: string
}

interface HabilitarRegistroTutoresDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  aulaId: string
  aulaNombre: string
  fcpId: string
}

export function HabilitarRegistroTutoresDialog({
  open,
  onOpenChange,
  onSuccess,
  aulaId,
  aulaNombre,
  fcpId,
}: HabilitarRegistroTutoresDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tutores, setTutores] = useState<TutorAulaRow[]>([])
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  useEffect(() => {
    if (open && fcpId && aulaId) {
      loadTutores()
    } else if (!open) {
      setTutores([])
      setChecks({})
      setError(null)
    }
  }, [open, fcpId, aulaId])

  const loadTutores = async () => {
    setLoadingData(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('tutor_aula')
        .select(`
          id,
          fcp_miembro_id,
          puede_registrar_asistencia,
          fcp_miembro:fcp_miembros!inner(
            nombre_display,
            email_pendiente,
            usuario:usuarios(id, email, nombre_completo)
          )
        `)
        .eq('aula_id', aulaId)
        .eq('fcp_id', fcpId)
        .eq('activo', true)

      if (queryError) throw queryError

      const rows: TutorAulaRow[] = (data || []).map((item: any) => {
        const fm = item.fcp_miembro
        const usuario = fm?.usuario
        const displayName =
          (fm?.nombre_display?.trim() || usuario?.nombre_completo?.trim() || usuario?.email || fm?.email_pendiente) ??
          '(Pendiente de registro)'
        return {
          id: item.id,
          fcp_miembro_id: item.fcp_miembro_id,
          puede_registrar_asistencia: item.puede_registrar_asistencia ?? false,
          displayName,
        }
      })

      setTutores(rows)
      setChecks(
        rows.reduce((acc, t) => ({ ...acc, [t.id]: t.puede_registrar_asistencia }), {})
      )
    } catch (err: any) {
      console.error('Error cargando tutores:', err)
      setError(`Error al cargar tutores: ${err.message}`)
      setTutores([])
    } finally {
      setLoadingData(false)
    }
  }

  const handleToggle = (id: string, checked: boolean) => {
    setChecks((prev) => ({ ...prev, [id]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      for (const t of tutores) {
        const nuevoValor = checks[t.id] ?? false
        if (nuevoValor !== t.puede_registrar_asistencia) {
          const { error: updateError } = await supabase
            .from('tutor_aula')
            .update({ puede_registrar_asistencia: nuevoValor })
            .eq('id', t.id)

          if (updateError) throw updateError
        }
      }

      toast.success('Permisos de registro actualizados')
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Error guardando permisos:', err)
      setError(`Error al guardar: ${err.message}`)
      toast.error('Error al guardar permisos', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Habilitar registro de asistencia
          </DialogTitle>
          <DialogDescription>
            Marca los tutores que pueden registrar asistencias en el aula &quot;{aulaNombre}&quot;. Solo los marcados podrán registrar o editar asistencias.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Cargando tutores...</p>
            ) : tutores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay tutores asignados a este aula. Primero asigna un tutor desde &quot;Asignar tutor&quot;.
              </p>
            ) : (
              <div className="space-y-3">
                {tutores.map((tutor) => (
                  <div
                    key={tutor.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={tutor.id}
                      checked={checks[tutor.id] ?? false}
                      onCheckedChange={(v) => handleToggle(tutor.id, v === true)}
                      disabled={loading}
                    />
                    <Label
                      htmlFor={tutor.id}
                      className="flex-1 cursor-pointer font-normal"
                    >
                      {tutor.displayName}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || loadingData || tutores.length === 0}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
