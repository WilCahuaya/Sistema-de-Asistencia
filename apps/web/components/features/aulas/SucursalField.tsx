'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Plus } from 'lucide-react'

export interface Sucursal {
  id: string
  nombre: string
  es_predeterminada: boolean
  orden?: number
}

/** Valor especial del Select para indicar "crear una nueva sucursal". */
export const NUEVA_SUCURSAL = '__nueva__'

/** Ordena sucursales: predeterminada primero, luego por orden y nombre. */
export function ordenarSucursales(list: Sucursal[]): Sucursal[] {
  return [...list].sort((a, b) => {
    if (a.es_predeterminada !== b.es_predeterminada) return a.es_predeterminada ? -1 : 1
    const oa = a.orden ?? 0
    const ob = b.orden ?? 0
    if (oa !== ob) return oa - ob
    return (a.nombre || '').localeCompare(b.nombre || '')
  })
}

/**
 * Resuelve el sucursal_id a guardar. Si el usuario eligió "crear nueva",
 * inserta la sucursal y devuelve su id. En otro caso devuelve el id seleccionado.
 */
export async function resolverSucursalId(
  supabase: SupabaseClient,
  opts: { fcpId: string; value: string; nuevaNombre: string; userId?: string }
): Promise<string> {
  const { fcpId, value, nuevaNombre, userId } = opts

  if (value === NUEVA_SUCURSAL) {
    const nombre = nuevaNombre.trim()
    if (!nombre) {
      throw new Error('Ingresa el nombre de la nueva sucursal.')
    }
    const { data, error } = await supabase
      .from('sucursales')
      .insert({
        fcp_id: fcpId,
        nombre,
        activa: true,
        created_by: userId ?? null,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  if (!value) {
    throw new Error('Selecciona una sucursal.')
  }
  return value
}

interface SucursalFieldProps {
  fcpId: string
  /** Id de sucursal seleccionado, '' (sin selección) o NUEVA_SUCURSAL. */
  value: string
  onChange: (value: string) => void
  nuevaNombre: string
  onNuevaNombreChange: (value: string) => void
  onSucursalesLoaded?: (list: Sucursal[]) => void
  disabled?: boolean
}

export function SucursalField({
  fcpId,
  value,
  onChange,
  nuevaNombre,
  onNuevaNombreChange,
  onSucursalesLoaded,
  disabled,
}: SucursalFieldProps) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!fcpId) return
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('sucursales')
          .select('id, nombre, es_predeterminada, orden')
          .eq('fcp_id', fcpId)
          .eq('activa', true)
        if (error) throw error
        if (cancelled) return
        const list = ordenarSucursales((data as Sucursal[]) || [])
        setSucursales(list)
        onSucursalesLoaded?.(list)
        // Selección por defecto: la sucursal predeterminada
        if (!value) {
          const predeterminada = list.find((s) => s.es_predeterminada) || list[0]
          if (predeterminada) onChange(predeterminada.id)
        }
      } catch (e) {
        console.error('Error cargando sucursales:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fcpId])

  const etiqueta = (s: Sucursal) => (s.es_predeterminada ? 'Principal' : s.nombre)

  return (
    <div className="grid gap-2">
      <Label htmlFor="sucursal">Sucursal *</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || loading || !fcpId}>
        <SelectTrigger id="sucursal">
          <SelectValue placeholder={loading ? 'Cargando sucursales...' : 'Seleccionar sucursal'} />
        </SelectTrigger>
        <SelectContent>
          {sucursales.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                {etiqueta(s)}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={NUEVA_SUCURSAL}>
            <span className="flex items-center gap-2 text-primary">
              <Plus className="h-4 w-4 flex-shrink-0" />
              Crear nueva sucursal
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {value === NUEVA_SUCURSAL && (
        <div className="grid gap-2 pt-1">
          <Input
            id="nueva_sucursal"
            value={nuevaNombre}
            onChange={(e) => onNuevaNombreChange(e.target.value)}
            placeholder="Nombre de la nueva sucursal (ej: Chupaca, Huancayo)"
            autoFocus
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Las aulas se agrupan por sucursal. Usa &quot;Principal&quot; si no deseas agruparla en una sucursal específica.
      </p>
    </div>
  )
}
