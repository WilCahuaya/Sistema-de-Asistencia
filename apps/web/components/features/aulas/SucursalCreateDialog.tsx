'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

interface SucursalCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
}

export function SucursalCreateDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
}: SucursalCreateDialogProps) {
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setNombre('')
  }, [open])

  const crear = async () => {
    const trimmed = nombre.trim()
    if (!trimmed) {
      toast.warning('Nombre requerido', 'Indica el nombre de la nueva sucursal.')
      return
    }
    if (!fcpId) {
      toast.warning('Proyecto requerido', 'Selecciona un proyecto primero.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/sucursales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcp_id: fcpId, nombre: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error('Error al crear', data.error || res.statusText)
        return
      }
      toast.success('Sucursal creada', data.message || 'La sucursal se creó correctamente.')
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo crear la sucursal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva sucursal</DialogTitle>
          <DialogDescription>
            Crea una sucursal para agrupar aulas del proyecto (ej. sedes o distritos). Luego podrás
            asignar aulas a esta sucursal al crearlas o editarlas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="nueva_sucursal_nombre">Nombre</Label>
          <Input
            id="nueva_sucursal_nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Chupaca, Huancayo Norte"
            maxLength={200}
            disabled={loading}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void crear()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void crear()} disabled={loading}>
            {loading ? 'Creando…' : 'Crear sucursal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
