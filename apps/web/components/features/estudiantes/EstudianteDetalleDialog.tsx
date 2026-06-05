'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GraduationCap, Layers } from 'lucide-react'
import {
  ESTADO_INTERVENCION_CLASS,
  ESTADO_INTERVENCION_LABEL,
  formatTemporada,
} from '@/lib/utils/aulaIntervencion'
import type { EstadoIntervencion } from '@/lib/utils/aulaIntervencion'

interface EstudianteDetalleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  estudianteId: string
  estudianteNombre: string
  fcpId: string
}

interface IntervencionInfo {
  id: string
  nombre: string
  codigo_aula?: string | null
  estado_intervencion?: EstadoIntervencion | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  tutor?: string | null
}

export function EstudianteDetalleDialog({
  open,
  onOpenChange,
  estudianteId,
  estudianteNombre,
  fcpId,
}: EstudianteDetalleDialogProps) {
  const [loading, setLoading] = useState(true)
  const [aulaPrincipal, setAulaPrincipal] = useState<string>('—')
  const [intervenciones, setIntervenciones] = useState<IntervencionInfo[]>([])

  useEffect(() => {
    if (!open || !estudianteId) return
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()

        const { data: est } = await supabase
          .from('estudiantes')
          .select('aula:aulas(nombre, codigo_aula)')
          .eq('id', estudianteId)
          .single()

        const aula = Array.isArray(est?.aula) ? est.aula[0] : est?.aula
        if (aula) {
          setAulaPrincipal(
            `${aula.nombre}${aula.codigo_aula ? ` (${aula.codigo_aula})` : ''}`
          )
        } else {
          setAulaPrincipal('—')
        }

        const { data: rows } = await supabase
          .from('intervencion_estudiantes')
          .select(`
            aula:aulas(
              id, nombre, codigo_aula, estado_intervencion, fecha_inicio, fecha_fin
            )
          `)
          .eq('estudiante_id', estudianteId)
          .eq('fcp_id', fcpId)
          .eq('activo', true)

        const ints: IntervencionInfo[] = []
        for (const row of rows || []) {
          const a = Array.isArray(row.aula) ? row.aula[0] : row.aula
          if (!a) continue

          const { data: tutores } = await supabase
            .from('tutor_aula')
            .select('fcp_miembro:fcp_miembros(nombre_display, usuario:usuarios(nombre_completo, email))')
            .eq('aula_id', a.id)
            .eq('activo', true)
            .limit(1)

          let tutor: string | null = null
          const ta = tutores?.[0] as { fcp_miembro?: { nombre_display?: string; usuario?: { nombre_completo?: string } | { nombre_completo?: string }[] } } | undefined
          if (ta?.fcp_miembro) {
            const fm = ta.fcp_miembro
            const usuario = fm.usuario
            const u = Array.isArray(usuario) ? usuario[0] : usuario
            tutor = fm.nombre_display || u?.nombre_completo || null
          }

          ints.push({
            id: a.id,
            nombre: a.nombre,
            codigo_aula: a.codigo_aula,
            estado_intervencion: (a.estado_intervencion as EstadoIntervencion | null) ?? null,
            fecha_inicio: a.fecha_inicio,
            fecha_fin: a.fecha_fin,
            tutor,
          })
        }
        setIntervenciones(ints)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, estudianteId, fcpId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Detalle del estudiante</DialogTitle>
          <DialogDescription>{estudianteNombre}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <GraduationCap className="h-4 w-4" />
                Aula principal
              </div>
              <p className="text-sm text-muted-foreground pl-6">{aulaPrincipal}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Layers className="h-4 w-4" />
                Intervenciones ({intervenciones.length})
              </div>
              {intervenciones.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Sin intervenciones activas</p>
              ) : (
                <ul className="space-y-2 pl-6">
                  {intervenciones.map((int) => {
                    const estado = int.estado_intervencion ?? 'ACTIVA'
                    return (
                      <li key={int.id} className="text-sm border rounded-md p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {int.nombre}
                            {int.codigo_aula && (
                              <span className="text-muted-foreground font-normal ml-1">
                                {int.codigo_aula}
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                              ESTADO_INTERVENCION_CLASS[estado] || ''
                            }`}
                          >
                            {ESTADO_INTERVENCION_LABEL[estado] || estado}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Temporada: {formatTemporada(int)}
                        </p>
                        {int.tutor && (
                          <p className="text-xs text-muted-foreground">Responsable: {int.tutor}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
