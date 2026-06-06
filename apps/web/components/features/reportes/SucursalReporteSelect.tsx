'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import {
  SUCURSAL_TODAS,
  etiquetaSucursalSelect,
  type SucursalReporte,
} from '@/lib/reportes/sucursalReporte'

interface SucursalReporteSelectProps {
  sucursales: SucursalReporte[]
  value: string
  onChange: (value: string) => void
  loading?: boolean
  className?: string
}

export function SucursalReporteSelect({
  sucursales,
  value,
  onChange,
  loading,
  className,
}: SucursalReporteSelectProps) {
  if (sucursales.length <= 1 && !sucursales.some((s) => !s.es_predeterminada)) {
    return null
  }

  return (
    <div className={className}>
      <label className="text-sm font-medium mb-2 block">Sucursal:</label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? 'Cargando…' : 'Todas las sucursales'}>
            {value === SUCURSAL_TODAS ? (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Todas las sucursales</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>{etiquetaSucursalSelect(sucursales.find((s) => s.id === value) ?? { id: value, nombre: value, es_predeterminada: false, orden: 0 })}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SUCURSAL_TODAS}>Todas las sucursales</SelectItem>
          {sucursales.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {etiquetaSucursalSelect(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
