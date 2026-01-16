'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, GraduationCap, Users } from 'lucide-react'
import { AulaDialog } from './AulaDialog'
import { useRouter } from 'next/navigation'

interface Aula {
  id: string
  nombre: string
  descripcion?: string
  activa: boolean
  ong_id: string
  ong?: {
    nombre: string
  }
}

export function AulaList() {
  const [aulas, setAulas] = useState<Aula[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedONG, setSelectedONG] = useState<string | null>(null)
  const [userONGs, setUserONGs] = useState<Array<{ id: string; nombre: string }>>([])
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadUserONGs()
  }, [])

  useEffect(() => {
    if (userONGs.length > 0 && !selectedONG) {
      setSelectedONG(userONGs[0].id)
    }
  }, [userONGs])

  useEffect(() => {
    if (selectedONG) {
      loadAulas()
    }
  }, [selectedONG])

  const loadUserONGs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('usuario_ong')
        .select(`
          ong_id,
          ong:ongs(id, nombre)
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      if (error) throw error

      const ongs = data?.map((item: any) => ({
        id: item.ong.id,
        nombre: item.ong.nombre,
      })) || []

      setUserONGs(ongs)
    } catch (error) {
      console.error('Error loading ONGs:', error)
    }
  }

  const loadAulas = async () => {
    if (!selectedONG) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          *,
          ong:ongs(nombre)
        `)
        .eq('ong_id', selectedONG)
        .order('nombre', { ascending: true })

      if (error) throw error
      setAulas(data || [])
    } catch (error) {
      console.error('Error loading aulas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAulaCreated = () => {
    loadAulas()
    setIsDialogOpen(false)
  }

  if (userONGs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No tienes ONGs asociadas. Primero crea o únete a una ONG.
          </p>
          <Button onClick={() => router.push('/ongs')}>
            Ir a ONGs
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="text-center py-8">Cargando aulas...</div>
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Seleccionar ONG:</label>
          <select
            value={selectedONG || ''}
            onChange={(e) => setSelectedONG(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            {userONGs.map((ong) => (
              <option key={ong.id} value={ong.id}>
                {ong.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedONG}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Aula
        </Button>
      </div>

      {aulas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No hay aulas registradas para esta ONG</p>
            <Button onClick={() => setIsDialogOpen(true)} disabled={!selectedONG}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primera aula
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {aulas.map((aula) => (
            <Card key={aula.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{aula.nombre}</CardTitle>
                {aula.descripcion && (
                  <CardDescription>{aula.descripcion}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {aula.descripcion && (
                    <p className="text-muted-foreground">{aula.descripcion}</p>
                  )}
                  {aula.ong && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">ONG:</span> {aula.ong.nombre}
                    </p>
                  )}
                  <div className="pt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        aula.activa
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {aula.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AulaDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleAulaCreated}
        ongId={selectedONG || ''}
      />
    </div>
  )
}

