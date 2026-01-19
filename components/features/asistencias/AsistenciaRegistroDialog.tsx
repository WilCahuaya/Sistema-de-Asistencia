'use client'

import { useState, useEffect } from 'react'
import { ensureAuthenticated } from '@/lib/supabase/auth-helpers'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, CheckCircle2 } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface AsistenciaRegistroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  fcpId: string
  aulaId: string
  fecha: string
}

interface AsistenciaFormData {
  estudianteId: string
  estado: 'presente' | 'falto' | 'permiso'
  observaciones?: string
}

export function AsistenciaRegistroDialog({
  open,
  onOpenChange,
  onSuccess,
  fcpId,
  aulaId,
  fecha,
}: AsistenciaRegistroDialogProps) {
  const [loading, setLoading] = useState(false)
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [asistencias, setAsistencias] = useState<Map<string, AsistenciaFormData>>(new Map())
  const [savedCount, setSavedCount] = useState(0)
  const { canEdit, role } = useUserRole(fcpId)

  useEffect(() => {
    if (open) {
      loadEstudiantes()
      loadAsistenciasExistentes()
    }
  }, [open, aulaId, fecha])

  const loadEstudiantes = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data, error } = await supabase
        .from('estudiantes')
        .select('id, codigo, nombre_completo')
        .eq('fcp_id', fcpId)
        .eq('aula_id', aulaId)
        .eq('activo', true)
        .order('nombre_completo', { ascending: true })

      if (error) throw error

      setEstudiantes(data || [])
      
      // Inicializar todas las asistencias como "presente" por defecto
      const defaultAsistencias = new Map<string, AsistenciaFormData>()
      data?.forEach((est) => {
        defaultAsistencias.set(est.id, {
          estudianteId: est.id,
          estado: 'presente',
          observaciones: '',
        })
      })
      setAsistencias(defaultAsistencias)
    } catch (error) {
      console.error('Error loading estudiantes:', error)
    }
  }

  const loadAsistenciasExistentes = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data, error } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado, observaciones')
        .eq('fcp_id', fcpId)
        .eq('fecha', fecha)

      if (error) throw error

      // Cargar asistencias existentes
      const existingAsistencias = new Map<string, AsistenciaFormData>()
      data?.forEach((asist) => {
        existingAsistencias.set(asist.estudiante_id, {
          estudianteId: asist.estudiante_id,
          estado: asist.estado as 'presente' | 'falto' | 'permiso',
          observaciones: asist.observaciones || '',
        })
      })
      
      // Actualizar el mapa manteniendo los valores por defecto para los nuevos
      setAsistencias((prev) => {
        const updated = new Map(prev)
        existingAsistencias.forEach((value, key) => {
          updated.set(key, value)
        })
        return updated
      })
    } catch (error) {
      console.error('Error loading existing asistencias:', error)
    }
  }

  const handleEstadoChange = (estudianteId: string, estado: 'presente' | 'falto' | 'permiso') => {
    setAsistencias((prev) => {
      const updated = new Map(prev)
      const current = updated.get(estudianteId) || {
        estudianteId,
        estado: 'presente' as const,
        observaciones: '',
      }
      updated.set(estudianteId, { ...current, estado })
      return updated
    })
  }

  const handleObservacionesChange = (estudianteId: string, observaciones: string) => {
    setAsistencias((prev) => {
      const updated = new Map(prev)
      const current = updated.get(estudianteId) || {
        estudianteId,
        estado: 'presente' as const,
        observaciones: '',
      }
      updated.set(estudianteId, { ...current, observaciones })
      return updated
    })
  }

  const onSubmit = async () => {
    if (!fcpId || !aulaId || !fecha) {
      alert('Faltan datos requeridos')
      return
    }

    // Validar permisos: solo director y secretario pueden registrar asistencias
    if (!canEdit || (role !== 'director' && role !== 'secretario')) {
      alert('No tienes permisos para registrar asistencias. Solo los directores y secretarios pueden realizar esta acción.')
      return
    }

    try {
      setLoading(true)

      const authResult = await ensureAuthenticated()
      
      if (!authResult || !authResult.user) {
        alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        setLoading(false)
        return
      }

      const { user, supabase } = authResult

      // Preparar datos para inserción/actualización
      const asistenciasToSave = Array.from(asistencias.values()).map((asist) => ({
        fcp_id: fcpId,
        estudiante_id: asist.estudianteId,
        fecha,
        estado: asist.estado,
        observaciones: asist.observaciones || null,
        created_by: user.id,
        updated_by: user.id,
      }))

      if (asistenciasToSave.length === 0) {
        alert('No hay estudiantes para registrar asistencias')
        setLoading(false)
        return
      }

      // Usar upsert para insertar o actualizar
      const { error } = await supabase
        .from('asistencias')
        .upsert(asistenciasToSave, {
          onConflict: 'estudiante_id,fecha',
        })

      if (error) throw error

      setSavedCount(asistenciasToSave.length)
      setTimeout(() => {
        onSuccess()
        setAsistencias(new Map())
        setSavedCount(0)
      }, 1000)
    } catch (error: any) {
      console.error('Error saving asistencias:', error)
      alert('Error al guardar las asistencias. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setAsistencias(new Map())
      setSavedCount(0)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Asistencias</DialogTitle>
          <DialogDescription>
            Registra las asistencias para la fecha {new Date(fecha).toLocaleDateString('es-ES')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {estudiantes.length === 0 ? (
            <p className="text-muted-foreground">No hay estudiantes en esta aula</p>
          ) : (
            <div className="space-y-4">
              {estudiantes.map((estudiante) => {
                const asistencia = asistencias.get(estudiante.id)
                return (
                  <div key={estudiante.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{estudiante.nombre_completo}</p>
                        <p className="text-sm text-muted-foreground font-mono">{estudiante.codigo}</p>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Estado:</Label>
                      <RadioGroup
                        value={asistencia?.estado || 'presente'}
                        onValueChange={(value) => handleEstadoChange(estudiante.id, value as 'presente' | 'falto' | 'permiso')}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="presente" id={`${estudiante.id}-presente`} />
                          <Label htmlFor={`${estudiante.id}-presente`} className="cursor-pointer">
                            Presente
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="falto" id={`${estudiante.id}-falto`} />
                          <Label htmlFor={`${estudiante.id}-falto`} className="cursor-pointer">
                            Faltó
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="permiso" id={`${estudiante.id}-permiso`} />
                          <Label htmlFor={`${estudiante.id}-permiso`} className="cursor-pointer">
                            Permiso
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label htmlFor={`observaciones-${estudiante.id}`}>Observaciones (opcional):</Label>
                      <Textarea
                        id={`observaciones-${estudiante.id}`}
                        value={asistencia?.observaciones || ''}
                        onChange={(e) => handleObservacionesChange(estudiante.id, e.target.value)}
                        placeholder="Observaciones adicionales..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {savedCount > 0 && (
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="flex-1 text-sm text-green-800 dark:text-green-200">
                  <p className="font-medium">¡Asistencias guardadas correctamente!</p>
                  <p className="mt-1">Se registraron {savedCount} asistencias.</p>
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
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || estudiantes.length === 0}
          >
            {loading ? (
              <>
                <Calendar className="mr-2 h-4 w-4 animate-pulse" />
                Guardando...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Guardar Asistencias
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

