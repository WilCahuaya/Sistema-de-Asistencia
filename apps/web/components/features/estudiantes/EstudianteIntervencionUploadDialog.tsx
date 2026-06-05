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
import { Label } from '@/components/ui/label'
import { Upload, FileSpreadsheet, CheckCircle2, Download, AlertCircle } from 'lucide-react'
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

interface FilaHistorial {
  fila: number
  codigo: string
  motivo: string
}

interface Resumen {
  total: number
  agregados: number
  noEncontrados: number
  duplicados: number
  agregadosDetalle: string[]
  noEncontradosDetalle: FilaHistorial[]
  duplicadosDetalle: FilaHistorial[]
  errores: string[]
}

function esArchivoExcel(file: File) {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.csv')
  )
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
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setResumen(null)
    setFile(null)
    setDragOver(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const aceptarArchivo = (selected: File | null) => {
    if (!selected) return
    if (!esArchivoExcel(selected)) {
      toast.warning('Formato de archivo', 'Selecciona un archivo Excel (.xlsx, .xls) o CSV.')
      setFile(null)
      return
    }
    setFile(selected)
    setResumen(null)
  }

  const descargarPlantilla = () => {
    const codigoDestino = aulaCodigo || 'INT-01'
    const headerData = [
      ['Código estudiante', 'Código intervención'],
      ['Código del estudiante (obligatorio)', `Código de la intervención (ej. ${codigoDestino})`],
    ]
    const ejemplo = [
      ['EST001', codigoDestino],
      ['EST002', codigoDestino],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([...headerData, ...ejemplo])
    worksheet['!cols'] = [{ wch: 20 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, worksheet, 'Intervención')
    XLSX.writeFile(wb, `plantilla_intervencion_${codigoDestino}.xlsx`)
  }

  const procesarArchivo = async () => {
    if (!file) {
      toast.warning('Archivo requerido', 'Selecciona o arrastra un archivo Excel.')
      return
    }

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
      const agregadosDetalle: string[] = []
      const noEncontradosDetalle: FilaHistorial[] = []
      const duplicadosDetalle: FilaHistorial[] = []
      const errores: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const codEst = String(
          row['codigo'] ??
            row['Codigo'] ??
            row['Código'] ??
            row['codigo_estudiante'] ??
            row['Código estudiante'] ??
            row['Código_estudiante'] ??
            ''
        ).trim()
        const codAula = String(
          row['codigo_aula'] ??
            row['Codigo_aula'] ??
            row['Código_aula'] ??
            row['Código intervención'] ??
            row['Codigo intervencion'] ??
            aulaCodigo ??
            ''
        ).trim()

        if (!codEst) continue

        const estudianteId = byCodigo.get(codEst.toLowerCase())
        if (!estudianteId) {
          noEncontrados++
          noEncontradosDetalle.push({
            fila: i + 2,
            codigo: codEst,
            motivo: 'Estudiante no encontrado en la FCP',
          })
          continue
        }

        let targetAulaId = aulaId
        if (codAula) {
          const resolved = byCodigoInt.get(codAula.toLowerCase())
          if (!resolved) {
            noEncontrados++
            noEncontradosDetalle.push({
              fila: i + 2,
              codigo: codEst,
              motivo: `Intervención "${codAula}" no encontrada`,
            })
            continue
          }
          if (resolved !== aulaId) {
            errores.push(
              `Fila ${i + 2}: el código de intervención "${codAula}" no coincide con "${aulaCodigo || aulaNombre}"`
            )
            continue
          }
          targetAulaId = resolved
        }

        if (inscritosSet.has(estudianteId)) {
          duplicados++
          duplicadosDetalle.push({
            fila: i + 2,
            codigo: codEst,
            motivo: 'Ya estaba inscrito en esta intervención',
          })
          continue
        }

        const { error } = await supabase.from('intervencion_estudiantes').insert({
          aula_id: targetAulaId,
          estudiante_id: estudianteId,
          fcp_id: fcpId,
          created_by: user.id,
        })

        if (error) {
          if (error.code === '23505') {
            duplicados++
            duplicadosDetalle.push({
              fila: i + 2,
              codigo: codEst,
              motivo: 'Ya estaba inscrito en esta intervención',
            })
          } else {
            errores.push(`Fila ${i + 2} (${codEst}): ${error.message}`)
          }
        } else {
          agregados++
          agregadosDetalle.push(codEst)
          inscritosSet.add(estudianteId)
        }
      }

      const total = rows.filter((r) => {
        const c = String(
          r['codigo'] ?? r['Codigo'] ?? r['Código'] ?? r['Código estudiante'] ?? ''
        ).trim()
        return !!c
      }).length

      setResumen({
        total,
        agregados,
        noEncontrados,
        duplicados,
        agregadosDetalle,
        noEncontradosDetalle,
        duplicadosDetalle,
        errores,
      })

      if (agregados > 0) onSuccess()
    } catch (e: unknown) {
      toast.error('Error al procesar', e instanceof Error ? e.message : 'No se pudo leer el archivo.')
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
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Cargar estudiantes a intervención
          </DialogTitle>
          <DialogDescription>
            Asocia estudiantes existentes a &quot;{aulaNombre}&quot; ({aulaCodigo || 'INT-??'}).
            Columnas: <strong>Código estudiante</strong> y opcionalmente <strong>Código intervención</strong>.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => aceptarArchivo(e.target.files?.[0] ?? null)}
        />

        {!resumen ? (
          <div className="space-y-4 overflow-y-auto">
            <div
              role="button"
              tabIndex={0}
              className={`flex flex-col items-center gap-3 py-8 px-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                aceptarArchivo(e.dataTransfer.files?.[0] ?? null)
              }}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileRef.current?.click()
                }
              }}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Arrastra tu archivo Excel aquí
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  o haz clic para seleccionarlo (.xlsx, .xls, .csv)
                </p>
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <FileSpreadsheet className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground mb-2">
                ¿No tienes el formato? Descarga la plantilla con las columnas{' '}
                <strong>Código estudiante</strong> y <strong>Código intervención</strong>.
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={descargarPlantilla}>
                <Download className="mr-2 h-4 w-4" />
                Descargar plantilla Excel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm overflow-y-auto min-h-0 flex-1">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-medium">Carga completada</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-semibold">{resumen.total}</p>
                <p className="text-xs text-muted-foreground">Filas leídas</p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 p-2 text-center dark:border-green-900 dark:bg-green-950/30">
                <p className="text-lg font-semibold text-green-700 dark:text-green-400">{resumen.agregados}</p>
                <p className="text-xs text-muted-foreground">Registrados</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">{resumen.noEncontrados}</p>
                <p className="text-xs text-muted-foreground">No encontrados</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-semibold">{resumen.duplicados}</p>
                <p className="text-xs text-muted-foreground">Duplicados</p>
              </div>
            </div>

            {resumen.agregadosDetalle.length > 0 && (
              <div>
                <Label className="text-green-700 dark:text-green-400">Registrados ({resumen.agregados})</Label>
                <ul className="mt-1 max-h-28 overflow-y-auto rounded-md border border-green-200 bg-green-50/50 p-2 text-xs dark:border-green-900 dark:bg-green-950/20">
                  {resumen.agregadosDetalle.map((cod) => (
                    <li key={cod}>• {cod}</li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.noEncontradosDetalle.length > 0 && (
              <div>
                <Label className="text-amber-700 dark:text-amber-400">No encontrados ({resumen.noEncontrados})</Label>
                <ul className="mt-1 max-h-28 overflow-y-auto rounded-md border border-amber-200 bg-amber-50/50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/20">
                  {resumen.noEncontradosDetalle.map((item) => (
                    <li key={`nf-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: {item.codigo} — {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.duplicadosDetalle.length > 0 && (
              <div>
                <Label>Duplicados / ya inscritos ({resumen.duplicados})</Label>
                <ul className="mt-1 max-h-28 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                  {resumen.duplicadosDetalle.map((item) => (
                    <li key={`dup-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: {item.codigo} — {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.errores.length > 0 && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 max-h-24 overflow-y-auto">
                    {resumen.errores.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Cerrar
          </Button>
          {!resumen ? (
            <Button onClick={procesarArchivo} disabled={loading || !file}>
              {loading ? 'Procesando...' : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Cargar estudiantes
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => {
                reset()
                fileRef.current?.click()
              }}
            >
              Cargar otro archivo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
