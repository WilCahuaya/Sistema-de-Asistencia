'use client'

import { useFCP } from '@/contexts/FCPContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Loader2 } from 'lucide-react'
import { getRolBadgeColor, getRolDisplayName } from '@/lib/utils/roles'

export function FCPSelector() {
  const { selectedFCP, userFCPs, loading, setSelectedFCP, isFacilitador } = useFCP()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando proyectos...</span>
      </div>
    )
  }

  // Si solo hay una FCP o ninguna, no mostrar selector
  if (userFCPs.length <= 1) {
    if (userFCPs.length === 1) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" />
          <span className="font-medium">{userFCPs[0].nombre}</span>
          {userFCPs[0].rol && (
            <span className={`px-2 py-0.5 rounded text-xs ${getRolBadgeColor(userFCPs[0].rol as any)}`}>
              {getRolDisplayName(userFCPs[0].rol as any)}
            </span>
          )}
        </div>
      )
    }
    return null
  }

  const selectedFCPInfo = userFCPs.find(fcp => fcp.id === selectedFCP)

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedFCP || ''}
        onValueChange={(value) => setSelectedFCP(value)}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Seleccionar proyecto">
            {selectedFCPInfo ? (
              <div className="flex items-center gap-2">
                <span>{selectedFCPInfo.nombre}</span>
                {selectedFCPInfo.rol && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${getRolBadgeColor(selectedFCPInfo.rol as any)}`}>
                    {getRolDisplayName(selectedFCPInfo.rol as any)}
                  </span>
                )}
              </div>
            ) : (
              'Seleccionar proyecto'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {userFCPs.map((fcp, index) => (
            <SelectItem key={`${fcp.id}-${fcp.rol || 'no-rol'}-${index}`} value={fcp.id}>
              <div className="flex items-center justify-between w-full gap-2">
                <span className="flex-1">{fcp.nombre}</span>
                {fcp.rol && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${getRolBadgeColor(fcp.rol as any)}`}>
                    {getRolDisplayName(fcp.rol as any)}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

