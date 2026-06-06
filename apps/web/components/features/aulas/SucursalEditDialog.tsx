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
import type { Sucursal } from './SucursalField'

interface SucursalEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  sucursal: Sucursal | null
}

export function SucursalEditDialog({
  open,
  onOpenChange,
  onSuccess,
  sucursal,
}: SucursalEditDialogProps) {
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && sucursal) {
      setNombre(sucursal.nombre)
    }
  }, [open, sucursal])

  const guardar = async () => {
    if (!sucursal) return
    const trimmed = nombre.trim()
    if (!trimmed) {
      toast.warning('Nombre requerido', 'Indica el nombre de la sucursal.')
      return
    }
    if (trimmed === sucursal.nombre) {
      onOpenChange(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/sucursales/${sucursal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error('Error al guardar', data.error || res.statusText)
        return
      }
      toast.success('Sucursal actualizada', data.message || 'El nombre se guardó correctamente.')
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo actualizar la sucursal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar sucursal</DialogTitle>
          <DialogDescription>
            Cambia el nombre de la sucursal. Las aulas que pertenecen a ella mantienen la misma agrupación.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="sucursal_nombre">Nombre</Label>
          <Input
            id="sucursal_nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Chupaca, Huancayo Norte"
            maxLength={200}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void guardar()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
