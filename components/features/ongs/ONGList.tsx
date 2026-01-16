'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Building2 } from 'lucide-react'
import { ONGDialog } from './ONGDialog'

interface ONG {
  id: string
  nombre: string
  descripcion?: string
  direccion?: string
  telefono?: string
  email?: string
  activa: boolean
}

export function ONGList() {
  const [ongs, setONGs] = useState<ONG[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadONGs()
  }, [])

  const loadONGs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          *,
          ong:ongs(*)
        `)
        .eq('activo', true)

      if (error) throw error

      const ongsList = data?.map((item: any) => item.ong).filter(Boolean) || []
      setONGs(ongsList)
    } catch (error) {
      console.error('Error loading ONGs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleONGCreated = () => {
    loadONGs()
    setIsDialogOpen(false)
  }

  if (loading) {
    return <div className="text-center py-8">Cargando ONGs...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Mis ONGs</h2>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear ONG
        </Button>
      </div>

      {ongs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No tienes ONGs registradas</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primera ONG
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ongs.map((ong) => (
            <Card key={ong.id}>
              <CardHeader>
                <CardTitle>{ong.nombre}</CardTitle>
                {ong.descripcion && (
                  <CardDescription>{ong.descripcion}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {ong.direccion && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Dirección:</span> {ong.direccion}
                    </p>
                  )}
                  {ong.telefono && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Teléfono:</span> {ong.telefono}
                    </p>
                  )}
                  {ong.email && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Email:</span> {ong.email}
                    </p>
                  )}
                  <div className="pt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        ong.activa
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {ong.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ONGDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleONGCreated}
      />
    </div>
  )
}

