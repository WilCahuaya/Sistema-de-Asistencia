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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, AlertTriangle } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getCurrentMonthYearInAppTimezone, getMonthRangeInAppTimezone } from '@/lib/utils/dateUtils'

interface EstudianteUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulas: Array<{ id: string; nombre: string; codigo_aula?: string | null }>
}

interface FilaHistorial {
  fila: number
  codigo: string
  motivo: string
}

interface Resumen {
  total: number
  agregados: number
  duplicados: number
  aulaIncorrecta: number
  fallados: number
  agregadosDetalle: FilaHistorial[]
  duplicadosDetalle: FilaHistorial[]
  aulaIncorrectaDetalle: FilaHistorial[]
  falladosDetalle: FilaHistorial[]
}

interface FilaExcel {
  fila: number
  codigo: string
  nombre_completo: string
  aula: string
  codigo_aula?: string
}

function esArchivoExcel(file: File) {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls')
  )
}

function isHeaderCodigoAula(h: string) {
  const x = h.toLowerCase().trim()
  if (x === 'codigo_aula' || x === 'código_aula') return true
  return (
    (x.includes('codigo') || x.includes('código')) &&
    x.includes('aula') &&
    !x.includes('estudiante') &&
    !x.includes('alumno')
  )
}

function isHeaderAulaNombre(h: string) {
  const x = h.toLowerCase().trim()
  if (isHeaderCodigoAula(x)) return false
  return (
    x === 'aula' ||
    x.includes('aula') ||
    x.includes('salón') ||
    x.includes('salon') ||
    x.includes('nivel')
  )
}

function buildAulaResolver(aulas: Array<{ id: string; nombre: string; codigo_aula?: string | null }>) {
  const byCodigo = new Map<string, string>()
  const nombreToIds = new Map<string, string[]>()

  for (const a of aulas) {
    const nk = a.nombre.toLowerCase().trim()
    const list = nombreToIds.get(nk) ?? []
    list.push(a.id)
    nombreToIds.set(nk, list)
    if (a.codigo_aula) {
      byCodigo.set(String(a.codigo_aula).toLowerCase().trim(), a.id)
    }
  }

  const resolve = (
    nombreCelda: string,
    codigoCelda?: string
  ): { id: string | null; ambiguoPorNombre?: boolean } => {
    const codExtra = (codigoCelda ?? '').trim()
    if (codExtra) {
      const id = byCodigo.get(codExtra.toLowerCase())
      return id ? { id } : { id: null }
    }

    const raw = nombreCelda.trim()
    if (!raw) return { id: null }

    const lower = raw.toLowerCase()
    if (byCodigo.has(lower)) return { id: byCodigo.get(lower)! }

    if (lower.includes('|')) {
      const last = lower.split('|').pop()!.trim()
      if (last && byCodigo.has(last)) return { id: byCodigo.get(last)! }
    }

    const ids = nombreToIds.get(lower) ?? []
    if (ids.length === 1) return { id: ids[0] }
    if (ids.length > 1) return { id: null, ambiguoPorNombre: true }
    return { id: null }
  }

  return { resolve }
}

function parseFilasEstudiantes(sheet: XLSX.WorkSheet): FilaExcel[] {
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  if (jsonData.length < 2) {
    throw new Error('El archivo debe tener al menos una fila de datos (excluyendo el encabezado).')
  }

  const headersRaw = (jsonData[0] || []).map((h) => String(h ?? '').trim())
  const headers = headersRaw.map((h) => h.toLowerCase().trim())
  const codigoIndex = headers.findIndex(
    (h) =>
      (h.includes('código') || h.includes('codigo')) &&
      !h.includes('aula') &&
      !h.includes('salón') &&
      !h.includes('salon')
  )
  const nombreIndex = headers.findIndex((h) => h.includes('nombre'))
  const aulaIndex = headersRaw.findIndex((h) => isHeaderAulaNombre(h))
  const codigoAulaColIndex = headersRaw.findIndex((h) => isHeaderCodigoAula(h))

  if (codigoIndex === -1 || nombreIndex === -1 || aulaIndex === -1) {
    throw new Error(
      'El archivo debe tener columnas: Código, Nombre Completo (o Nombre), Aula. Opcional: Código aula (A01, A02…).'
    )
  }

  const filas: FilaExcel[] = []
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] || []
    const codigo = String(row[codigoIndex] ?? '').trim()
    const nombre_completo = String(row[nombreIndex] ?? '').trim()
    const aula = String(row[aulaIndex] ?? '').trim()
    const codigo_aula = codigoAulaColIndex >= 0 ? String(row[codigoAulaColIndex] ?? '').trim() : undefined

    if (!codigo && !nombre_completo && !aula) continue

    filas.push({
      fila: i + 1,
      codigo,
      nombre_completo,
      aula,
      codigo_aula: codigo_aula || undefined,
    })
  }

  if (filas.length === 0) {
    throw new Error('No se encontraron filas con datos en el archivo.')
  }

  return filas
}

