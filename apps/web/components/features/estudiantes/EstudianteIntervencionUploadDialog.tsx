'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from '@/lib/toast'

interface EstudianteIntervencionUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulaId: string
  aulaCodigo?: string | null
  aulaNombre: string
}

interface Resumen {
  total: number
  agregados: number
  noEncontrados: number
  duplicados: number
  errores: string[]
}

export function EstudianteIntervencionUploadDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  aulaId,
  aulaCodigo,
  aulaNombre,
}: EstudianteIntervencionUploadDialogProps) {
  const [loading, setLoading] = useState(false)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setResumen(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const procesarArchivo = async (file: File) => {
    setLoading(true)
    setResumen(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: estudiantesFcp } = await supabase
        .from('estudiantes')
        .select('id, codigo')
        .eq('fcp_id', fcpId)
        .eq('activo', true)

      const byCodigo = new Map<string, string>()
      for (const e of estudiantesFcp || []) {
        byCodigo.set(String(e.codigo).toLowerCase().trim(), e.id)
      }

      const { data: intervenciones } = await supabase
        .from('aulas')
        .select('id, codigo_aula')
        .eq('fcp_id', fcpId)
        .eq('tipo', 'INTERVENTION')

      const byCodigoInt = new Map<string, string>()
      for (const a of intervenciones || []) {
        if (a.codigo_aula) byCodigoInt.set(String(a.codigo_aula).toLowerCase().trim(), a.id)
      }

      const { data: inscritos } = await supabase
        .from('intervencion_estudiantes')
        .select('estudiante_id')
        .eq('aula_id', aulaId)
        .eq('activo', true)

      const inscritosSet = new Set((inscritos || []).map((r) => r.estudiante_id))

      let agregados = 0
      let noEncontrados = 0
      let duplicados = 0
      const errores: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const keys = Object.keys(row)
        const codEst = String(
          row['codigo'] ?? row['Codigo'] ?? row['Código'] ?? row['codigo_estudiante'] ?? ''
        ).trim()
        const codAula = String(
          row['codigo_aula'] ?? row['Codigo_aula'] ?? row['Código_aula'] ?? aulaCodigo ?? ''
        ).trim()

        if (!codEst) continue

        const estudianteId = byCodigo.get(codEst.toLowerCase())
        if (!estudianteId) {
          noEncontrados++
          continue
        }

        let targetAulaId = aulaId
        if (codAula) {
          const resolved = byCodigoInt.get(codAula.toLowerCase())
          if (!resolved) {
            noEncontrados++
            errores.push(`Fila ${i + 2}: intervención "${codAula}" no encontrada`)
            continue
          }
          if (resolved !== aulaId) {
            errores.push(`Fila ${i + 2}: código aula "${codAula}" no coincide con la intervención seleccionada`)
            continue
          }
          targetAulaId = resolved
        }

        if (inscritosSet.has(estudianteId)) {
          duplicados++
          continue
        }

        const { error } = await supabase.from('intervencion_estudiantes').insert({
          aula_id: targetAulaId,
          estudiante_id: estudianteId,
          fcp_id: fcpId,
          created_by: user.id,
        })

        if (error) {
          if (error.code === '23505') duplicados++
          else errores.push(`Fila ${i + 2}: ${error.message}`)
        } else {
          agregados++
          inscritosSet.add(estudianteId)
        }
      }

      const total = rows.filter((r) => {
        const c = String(r['codigo'] ?? r['Codigo'] ?? r['Código'] ?? '').trim()
        return !!c
      }).length

      setResumen({ total, agregados, noEncontrados, duplicados, errores })
      if (agregados > 0) onSuccess()
    } catch (e: any) {
      toast.error('Error al procesar', e?.message || 'No se pudo leer el archivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Cargar estudiantes a intervención
          </DialogTitle>
          <DialogDescription>
            Asocia estudiantes existentes a &quot;{aulaNombre}&quot; ({aulaCodigo || 'INT-??'}).
            Columnas: <strong>codigo</strong> (estudiante) y opcionalmente <strong>codigo_aula</strong>.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) procesarArchivo(f)
          }}
        />

        {!resumen ? (
          <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed rounded-lg">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              {loading ? 'Procesando...' : 'Seleccionar Excel'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Procesamiento completado
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>Total registros: {resumen.total}</li>
              <li>Agregados: {resumen.agregados}</li>
              <li>No encontrados: {resumen.noEncontrados}</li>
              <li>Duplicados: {resumen.duplicados}</li>
            </ul>
            {resumen.errores.length > 0 && (
              <div className="text-xs text-amber-600 max-h-24 overflow-y-auto">
                {resumen.errores.slice(0, 10).map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Cerrar
          </Button>
          {resumen && (
            <Button onClick={() => { reset(); fileRef.current?.click() }}>
              Cargar otro archivo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
