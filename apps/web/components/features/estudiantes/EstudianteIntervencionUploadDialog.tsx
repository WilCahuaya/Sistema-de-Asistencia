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
import { Upload, FileSpreadsheet, CheckCircle2, Download, AlertCircle, AlertTriangle } from 'lucide-react'
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
  aulaIncorrecta: number
  agregadosDetalle: string[]
  noEncontradosDetalle: FilaHistorial[]
  duplicadosDetalle: FilaHistorial[]
  aulaIncorrectaDetalle: FilaHistorial[]
  errores: string[]
}

interface FilaExcel {
  fila: number
  codEst: string
  codInt: string
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

function normalizarHeader(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function esColumnaCodigoEstudiante(header: string): boolean {
  const h = normalizarHeader(header)
  if (!h) return false
  if (h.includes('intervenc') || h.includes('salon') || h.includes('salón') || h.includes('nivel')) {
    return false
  }
  return (
    h === 'codigo' ||
    h === 'codigo estudiante' ||
    h === 'codigo_estudiante' ||
    h === 'codigo alumno' ||
    (h.includes('codigo') && h.includes('estudiante')) ||
    (h.includes('codigo') && h.includes('alumno'))
  )
}

function esColumnaCodigoIntervencion(header: string): boolean {
  const h = normalizarHeader(header)
  if (!h) return false
  return (
    h.includes('intervenc') ||
    h === 'codigo aula' ||
    h === 'codigo_aula' ||
    (h.includes('codigo') && h.includes('aula'))
  )
}

function esFilaInstruccion(codEst: string): boolean {
  const c = normalizarHeader(codEst)
  return (
    !c ||
    c.includes('obligatorio') ||
    c.includes('ejemplo') ||
    c.includes('codigo del estudiante') ||
    c.includes('codigo estudiante')
  )
}

function parseFilasIntervencion(sheet: XLSX.WorkSheet): FilaExcel[] {
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  if (jsonData.length < 2) {
    throw new Error('El archivo está vacío o no tiene filas de datos.')
  }

  let headerIdx = -1
  let codEstIdx = -1
  let codIntIdx = -1

  for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
    const row = (jsonData[r] || []).map((cell) => String(cell ?? '').trim())
    const codEstCol = row.findIndex((h) => esColumnaCodigoEstudiante(h))
    if (codEstCol >= 0) {
      headerIdx = r
      codEstIdx = codEstCol
      codIntIdx = row.findIndex((h) => esColumnaCodigoIntervencion(h))
      break
    }
  }

  if (headerIdx < 0 || codEstIdx < 0) {
    throw new Error(
      'No se encontró la columna "Código estudiante". Descarga la plantilla o revisa que la primera fila tenga ese encabezado.'
    )
  }

  const filas: FilaExcel[] = []
  for (let i = headerIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i] || []
    const codEst = String(row[codEstIdx] ?? '').trim()
    const codInt = codIntIdx >= 0 ? String(row[codIntIdx] ?? '').trim() : ''

    if (esFilaInstruccion(codEst)) continue

    filas.push({ fila: i + 1, codEst, codInt })
  }

  if (filas.length === 0) {
    throw new Error(
      'No hay filas con código de estudiante. Revisa que el archivo tenga datos debajo del encabezado.'
    )
  }

