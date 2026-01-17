'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  useEffect(() => {
    loadONGs()
  }, [])

  const loadONGs = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError)
        setONGs([])
        return
      }

      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          *,
          ong:ongs(*)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (error) throw error

      // Filtrar y mapear ONGs, eliminando duplicados por ID
      const ongsMap = new Map<string, ONG>()
      data?.forEach((item: any) => {
        if (item.ong && item.ong.id) {
          ongsMap.set(item.ong.id, item.ong)
        }
      })
      
      const ongsList = Array.from(ongsMap.values())
      setONGs(ongsList)
    } catch (error) {
      console.error('Error loading ONGs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando ONGs...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Mis ONGs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Las ONGs y facilitadores se gestionan desde la base de datos. Contacta al administrador para crear una nueva ONG.
        </p>
      </div>

      {ongs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              No tienes ONGs asignadas. Contacta a un facilitador para que te agregue a una ONG.
            </p>
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
                  <div className="pt-2 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        ong.activa
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {ong.activa ? 'Activa' : 'Inactiva'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/ongs/${ong.id}/miembros`)}
                      className="text-xs"
                    >
                      <Users className="mr-1 h-3 w-3" />
                      Miembros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

