'use client'

import { useState, useRef, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, ArrowRight } from 'lucide-react'
import { toast } from '@/lib/toast'

interface EstudianteMoverExcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulas: Array<{ id: string; nombre: string; codigo_aula?: string }>
}

interface ExcelRow {
  codigo: string
  aula_destino: string
}

export function EstudianteMoverExcelDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  aulas,
}: EstudianteMoverExcelDialogProps) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        selectedFile.type === 'application/vnd.ms-excel' ||
        selectedFile.name.endsWith('.xlsx') ||
        selectedFile.name.endsWith('.xls')
      ) {
        setFile(selectedFile)
        setErrors([])
        setPreviewCount(null)
      } else {
        toast.warning('Formato de archivo', 'Selecciona un archivo Excel (.xlsx o .xls).')
        setFile(null)
      }
    }
  }

  const parseExcelFile = async (file: File): Promise<ExcelRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

          if (jsonData.length < 2) {
            reject(new Error('El archivo debe tener al menos una fila de datos (excluyendo el encabezado).'))
            return
          }

          const headers = (jsonData[0] as unknown[]).map((h) => String(h ?? '').toLowerCase().trim())
          const idxCodigo = headers.findIndex((h) => h.includes('código') || h.includes('codigo'))
          const idxAula = headers.findIndex((h) => h.includes('aula'))

          if (idxCodigo === -1 || idxAula === -1) {
            reject(new Error('El archivo debe tener columnas: Código y Aula (o Aula destino).'))
            return
          }

          const rows: ExcelRow[] = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as unknown[]
            const codigo = String(row[idxCodigo] ?? '').trim()
            const aula_destino = String(row[idxAula] ?? '').trim()
            if (codigo && aula_destino) {
              rows.push({ codigo, aula_destino })
            }
          }

          if (rows.length === 0) {
            reject(new Error('No se encontraron filas válidas con Código y Aula destino.'))
            return
          }

          resolve(rows)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('Error al leer el archivo.'))
      reader.readAsArrayBuffer(file)
    })
  }

  const onSubmit = async () => {
    if (!file) {
      toast.warning('Selecciona un archivo', 'Por favor, selecciona un archivo Excel.')
      return
    }
    if (aulas.length < 2) {
      toast.warning('Se necesitan al menos 2 aulas', 'Crea más aulas para poder mover estudiantes.')
      return
    }

    try {
      setLoading(true)
      setErrors([])
      setSuccessCount(0)

      const rows = await parseExcelFile(file)

      const aulaMap = new Map(
        aulas.map((a) => [a.nombre.toLowerCase().trim(), a])
      )
      if (aulas.some((a) => a.codigo_aula)) {
        aulas.forEach((a) => {
          if (a.codigo_aula) aulaMap.set(a.codigo_aula.toLowerCase().trim(), a)
        })
      }

      const codigosUnicos = [...new Set(rows.map((r) => r.codigo.trim()))]
      const res = await fetch(
        `/api/estudiantes/buscar-por-codigos?fcpId=${encodeURIComponent(fcpId)}&codigos=${encodeURIComponent(JSON.stringify(codigosUnicos))}`
      )
      const { estudiantes } = await res.json().catch(() => ({ estudiantes: [] }))
      if (!res.ok || !estudiantes?.length) {
        setErrors(['No se encontraron estudiantes con los códigos del archivo.'])
        setLoading(false)
        return
      }

      const codigoToEst = new Map(estudiantes.map((e: { id: string; codigo: string }) => [e.codigo.trim(), e]))

      const byAula = new Map<string, string[]>()
      const errs: string[] = []

      for (const row of rows) {
        const codigo = row.codigo.trim()
        const aulaNombre = row.aula_destino.trim().toLowerCase()
        const aulaDestino = aulaMap.get(aulaNombre)

        const est = codigoToEst.get(codigo)
        if (!est) {
          errs.push(`Código "${row.codigo}" no encontrado en la FCP.`)
          continue
        }
        if (!aulaDestino) {
          errs.push(`Aula "${row.aula_destino}" no encontrada.`)
          continue
        }

        const ids = byAula.get(aulaDestino.id) ?? []
        if (!ids.includes(est.id)) ids.push(est.id)
        byAula.set(aulaDestino.id, ids)
      }

      if (byAula.size === 0) {
        setErrors(errs.length > 0 ? errs : ['No se pudo procesar ninguna fila.'])
        setLoading(false)
        return
      }

      let totalMovidos = 0
      for (const [aulaId, estudianteIds] of byAula) {
        const moveRes = await fetch('/api/estudiantes/mover-masivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estudianteIds,
            aulaDestinoId: aulaId,
          }),
        })
        const data = await moveRes.json().catch(() => ({}))
        if (moveRes.ok && data.movidos) {
          totalMovidos += data.movidos
        }
      }

      setErrors(errs)
      setSuccessCount(totalMovidos)

      if (totalMovidos > 0) {
        toast.success(
          totalMovidos === 1 ? '1 estudiante movido' : `${totalMovidos} estudiantes movidos`,
          errs.length > 0 ? `Con ${errs.length} advertencia(s)` : undefined
        )
        setTimeout(() => {
          onSuccess()
          handleReset()
        }, 1500)
      }
      if (errs.length > 0 && totalMovidos === 0) {
        toast.error('Error al procesar', errs[0])
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al procesar el archivo.'
      setErrors([msg])
      toast.error('Error al mover estudiantes', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (file) {
      parseExcelFile(file)
        .then((rows) => setPreviewCount(rows.length))
        .catch(() => setPreviewCount(null))
    } else {
      setPreviewCount(null)
    }
  }, [file])

  const downloadTemplate = () => {
    const headerData = [['Código', 'Aula Destino']]
    const a0 = aulas[0]
    const a1 = aulas[1]
    const ejemplo = [
      ['E001', a0 ? (a0.codigo_aula ? `${a0.nombre} | ${a0.codigo_aula}` : a0.nombre) : 'Nivel I'],
      ['E002', a1 ? (a1.codigo_aula ? `${a1.nombre} | ${a1.codigo_aula}` : a1.nombre) : 'Nivel II'],
    ]
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([...headerData, ...ejemplo])
    worksheet['!cols'] = [{ wch: 15 }, { wch: 25 }]
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mover estudiantes')
    XLSX.writeFile(workbook, `formato_mover_estudiantes_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleReset = () => {
    setFile(null)
    setErrors([])
    setSuccessCount(0)
    setPreviewCount(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Mover estudiantes desde Excel</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel con columnas <strong>Código</strong> y <strong>Aula Destino</strong>. Los estudiantes se moverán
            al salón indicado en cada fila.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted p-3">
          <p className="text-sm text-foreground">Descarga la plantilla con el formato correcto</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            disabled={aulas.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar formato
          </Button>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="file-mover">Archivo Excel (.xlsx, .xls)</Label>
            <div className="flex items-center gap-2">
              <input
                id="file-mover"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                ref={fileInputRef}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {file && <FileSpreadsheet className="h-5 w-5 shrink-0 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Encabezados: <strong>Código</strong>, <strong>Aula Destino</strong>. Puedes poner el <strong>nombre</strong>, el <strong>código</strong> (A01…) o <strong>Nombre | A01</strong> si hay salones duplicados.
              {file && previewCount !== null && (
                <span className="ml-1 text-green-600 dark:text-green-400">
                  • {previewCount} fila(s) válida(s)
                </span>
              )}
            </p>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/20 bg-red-50 p-4 dark:bg-red-900/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <h4 className="mb-2 text-sm font-medium text-red-800 dark:text-red-200">
                    Errores / advertencias ({errors.length})
                  </h4>
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-700 dark:text-red-300">
                    {errors.slice(0, 10).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {errors.length > 10 && (
                      <li className="text-muted-foreground">... y {errors.length - 10} más</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {successCount > 0 && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {successCount} {successCount === 1 ? 'estudiante movido' : 'estudiantes movidos'} correctamente
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            {successCount > 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || !file || aulas.length < 2}
          >
            {loading ? (
              <>
                <ArrowRight className="mr-2 h-4 w-4 animate-pulse" />
                Procesando...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Mover estudiantes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