export function EstudianteUploadDialog({ open, onOpenChange, onSuccess, fcpId, aulas }: EstudianteUploadDialogProps) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const reset = () => {
    setResumen(null)
    setFile(null)
    setDragOver(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const aceptarArchivo = (selected: File | null) => {
    if (!selected) return
    if (!esArchivoExcel(selected)) {
      toast.warning('Formato de archivo', 'Selecciona un archivo Excel (.xlsx o .xls).')
      setFile(null)
      return
    }
    setFile(selected)
    setResumen(null)
  }

  const downloadTemplate = () => {
    const ejemplo =
      aulas.length > 0
        ? [['E001', 'Ejemplo Alumno', aulas[0].nombre, aulas[0].codigo_aula ?? '']]
        : []

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Código', 'Nombre Completo', 'Aula', 'Código aula (opcional)'],
      ...ejemplo,
    ])
    worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 28 }, { wch: 22 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estudiantes')
    XLSX.writeFile(workbook, `formato_carga_estudiantes_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const procesarArchivo = async () => {
    if (!file) {
      toast.warning('Archivo requerido', 'Selecciona o arrastra un archivo Excel.')
      return
    }

    if (aulas.length === 0) {
      toast.warning('Sin aulas', 'Crea aulas antes de cargar estudiantes.')
      return
    }

    setLoading(true)
    setResumen(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const filasExcel = parseFilasEstudiantes(sheet)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: existentes } = await supabase
        .from('estudiantes')
        .select('codigo')
        .eq('fcp_id', fcpId)

      const codigosExistentes = new Set(
        (existentes || []).map((e) => String(e.codigo).toLowerCase().trim())
      )

      const { resolve } = buildAulaResolver(aulas)
      const codigosEnArchivo = new Map<string, number>()
      const { year, month } = getCurrentMonthYearInAppTimezone()
      const { start: fechaInicioPeriodo, end: fechaFinPeriodo } = getMonthRangeInAppTimezone(year, month)

      let agregados = 0
      let duplicados = 0
      let aulaIncorrecta = 0
      let fallados = 0
      const agregadosDetalle: FilaHistorial[] = []
      const duplicadosDetalle: FilaHistorial[] = []
      const aulaIncorrectaDetalle: FilaHistorial[] = []
      const falladosDetalle: FilaHistorial[] = []

      for (const fila of filasExcel) {
        const { fila: numFila, codigo, nombre_completo, aula, codigo_aula } = fila
        const codigoLabel = codigo || '(sin código)'

        if (!codigo || !nombre_completo || !aula) {
          fallados++
          falladosDetalle.push({
            fila: numFila,
            codigo: codigoLabel,
            motivo: 'Faltan datos obligatorios (código, nombre o aula)',
          })
          continue
        }

        const codNorm = codigo.toLowerCase().trim()

        if (codigosEnArchivo.has(codNorm)) {
          duplicados++
          duplicadosDetalle.push({
            fila: numFila,
            codigo,
            motivo: `Código repetido en el archivo (primera aparición en fila ${codigosEnArchivo.get(codNorm)})`,
          })
          continue
        }
        codigosEnArchivo.set(codNorm, numFila)

        if (codigosExistentes.has(codNorm)) {
          duplicados++
          duplicadosDetalle.push({
            fila: numFila,
            codigo,
            motivo: 'El código ya existe en la FCP',
          })
          continue
        }

        const { id: aulaId, ambiguoPorNombre } = resolve(aula, codigo_aula)
        if (!aulaId) {
          aulaIncorrecta++
          if (ambiguoPorNombre) {
            aulaIncorrectaDetalle.push({
              fila: numFila,
              codigo,
              motivo: `Aula "${aula}" está repetida; usa la columna "Código aula" o "Nombre | A01"`,
            })
          } else if (codigo_aula) {
            aulaIncorrectaDetalle.push({
              fila: numFila,
              codigo,
              motivo: `Código de aula "${codigo_aula}" no coincide con ningún salón`,
            })
          } else {
            aulaIncorrectaDetalle.push({
              fila: numFila,
              codigo,
              motivo: `Aula "${aula}" no encontrada en la FCP`,
            })
          }
          continue
        }

        const { data: inserted, error } = await supabase
          .from('estudiantes')
          .insert({
            codigo,
            nombre_completo,
            fcp_id: fcpId,
            aula_id: aulaId,
            created_by: user.id,
          })
          .select('id, aula_id')
          .single()

        if (error) {
          if (error.code === '23505') {
            duplicados++
            duplicadosDetalle.push({
              fila: numFila,
              codigo,
              motivo: 'El código ya existe en la FCP',
            })
            codigosExistentes.add(codNorm)
          } else {
            fallados++
            falladosDetalle.push({
              fila: numFila,
              codigo,
              motivo: error.message,
            })
          }
          continue
        }

        if (inserted) {
          await supabase.from('estudiante_periodos').insert({
            estudiante_id: inserted.id,
            aula_id: inserted.aula_id,
            fecha_inicio: fechaInicioPeriodo,
            fecha_fin: fechaFinPeriodo,
            created_by: user.id,
          })
          agregados++
          agregadosDetalle.push({
            fila: numFila,
            codigo,
            motivo: nombre_completo,
          })
          codigosExistentes.add(codNorm)
        }
      }

      const resumenFinal: Resumen = {
        total: filasExcel.length,
        agregados,
        duplicados,
        aulaIncorrecta,
        fallados,
        agregadosDetalle,
        duplicadosDetalle,
        aulaIncorrectaDetalle,
        falladosDetalle,
      }

      setResumen(resumenFinal)

      const fallos = duplicados + aulaIncorrecta + fallados
      if (agregados > 0 && fallos === 0) {
        toast.success('Carga completada', `${agregados} estudiante(s) creado(s).`)
        onSuccess()
      } else if (agregados > 0) {
        toast.warning(
          'Carga parcial',
          `${agregados} creado(s), ${fallos} fila(s) con observaciones. Revisa el detalle.`
        )
        onSuccess()
      } else {
        toast.error(
          'Sin registros nuevos',
          'Ningún estudiante fue creado. Revisa el detalle del reporte.'
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
    (resumen.duplicados > 0 || resumen.aulaIncorrecta > 0 || resumen.fallados > 0)

  const tituloResultado =
    resumen?.agregados === 0
      ? 'No se crearon estudiantes'
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
            Cargar estudiantes desde Excel
          </DialogTitle>
          <DialogDescription>
            Columnas: <strong>Código</strong>, <strong>Nombre Completo</strong>, <strong>Aula</strong>.
            Opcional: <strong>Código aula</strong> si hay salones con el mismo nombre.
            Los estudiantes inician en el mes actual.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
                  o haz clic para seleccionarlo (.xlsx, .xls)
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
                ¿No tienes el formato? Descarga la plantilla. Tras cargar verás el detalle de registrados,
                duplicados, aulas incorrectas y fallidos.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={downloadTemplate}
                disabled={aulas.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar plantilla Excel
              </Button>
              {aulas.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Primero debes crear aulas para poder descargar la plantilla.
                </p>
              )}
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
                <p className="text-xs text-muted-foreground">Registrados</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-semibold">{resumen.duplicados}</p>
                <p className="text-xs text-muted-foreground">Duplicados</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">{resumen.aulaIncorrecta}</p>
                <p className="text-xs text-muted-foreground">Aula incorrecta</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-center dark:border-red-900 dark:bg-red-950/30">
                <p className="text-lg font-semibold text-red-700 dark:text-red-400">{resumen.fallados}</p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
            </div>

            {resumen.agregadosDetalle.length > 0 && (
              <div>
                <Label className="text-green-700 dark:text-green-400">Registrados ({resumen.agregados})</Label>
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-green-200 bg-green-50/50 p-2 text-xs dark:border-green-900 dark:bg-green-950/20">
                  {resumen.agregadosDetalle.map((item) => (
                    <li key={`ok-${item.fila}-${item.codigo}`}>
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
                <Label className="text-amber-700 dark:text-amber-400">
                  Aula incorrecta ({resumen.aulaIncorrecta})
                </Label>
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-amber-200 bg-amber-50/50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/20">
                  {resumen.aulaIncorrectaDetalle.map((item) => (
                    <li key={`aula-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: <strong>{item.codigo}</strong> — {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumen.falladosDetalle.length > 0 && (
              <div>
                <Label className="text-red-700 dark:text-red-400">Fallidos ({resumen.fallados})</Label>
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-red-200 bg-red-50/50 p-2 text-xs dark:border-red-900 dark:bg-red-950/20">
                  {resumen.falladosDetalle.map((item) => (
                    <li key={`fail-${item.fila}-${item.codigo}`}>
                      • Fila {item.fila}: <strong>{item.codigo}</strong> — {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Cerrar
          </Button>
          {!resumen ? (
            <Button onClick={procesarArchivo} disabled={loading || !file || aulas.length === 0}>
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