  return filas
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
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Código estudiante', 'Código intervención'],
      ['EST001', codigoDestino],
      ['EST002', codigoDestino],
    ])
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
      const filasExcel = parseFilasIntervencion(sheet)

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
      const codigosEnArchivo = new Map<string, number>()

      let agregados = 0
      let noEncontrados = 0
      let duplicados = 0
      let aulaIncorrecta = 0
      const agregadosDetalle: string[] = []
      const noEncontradosDetalle: FilaHistorial[] = []
      const duplicadosDetalle: FilaHistorial[] = []
      const aulaIncorrectaDetalle: FilaHistorial[] = []
      const errores: string[] = []

      for (const { fila, codEst, codInt } of filasExcel) {
        const codEstNorm = codEst.toLowerCase()

        if (codigosEnArchivo.has(codEstNorm)) {
          duplicados++
          duplicadosDetalle.push({
            fila,
            codigo: codEst,
            motivo: `Código repetido en el archivo (primera aparición en fila ${codigosEnArchivo.get(codEstNorm)})`,
          })
          continue
        }
        codigosEnArchivo.set(codEstNorm, fila)

        const estudianteId = byCodigo.get(codEstNorm)
        if (!estudianteId) {
          noEncontrados++
          noEncontradosDetalle.push({
            fila,
            codigo: codEst,
            motivo: 'Estudiante no encontrado en la FCP (código incorrecto o inactivo)',
          })
          continue
        }

        const codAulaFila = (codInt || aulaCodigo || '').trim()
        if (codAulaFila) {
          const resolved = byCodigoInt.get(codAulaFila.toLowerCase())
          if (!resolved) {
            noEncontrados++
            noEncontradosDetalle.push({
              fila,
              codigo: codEst,
              motivo: `Intervención "${codAulaFila}" no existe en esta FCP`,
            })
            continue
          }
          if (resolved !== aulaId) {
            aulaIncorrecta++
            aulaIncorrectaDetalle.push({
              fila,
              codigo: codEst,
              motivo: `Código de intervención "${codAulaFila}" no corresponde a "${aulaCodigo || aulaNombre}"`,
            })
            continue
          }
        }

        if (inscritosSet.has(estudianteId)) {
          duplicados++
          duplicadosDetalle.push({
            fila,
            codigo: codEst,
            motivo: 'Ya estaba inscrito en esta intervención',
          })
          continue
        }

        const { error } = await supabase.from('intervencion_estudiantes').insert({
          aula_id: aulaId,
          estudiante_id: estudianteId,
          fcp_id: fcpId,
          created_by: user.id,
        })

        if (error) {
          if (error.code === '23505') {
            duplicados++
            duplicadosDetalle.push({
              fila,
              codigo: codEst,
              motivo: 'Ya estaba inscrito en esta intervención',
            })
            inscritosSet.add(estudianteId)
          } else {
            errores.push(`Fila ${fila} (${codEst}): ${error.message}`)
          }
        } else {
          agregados++
          agregadosDetalle.push(codEst)
          inscritosSet.add(estudianteId)
        }
      }

      const resumenFinal: Resumen = {
        total: filasExcel.length,
        agregados,
        noEncontrados,
        duplicados,
        aulaIncorrecta,
        agregadosDetalle,
        noEncontradosDetalle,
        duplicadosDetalle,
        aulaIncorrectaDetalle,
        errores,
      }

      setResumen(resumenFinal)

      const fallos = noEncontrados + duplicados + aulaIncorrecta + errores.length
      if (agregados > 0 && fallos === 0) {
        toast.success('Carga completada', `${agregados} estudiante(s) agregado(s) a la intervención.`)
        onSuccess()
      } else if (agregados > 0) {
        toast.warning(
          'Carga parcial',
          `${agregados} agregado(s), ${fallos} fila(s) con observaciones. Revisa el detalle.`
        )
        onSuccess()
      } else {
        toast.error(
          'Sin registros nuevos',
          'Ningún estudiante fue agregado. Revisa códigos, duplicados e intervención en el detalle.'
        )
      }
    } catch (e: unknown) {
      toast.error('Error al procesar', e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setLoading(false)
    }
  }

  const hayProblemas =
    resumen &&
    (resumen.noEncontrados > 0 ||
      resumen.duplicados > 0 ||
      resumen.aulaIncorrecta > 0 ||
      resumen.errores.length > 0)

  const tituloResultado =
    resumen?.agregados === 0
      ? 'No se agregaron estudiantes'
      : hayProblemas
        ? 'Carga parcial'
        : 'Carga completada'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Cargar estudiantes a intervención
          </DialogTitle>
          <DialogDescription>
            Asocia estudiantes existentes a &quot;{aulaNombre}&quot; ({aulaCodigo || 'INT-??'}).
            Columnas: <strong>Código estudiante</strong> y <strong>Código intervención</strong>.
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
                <p className="text-sm font-medium">Arrastra tu archivo Excel aquí</p>
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
                Usa la plantilla con encabezados <strong>Código estudiante</strong> y{' '}
                <strong>Código intervención</strong>. Tras cargar verás el detalle de códigos incorrectos,
                duplicados e intervención errónea.
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={descargarPlantilla}>
                <Download className="mr-2 h-4 w-4" />
                Descargar plantilla Excel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm overflow-y-auto min-h-0 flex-1">
            <div
              className={`flex items-center gap-2 ${
                resumen.agregados === 0
                  ? 'text-red-600 dark:text-red-400'
                  : hayProblemas
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {resumen.agregados === 0 ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : hayProblemas ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium">{tituloResultado}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-semibold">{resumen.total}</p>
                <p className="text-xs text-muted-foreground">Filas procesadas</p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 p-2 text-center dark:border-green-900 dark:bg-green-950/30">
                <p className="text-lg font-semibold text-green-700 dark:text-green-400">{resumen.agregados}</p>
                <p className="text-xs text-muted-foreground">Agregados</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">{resumen.noEncontrados}</p>
                <p className="text-xs text-muted-foreground">Código incorrecto</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-semibold">{resumen.duplicados}</p>
                <p className="text-xs text-muted-foreground">Duplicados</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-center dark:border-red-900 dark:bg-red-950/30">
                <p className="text-lg font-semibold text-red-700 dark:text-red-400">{resumen.aulaIncorrecta}</p>
                <p className="text-xs text-muted-foreground">Intervención errónea</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-semibold">{resumen.errores.length}</p>
                <p className="text-xs text-muted-foreground">Otros errores</p>
              </div>
            </div>

            {resumen.agregadosDetalle.length > 0 && (
              <div>
                <Label className="text-green-700 dark:text-green-400">Agregados ({resumen.agregados})</Label>
                <ul className="mt-1 max-h-28 overflow-y-auto rounded-md border border-green-200 bg-green-50/50 p-2 text-xs dark:border-green-900 dark:bg-green-950/20">
                  {resumen.agregadosDetalle.map((cod) => (
                    <li key={cod}>• {cod}</li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.noEncontradosDetalle.length > 0 && (
              <div>
                <Label className="text-amber-700 dark:text-amber-400">
                  Códigos incorrectos o no encontrados ({resumen.noEncontrados})
                </Label>
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-amber-200 bg-amber-50/50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/20">
                  {resumen.noEncontradosDetalle.map((item) => (
                    <li key={`nf-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: <strong>{item.codigo}</strong> — {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.duplicadosDetalle.length > 0 && (
              <div>
                <Label>Duplicados ({resumen.duplicados})</Label>
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                  {resumen.duplicadosDetalle.map((item) => (
                    <li key={`dup-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: <strong>{item.codigo}</strong> — {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.aulaIncorrectaDetalle.length > 0 && (
              <div>
                <Label className="text-red-700 dark:text-red-400">
                  Intervención incorrecta ({resumen.aulaIncorrecta})
                </Label>
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-red-200 bg-red-50/50 p-2 text-xs dark:border-red-900 dark:bg-red-950/20">
                  {resumen.aulaIncorrectaDetalle.map((item) => (
                    <li key={`aula-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: <strong>{item.codigo}</strong> — {item.motivo}
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
