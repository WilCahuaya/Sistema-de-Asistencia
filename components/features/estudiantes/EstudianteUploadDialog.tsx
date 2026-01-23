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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'

interface EstudianteUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulas: Array<{ id: string; nombre: string }>
}

interface EstudianteRow {
  codigo: string
  nombre_completo: string
  aula: string
}

export function EstudianteUploadDialog({ open, onOpenChange, onSuccess, fcpId, aulas }: EstudianteUploadDialogProps) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

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
      } else {
        alert('Por favor, selecciona un archivo Excel (.xlsx o .xls)')
        setFile(null)
      }
    }
  }

  const parseExcelFile = async (file: File): Promise<EstudianteRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

          if (jsonData.length < 2) {
            reject(new Error('El archivo debe tener al menos una fila de datos (excluyendo el encabezado)'))
            return
          }

          // Esperar encabezados: Código, Nombre Completo, Aula
          const headers = jsonData[0].map((h: any) => String(h || '').toLowerCase().trim())
          const codigoIndex = headers.findIndex((h: string) => h.includes('código') || h.includes('codigo'))
          const nombreIndex = headers.findIndex((h: string) => h.includes('nombre'))
          const aulaIndex = headers.findIndex((h: string) => h.includes('aula'))

          if (codigoIndex === -1 || nombreIndex === -1 || aulaIndex === -1) {
            reject(new Error('El archivo debe tener columnas: Código, Nombre Completo (o Nombre), Aula'))
            return
          }

          const estudiantes: EstudianteRow[] = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            const codigo = String(row[codigoIndex] || '').trim()
            const nombre_completo = String(row[nombreIndex] || '').trim()
            const aula = String(row[aulaIndex] || '').trim()

            if (codigo && nombre_completo && aula) {
              estudiantes.push({ codigo, nombre_completo, aula })
            }
          }

          if (estudiantes.length === 0) {
            reject(new Error('No se encontraron estudiantes válidos en el archivo'))
            return
          }

          resolve(estudiantes)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsArrayBuffer(file)
    })
  }

  const onSubmit = async () => {
    if (!file) {
      alert('Por favor, selecciona un archivo Excel')
      return
    }

    if (aulas.length === 0) {
      alert('No hay aulas disponibles. Primero crea aulas para esta ONG.')
      return
    }

    try {
      setLoading(true)
      setErrors([])
      setSuccessCount(0)

      const estudiantes = await parseExcelFile(file)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // Crear un mapa de nombres de aulas a IDs
      const aulaMap = new Map(aulas.map(a => [a.nombre.toLowerCase().trim(), a.id]))

      const errors: string[] = []
      let successCount = 0

      // Validar aulas primero
      for (const estudiante of estudiantes) {
        const aulaId = aulaMap.get(estudiante.aula.toLowerCase().trim())
        if (!aulaId) {
          errors.push(`Aula "${estudiante.aula}" no encontrada para estudiante ${estudiante.codigo}`)
        }
      }

      if (errors.length === estudiantes.length) {
        setErrors(errors)
        return
      }

      // Preparar estudiantes válidos
      const estudiantesToInsert: any[] = []
      for (const estudiante of estudiantes) {
        const aulaId = aulaMap.get(estudiante.aula.toLowerCase().trim())
        if (aulaId) {
          estudiantesToInsert.push({
            codigo: estudiante.codigo,
            nombre_completo: estudiante.nombre_completo,
            fcp_id: fcpId,
            aula_id: aulaId,
            created_by: user.id,
          })
        }
      }

      // Insertar estudiantes en lotes de 10
      const batchSize = 10
      for (let i = 0; i < estudiantesToInsert.length; i += batchSize) {
        const batch = estudiantesToInsert.slice(i, i + batchSize)

        const { error } = await supabase
          .from('estudiantes')
          .insert(batch)

        if (error) {
          if (error.code === '23505') {
            // Duplicado - intentar insertar uno por uno para identificar cuáles
            for (const estudiante of batch) {
              const { error: singleError } = await supabase
                .from('estudiantes')
                .insert(estudiante)
              
              if (singleError && singleError.code === '23505') {
                errors.push(`Código "${estudiante.codigo}" ya existe`)
              } else if (!singleError) {
                successCount++
              } else {
                errors.push(`Error al insertar ${estudiante.codigo}: ${singleError.message}`)
              }
            }
          } else {
            errors.push(`Error al insertar lote ${Math.floor(i / batchSize) + 1}: ${error.message}`)
          }
        } else {
          successCount += batch.length
        }
      }

      setErrors(errors)
      setSuccessCount(successCount)

      if (successCount > 0) {
        setTimeout(() => {
          onSuccess()
          handleReset()
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error uploading estudiantes:', error)
      setErrors([error.message || 'Error al procesar el archivo'])
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setErrors([])
    setSuccessCount(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const downloadTemplate = () => {
    // Crear solo los encabezados (formato vacío)
    const headerData = [
      ['Código', 'Nombre Completo', 'Aula'],
    ]

    // Crear workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(headerData)

    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 15 }, // Código
      { wch: 30 }, // Nombre Completo
      { wch: 20 }, // Aula
    ]

    // Agregar hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estudiantes')

    // Generar archivo y descargar
    const fileName = `formato_carga_estudiantes_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cargar Estudiantes desde Excel</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel con las columnas: <strong>Código</strong>, <strong>Nombre Completo</strong> (o <strong>Nombre</strong>), y <strong>Aula</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex items-center justify-between rounded-md bg-muted border border-border p-3">
          <div className="flex-1">
            <p className="text-sm text-foreground">
              ¿No tienes el formato? Descarga la plantilla de ejemplo
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            disabled={aulas.length === 0}
            className="ml-2"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar Formato
          </Button>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="file-upload">Archivo Excel (.xlsx, .xls)</Label>
            <div className="flex items-center gap-2">
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                ref={fileInputRef}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {file && (
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              El archivo debe tener un encabezado con: Código, Nombre Completo (o Nombre), Aula.
              {aulas.length === 0 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  ⚠️ Primero debes crear aulas para poder descargar el formato.
                </span>
              )}
            </p>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Errores encontrados ({errors.length})
                  </h4>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 max-h-32 overflow-y-auto">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {successCount > 0 && (
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    {successCount} {successCount === 1 ? 'estudiante creado' : 'estudiantes creados'} exitosamente
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            {successCount > 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || !file || aulas.length === 0}
          >
            {loading ? (
              'Procesando...'
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Cargar Estudiantes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

