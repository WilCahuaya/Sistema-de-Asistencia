'use client'

import { useState } from 'react'
import { useSelectedRole } from '@/contexts/SelectedRoleContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'
import { Loader2, Copy, FileSpreadsheet, MessageCircle } from 'lucide-react'

type MensajePorTutor = {
  tutorNombre: string
  tutorKey: string
  mensaje: string
  fotos: number
  cartasBlp: number
  cartasPresentacion: number
}

export function WhatsAppExcelClient() {
  const { selectedRole, loading: roleLoading } = useSelectedRole()
  const fcpId = selectedRole?.fcpId ?? null
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [mensajes, setMensajes] = useState<MensajePorTutor[]>([])
  const [advertencias, setAdvertencias] = useState<string[]>([])
  const [resumen, setResumen] = useState<{
    archivos: number
    filasFoto: number
    filasCarta: number
    tutores: number
  } | null>(null)

  const onFiles = (list: FileList | null) => {
    if (!list?.length) {
      setFiles([])
      return
    }
    const next = Array.from(list).slice(0, 5)
    setFiles(next)
    setMensajes([])
    setAdvertencias([])
    setResumen(null)
  }

  const procesar = async () => {
    if (!fcpId) {
      toast.warning('FCP', 'Selecciona un rol con FCP (director o secretario) para asociar tutores del sistema.')
      return
    }
    if (files.length === 0) {
      toast.warning('Archivos', 'Elige hasta 5 archivos Excel (.xlsx).')
      return
    }
    setLoading(true)
    setMensajes([])
    setAdvertencias([])
    setResumen(null)
    try {
      const fd = new FormData()
      fd.set('fcpId', fcpId)
      files.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/herramientas/whatsapp-desde-excel', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar.')
      }
      setMensajes(data.mensajes || [])
      setAdvertencias(data.advertencias || [])
      setResumen(data.resumen || null)
      toast.success('Listo', `Se generaron mensajes para ${(data.mensajes || []).length} tutor(es).`)
    } catch (e: unknown) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo procesar.')
    } finally {
      setLoading(false)
    }
  }

  const copiar = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado', 'Mensaje en el portapapeles.')
    } catch {
      toast.error('Portapapeles', 'No se pudo copiar. Copia manualmente.')
    }
  }

  if (roleLoading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-emerald-600" />
          Mensajes WhatsApp desde Excel
        </h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-base">
          Sube hasta 5 archivos exportados (cartas o fotos). Los estudiantes se cruzan por{' '}
          <strong>ID Local del Beneficiario</strong> con el <strong>código</strong> en esta FCP y se agrupan por el{' '}
          <strong>tutor del salón</strong> en el sistema (no por una columna tutor del Excel).
        </p>
      </div>

      {!fcpId && (
        <Card className="border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base">Selecciona un rol con FCP</CardTitle>
            <CardDescription>
              Usa el selector de rol en la parte superior y elige director o secretario de una FCP para habilitar el
              cruce con estudiantes y tutores.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5" />
            Archivos
          </CardTitle>
          <CardDescription>Formatos: hojas con encabezado que incluya «ID Local del Beneficiario».</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="excel-files">Excel (.xlsx), máximo 5</Label>
            <input
              id="excel-files"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              multiple
              disabled={!fcpId || loading}
              onChange={(e) => onFiles(e.target.files)}
              className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {files.length > 0 && (
              <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5">
                {files.map((f) => (
                  <li key={f.name + f.size}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>
          <Button onClick={procesar} disabled={!fcpId || loading || files.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando…
              </>
            ) : (
              'Generar mensajes'
            )}
          </Button>
        </CardContent>
      </Card>

      {resumen && (
        <p className="text-sm text-muted-foreground">
          Resumen: {resumen.archivos} archivo(s), {resumen.filasFoto} fila(s) foto, {resumen.filasCarta} fila(s) carta,{' '}
          {resumen.tutores} tutor(es).
        </p>
      )}

      {advertencias.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avisos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {advertencias.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {mensajes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Mensajes por tutor</h2>
          {mensajes.map((m) => (
            <Card key={m.tutorKey}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{m.tutorNombre}</CardTitle>
                  <CardDescription>
                    {m.fotos} foto(s) · {m.cartasBlp} carta(s) BLP · {m.cartasPresentacion} carta(s) presentación
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => copiar(m.mensaje)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm font-sans leading-relaxed">
                  {m.mensaje}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
