'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock, CheckCheck, X } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'

interface Estudiante {
  id: string
  codigo: string
  nombre_completo: string
}

interface Asistencia {
  id: string
  estudiante_id: string
  fecha: string
  estado: 'presente' | 'falto' | 'permiso'
  observaciones?: string
}

interface AsistenciaCalendarViewProps {
  fcpId: string
  aulaId?: string | null
  initialMonth?: number | null
  initialYear?: number | null
}

type AsistenciaEstado = 'presente' | 'falto' | 'permiso' | null

export function AsistenciaCalendarView({ fcpId, aulaId, initialMonth, initialYear }: AsistenciaCalendarViewProps) {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [asistencias, setAsistencias] = useState<Map<string, Asistencia>>(new Map())
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth !== null && initialMonth !== undefined ? initialMonth : new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(initialYear !== null && initialYear !== undefined ? initialYear : new Date().getFullYear())
  const [selectedAula, setSelectedAula] = useState<string | null>(aulaId || null)
  const [aulas, setAulas] = useState<Array<{ id: string; nombre: string }>>([])
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [savingDates, setSavingDates] = useState<Set<string>>(new Set()) // Para rastrear qué fechas están guardándose
  const [toast, setToast] = useState<{ message: string; date: string } | null>(null)
  
  const longPressTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const prevAulaRef = useRef<string | null>(null) // Para detectar cambios de aula
  const { canEdit, role } = useUserRole(fcpId)

  // Función helper para convertir Date a string YYYY-MM-DD en zona horaria local
  const formatDateToLocalString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Generar días del mes seleccionado
  const getDaysInMonth = (month: number, year: number) => {
    const daysCount = new Date(year, month + 1, 0).getDate()
    const days: Array<{ day: number; date: Date; dayName: string; fechaStr: string }> = []
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    
    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(year, month, day)
      days.push({
        day,
        date,
        dayName: dayNames[date.getDay()],
        fechaStr: formatDateToLocalString(date),
      })
    }
    return days
  }

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)

  useEffect(() => {
    if (fcpId) {
      loadAulas()
    }
  }, [fcpId])

  // Actualizar aula seleccionada cuando cambia el prop aulaId
  useEffect(() => {
    if (aulaId && aulaId !== selectedAula) {
      setSelectedAula(aulaId)
    }
  }, [aulaId])

  // Actualizar mes y año cuando cambian los props initialMonth e initialYear
  useEffect(() => {
    if (initialMonth !== null && initialMonth !== undefined && initialMonth !== selectedMonth) {
      setSelectedMonth(initialMonth)
    }
    if (initialYear !== null && initialYear !== undefined && initialYear !== selectedYear) {
      setSelectedYear(initialYear)
    }
  }, [initialMonth, initialYear])

  useEffect(() => {
    if (selectedAula) {
      // Si cambió el aula, limpiar asistencias y estudiantes ANTES de cargar nuevos
      if (prevAulaRef.current !== null && prevAulaRef.current !== selectedAula) {
        console.log('🔄 Aula cambió de', prevAulaRef.current.substring(0, 8), 'a', selectedAula.substring(0, 8), '- limpiando asistencias y estudiantes')
        setAsistencias(new Map())
        setEstudiantes([]) // Limpiar estudiantes también para forzar recarga
      }
      prevAulaRef.current = selectedAula
      
      // Cargar estudiantes para la nueva aula
      loadEstudiantes()
    } else {
      // Solo limpiar si no hay aula seleccionada
      prevAulaRef.current = null
      setEstudiantes([])
      setAsistencias(new Map())
    }
  }, [selectedAula, fcpId]) // Remover selectedMonth y selectedYear de aquí - no deberían limpiar estudiantes

  // Efecto separado para recargar asistencias cuando cambia el mes/año (sin limpiar estudiantes)
  useEffect(() => {
    if (selectedAula && estudiantes.length > 0) {
      console.log('🔄 Mes/año cambió, recargando asistencias sin limpiar estudiantes')
      loadAsistenciasMes()
    }
  }, [selectedMonth, selectedYear]) // Solo cuando cambia mes/año, no limpiar nada

  // Efecto principal para cargar asistencias cuando hay estudiantes y aula
  // Este efecto se ejecuta cuando cambian los estudiantes (después de cargarse)
  useEffect(() => {
    if (selectedAula && estudiantes.length > 0) {
      // Verificar que los estudiantes correspondan al aula actual
      // Esto evita cargar asistencias con estudiantes de otra aula
      console.log('🔄 Efecto de carga de asistencias activado:', {
        aula: selectedAula,
        estudiantesCount: estudiantes.length,
        muestraEstudianteIds: estudiantes.slice(0, 3).map(e => e.id.substring(0, 8))
      })
      
      // Usar un pequeño delay para asegurar que los estudiantes se hayan actualizado completamente
      const timer = setTimeout(() => {
        loadAsistenciasMes()
      }, 150) // Aumentar delay para asegurar que los estudiantes se actualizaron
      
      return () => clearTimeout(timer)
    } else {
      // Solo limpiar asistencias si realmente no hay aula
      // NO limpiar si solo está cambiando el mes/año o si aún no se han cargado estudiantes
      if (!selectedAula) {
        setAsistencias(new Map())
      }
      // Si hay aula pero no estudiantes todavía, no limpiar - esperar a que se carguen
    }
  }, [selectedAula, fcpId, estudiantes]) // Usar estudiantes como dependencia completa, no solo length

  // Efecto para verificar que las asistencias se mantengan después de cargar
  useEffect(() => {
    if (asistencias.size > 0 && estudiantes.length > 0) {
      console.log('✅ Estado de asistencias verificado:', {
        totalAsistencias: asistencias.size,
        totalEstudiantes: estudiantes.length,
        muestraKeys: Array.from(asistencias.keys()).slice(0, 5),
        fechasUnicas: [...new Set(Array.from(asistencias.keys()).map(k => k.split('_')[1]))].sort()
      })
    }
  }, [asistencias, estudiantes.length])

  const loadAulas = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('aulas')
        .select('id, nombre')
        .eq('fcp_id', fcpId)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (error) throw error
      setAulas(data || [])
      
      // Si hay aulaId prop y no hay aula seleccionada, seleccionarla
      if (aulaId && !selectedAula) {
        setSelectedAula(aulaId)
      } else if (data && data.length > 0 && !selectedAula) {
        setSelectedAula(data[0].id)
      }
    } catch (error) {
      console.error('Error loading aulas:', error)
    }
  }

  const loadEstudiantes = async () => {
    if (!selectedAula) {
      console.log('⚠️ loadEstudiantes: No hay aula seleccionada')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('estudiantes')
        .select('id, codigo, nombre_completo')
        .eq('fcp_id', fcpId)
        .eq('aula_id', selectedAula)
        .eq('activo', true)
        .order('nombre_completo', { ascending: true })

      if (error) throw error
      
      const nuevosEstudiantes = data || []
      const nuevosIds = new Set(nuevosEstudiantes.map(e => e.id))
      
      console.log('✅ Estudiantes cargados:', {
        count: nuevosEstudiantes.length,
        aula: selectedAula,
        muestraIds: nuevosEstudiantes.slice(0, 3).map(e => e.id.substring(0, 8))
      })
      
      // Actualizar estudiantes
      setEstudiantes(prev => {
        const prevIds = new Set(prev.map(e => e.id))
        const idsCambiaron = nuevosIds.size !== prevIds.size || 
                             !Array.from(nuevosIds).every(id => prevIds.has(id))
        
        // Si los IDs cambiaron (cambio de aula), limpiar asistencias
        if (idsCambiaron && prev.length > 0) {
          console.log('🔄 IDs de estudiantes cambiaron (cambio de aula), limpiando asistencias')
          setAsistencias(new Map())
        }
        
        return nuevosEstudiantes
      })
    } catch (error) {
      console.error('Error loading estudiantes:', error)
      setEstudiantes([]) // Limpiar estudiantes en caso de error
    } finally {
      setLoading(false)
    }
  }

  const loadAsistenciasMes = async () => {
    if (!selectedAula || estudiantes.length === 0) {
      console.log('⚠️ loadAsistenciasMes: No hay aula seleccionada o estudiantes', {
        selectedAula,
        estudiantesCount: estudiantes.length
      })
      return
    }

    try {
      const supabase = createClient()
      // Usar formato local para evitar problemas de zona horaria
      const firstDay = formatDateToLocalString(new Date(selectedYear, selectedMonth, 1))
      const lastDay = formatDateToLocalString(new Date(selectedYear, selectedMonth + 1, 0))

      const estudianteIds = estudiantes.map((e) => e.id)

      if (estudianteIds.length === 0) {
        console.log('⚠️ No hay IDs de estudiantes para consultar asistencias')
        setAsistencias(new Map())
        return
      }

      console.log('🔍 Cargando asistencias:', {
        fcpId,
        selectedAula,
        estudianteIds: estudianteIds.slice(0, 5), // Primeros 5 IDs
        estudianteIdsCount: estudianteIds.length,
        fechaInicio: firstDay,
        fechaFin: lastDay,
        month: selectedMonth,
        year: selectedYear
      })

      // Optimizar: solo seleccionar campos necesarios, no usar select('*')
      // Nota: Si estudianteIds tiene más de 100 elementos, Supabase puede tener límites
      // En ese caso, dividir en lotes
      let query = supabase
        .from('asistencias')
        .select('id, estudiante_id, fecha, estado, fcp_id')
        .eq('fcp_id', fcpId)
        .in('estudiante_id', estudianteIds)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay)

      const { data, error } = await query

      if (error) {
        // Ignorar errores de aborto (son esperados cuando cambian las dependencias rápidamente)
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) {
          return
        }
        console.error('❌ Error en consulta de asistencias:', error)
        throw error
      }

      console.log('✅ Asistencias cargadas:', {
        count: data?.length || 0,
        asistencias: data?.slice(0, 5).map(a => ({
          estudiante_id: a.estudiante_id,
          fecha: a.fecha,
          estado: a.estado
        })),
        fechasUnicas: [...new Set(data?.map(a => a.fecha) || [])].sort()
      })

      const asistenciasMap = new Map<string, Asistencia>()
      data?.forEach((asistencia) => {
        const key = `${asistencia.estudiante_id}_${asistencia.fecha}`
        // Completar campos faltantes con valores por defecto
        asistenciasMap.set(key, {
          ...asistencia,
          observaciones: asistencia.observaciones || undefined,
        } as Asistencia)
      })
      
      // Verificar que los IDs de estudiantes en el mapa coincidan con los estudiantes actuales
      const estudiantesIdsEnMapa = new Set(Array.from(asistenciasMap.keys()).map(k => k.split('_')[0]))
      const estudiantesIdsActuales = new Set(estudianteIds)
      const idsCoinciden = Array.from(estudiantesIdsEnMapa).every(id => estudiantesIdsActuales.has(id))
      
      console.log('📊 Mapa de asistencias creado:', {
        totalKeys: asistenciasMap.size,
        sampleKeys: Array.from(asistenciasMap.keys()).slice(0, 5),
        estudiantesEnConsulta: estudianteIds.length,
        estudiantesEnMapa: estudiantesIdsEnMapa.size,
        idsCoinciden,
        fechasEnMapa: [...new Set(Array.from(asistenciasMap.keys()).map(k => k.split('_')[1]))].sort(),
        muestraEstudiantesEnMapa: Array.from(estudiantesIdsEnMapa).slice(0, 3),
        muestraEstudiantesActuales: Array.from(estudiantesIdsActuales).slice(0, 3)
      })
      
      setAsistencias(asistenciasMap)
      
      // Verificar que las fechas coincidan con las del mes
      const fechasDelMes = daysInMonth.map(d => d.fechaStr)
      const fechasConAsistencias = [...new Set(Array.from(asistenciasMap.keys()).map(k => k.split('_')[1]))]
      const fechasQueCoinciden = fechasDelMes.filter(f => fechasConAsistencias.includes(f))
      console.log('📅 Verificación de fechas:', {
        fechasDelMes: fechasDelMes.slice(0, 5),
        fechasConAsistencias: fechasConAsistencias,
        fechasQueCoinciden: fechasQueCoinciden,
        todasCoinciden: fechasConAsistencias.every(f => fechasDelMes.includes(f))
      })
      
      // Advertencia si los IDs no coinciden
      if (!idsCoinciden) {
        console.warn('⚠️ ADVERTENCIA: Los IDs de estudiantes en el mapa no coinciden completamente con los estudiantes actuales')
      }
    } catch (error: any) {
      // Ignorar errores de aborto
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) {
        return
      }
      console.error('❌ Error loading asistencias:', error)
    }
  }

  const getAsistenciaEstado = (estudianteId: string, fechaStr: string): AsistenciaEstado => {
    const key = `${estudianteId}_${fechaStr}`
    const asistencia = asistencias.get(key)
    
    // Log de depuración para fechas específicas que sabemos que tienen asistencias
    const fechasConAsistencias = ['2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25']
    if (asistencias.size > 0 && estudiantes.length > 0 && estudianteId === estudiantes[0]?.id && fechasConAsistencias.includes(fechaStr)) {
      console.log('🔍 getAsistenciaEstado para fecha con asistencia:', {
        estudianteId: estudianteId.substring(0, 8),
        fechaStr,
        key,
        existeEnMapa: asistencias.has(key),
        estado: asistencia?.estado || null,
        totalKeysEnMapa: asistencias.size,
        keysParaEstaFecha: Array.from(asistencias.keys()).filter(k => k.includes(fechaStr)).slice(0, 3),
        keysParaEsteEstudiante: Array.from(asistencias.keys()).filter(k => k.startsWith(estudianteId)).slice(0, 3)
      })
    }
    
    return asistencia?.estado || null
  }

  // Validar cuántos estudiantes tienen asistencia marcada en una fecha
  const getEstudiantesMarcadosPorFecha = (fechaStr: string): { marcados: number; total: number; faltantes: number } => {
    const total = estudiantes.length
    const marcados = estudiantes.filter(est => {
      const key = `${est.id}_${fechaStr}`
      return asistencias.has(key)
    }).length
    const faltantes = total - marcados
    return { marcados, total, faltantes }
  }

  const saveAsistencia = async (
    estudianteId: string,
    fechaStr: string,
    estado: 'presente' | 'falto' | 'permiso'
  ) => {
    // Validar permisos: solo director y secretario pueden registrar/editar asistencias
    if (!canEdit || (role !== 'director' && role !== 'secretario')) {
      return
    }

    const key = `${estudianteId}_${fechaStr}`
    const existingAsistencia = asistencias.get(key)

    try {
      setSaving((prev) => new Set(prev).add(key))
      const supabase = createClient()

      if (existingAsistencia) {
        // Actualizar asistencia existente
        const { data, error } = await supabase
          .from('asistencias')
          .update({
            estado,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAsistencia.id)
          .select()
          .single()

        if (error) throw error

        // Actualizar estado local
        setAsistencias((prev) => {
          const updated = new Map(prev)
          updated.set(key, { ...existingAsistencia, estado, ...data })
          return updated
        })
      } else {
        // Intentar insertar, si existe (409), actualizar por estudiante_id y fecha
        const { data, error } = await supabase
          .from('asistencias')
          .insert({
            estudiante_id: estudianteId,
            fecha: fechaStr,
            estado,
            fcp_id: fcpId,
          })
          .select()
          .single()

        if (error) {
          // Si el error es 409 (Conflict), la asistencia ya existe, intentar actualizar
          if (error.code === '23505' || error.message?.includes('409') || error.message?.includes('duplicate')) {
            // Buscar la asistencia existente y actualizarla
            const { data: existingData, error: fetchError } = await supabase
              .from('asistencias')
              .select('*')
              .eq('estudiante_id', estudianteId)
              .eq('fecha', fechaStr)
              .eq('fcp_id', fcpId)
              .single()

            if (fetchError) throw fetchError

            // Actualizar la asistencia existente
            const { data: updatedData, error: updateError } = await supabase
              .from('asistencias')
              .update({
                estado,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingData.id)
              .select()
              .single()

            if (updateError) throw updateError

            // Actualizar estado local - usar el objeto completo de existingData actualizado
            setAsistencias((prev) => {
              const updated = new Map(prev)
              updated.set(key, { ...existingData, estado, ...updatedData })
              return updated
            })
          } else {
            throw error
          }
        } else {
          // Actualizar estado local con la nueva asistencia
          setAsistencias((prev) => {
            const updated = new Map(prev)
            updated.set(key, data)
            return updated
          })
        }
      }
    } catch (error: any) {
      console.error('Error saving asistencia:', error)
      // Solo mostrar alerta si no es un error de aborto
      if (!error?.message?.includes('AbortError') && !error?.message?.includes('aborted')) {
        alert('Error al guardar asistencia. Por favor, intenta nuevamente.')
      }
    } finally {
      setSaving((prev) => {
        const updated = new Set(prev)
        updated.delete(key)
        return updated
      })
    }
  }

  const handleCellClick = (
    estudianteId: string,
    fechaStr: string,
    isDoubleClick: boolean = false
  ) => {
    // Validar permisos: solo director y secretario pueden registrar/editar asistencias
    if (!canEdit || (role !== 'director' && role !== 'secretario')) {
      return
    }

    const currentEstado = getAsistenciaEstado(estudianteId, fechaStr)

    let newEstado: 'presente' | 'falto' | 'permiso'

    if (isDoubleClick) {
      // Doble click = faltó
      newEstado = 'falto'
    } else {
      // Click simple = alternar: null -> presente, presente -> faltó, faltó -> permiso, permiso -> presente
      if (!currentEstado) {
        newEstado = 'presente'
      } else if (currentEstado === 'presente') {
        newEstado = 'falto'
      } else if (currentEstado === 'falto') {
        newEstado = 'permiso'
      } else {
        newEstado = 'presente'
      }
    }

    saveAsistencia(estudianteId, fechaStr, newEstado)
  }

  const handleCellMouseDown = (estudianteId: string, fechaStr: string) => {
    // Validar permisos: solo director y secretario pueden registrar/editar asistencias
    if (!canEdit || (role !== 'director' && role !== 'secretario')) {
      return
    }

    // Limpiar timer previo si existe
    const key = `${estudianteId}_${fechaStr}`
    const existingTimer = longPressTimerRef.current.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Configurar timer para click sostenido (permiso)
    const timer = setTimeout(() => {
      saveAsistencia(estudianteId, fechaStr, 'permiso')
      longPressTimerRef.current.delete(key)
    }, 500) // 500ms = medio segundo de presión

    longPressTimerRef.current.set(key, timer)
  }

  const handleCellMouseUp = (estudianteId: string, fechaStr: string) => {
    const key = `${estudianteId}_${fechaStr}`
    const timer = longPressTimerRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      longPressTimerRef.current.delete(key)
    }
  }

  const handleCellMouseLeave = (estudianteId: string, fechaStr: string) => {
    const key = `${estudianteId}_${fechaStr}`
    const timer = longPressTimerRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      longPressTimerRef.current.delete(key)
    }
  }

  const handleMarkAllPresente = async (fechaStr: string) => {
    // Validar permisos: solo director y secretario pueden registrar/editar asistencias
    if (!canEdit || !selectedAula || (role !== 'director' && role !== 'secretario')) {
      return
    }

    // Marcar la fecha como guardándose (mostrar ⏳ en el botón)
    setSavingDates((prev) => new Set(prev).add(fechaStr))

    // Actualización optimista: actualizar el estado local inmediatamente para mostrar los iconos
    setAsistencias((prev) => {
      const updated = new Map(prev)
      estudiantes.forEach((estudiante) => {
        const key = `${estudiante.id}_${fechaStr}`
        const existingAsistencia = prev.get(key)
        
        // Crear o actualizar la asistencia con estado 'presente'
        updated.set(key, {
          id: existingAsistencia?.id || `temp-${estudiante.id}-${fechaStr}`,
          estudiante_id: estudiante.id,
          fecha: fechaStr,
          estado: 'presente',
          fcp_id: fcpId,
          ...existingAsistencia,
        } as Asistencia)
      })
      return updated
    })

    // Guardar en la BD en background
    const supabase = createClient()
    
    // Separar actualizaciones e inserciones para mayor eficiencia
    const toUpdate: Array<{ id: string; estudiante_id: string }> = []
    const toInsert: Array<{ estudiante_id: string; fecha: string; estado: string; fcp_id: string }> = []

    estudiantes.forEach((estudiante) => {
      const key = `${estudiante.id}_${fechaStr}`
      const existingAsistencia = asistencias.get(key)
      
      if (existingAsistencia?.id && !existingAsistencia.id.startsWith('temp-')) {
        toUpdate.push({ id: existingAsistencia.id, estudiante_id: estudiante.id })
      } else {
        toInsert.push({
          estudiante_id: estudiante.id,
          fecha: fechaStr,
          estado: 'presente',
          fcp_id: fcpId,
        })
      }
    })

    // Función helper para completar el guardado
    const completeSave = () => {
      // Quitar el estado de guardando (mostrar ✔️ de nuevo)
      setSavingDates((prev) => {
        const updated = new Set(prev)
        updated.delete(fechaStr)
        return updated
      })

      // Mostrar toast de confirmación
      const fechaDate = new Date(fechaStr)
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
      const dayName = dayNames[fechaDate.getDay()]
      const dayNumber = fechaDate.getDate()
      
      setToast({ message: `Asistencia guardada ${dayName} ${dayNumber}`, date: fechaStr })
      
      // Ocultar toast después de 3 segundos
      setTimeout(() => {
        setToast(null)
      }, 3000)
    }

    // Ejecutar actualizaciones en batch si hay alguna
    const updatePromises = toUpdate.length > 0 
      ? Promise.all(
          toUpdate.map(({ id }) =>
            supabase
              .from('asistencias')
              .update({
                estado: 'presente',
                updated_at: new Date().toISOString(),
              })
              .eq('id', id)
              .select()
              .single()
          )
        )
      : Promise.resolve({ data: [] as any[], error: null })

    // Ejecutar inserciones en batch si hay alguna
    const insertPromise = toInsert.length > 0
      ? supabase
          .from('asistencias')
          .insert(toInsert)
          .select()
      : Promise.resolve({ data: [] as any[], error: null })

    // Esperar a que ambas operaciones terminen
    Promise.all([updatePromises, insertPromise])
      .then(([updateResult, insertResult]) => {
        const hasErrors = (updateResult.error && !updateResult.error.message?.includes('AbortError')) ||
                         (insertResult.error && !insertResult.error.message?.includes('AbortError'))

        if (hasErrors && insertResult.error) {
          // Si hay error en inserciones, intentar individualmente
          toInsert.forEach(async (item) => {
            try {
              const { data: result, error: insertError } = await supabase
                .from('asistencias')
                .insert(item)
                .select()
                .single()

              if (insertError && (insertError.code === '23505' || insertError.message?.includes('409'))) {
                // Ya existe, buscar y actualizar
                const { data: existing } = await supabase
                  .from('asistencias')
                  .select('*')
                  .eq('estudiante_id', item.estudiante_id)
                  .eq('fecha', item.fecha)
                  .eq('fcp_id', item.fcp_id)
                  .single()

                if (existing) {
                  await supabase
                    .from('asistencias')
                    .update({ estado: 'presente', updated_at: new Date().toISOString() })
                    .eq('id', existing.id)
                }
              } else if (result) {
                // Actualizar estado local con el ID real
                setAsistencias((prev) => {
                  const updated = new Map(prev)
                  const key = `${result.estudiante_id}_${result.fecha}`
                  updated.set(key, result)
                  return updated
                })
              }
            } catch (err) {
              console.error('Error handling individual insert:', err)
            }
          })
        }

        // Actualizar estado local con los resultados reales
        if (updateResult.data) {
          setAsistencias((prev) => {
            const updated = new Map(prev)
            updateResult.data.forEach((asistencia: any) => {
              const key = `${asistencia.estudiante_id}_${asistencia.fecha}`
              updated.set(key, asistencia)
            })
            return updated
          })
        }

        if (insertResult.data) {
          setAsistencias((prev) => {
            const updated = new Map(prev)
            insertResult.data.forEach((asistencia: any) => {
              const key = `${asistencia.estudiante_id}_${asistencia.fecha}`
              updated.set(key, asistencia)
            })
            return updated
          })
        }

        // Completar el guardado (quitar ⏳, mostrar toast)
        completeSave()
      })
      .catch((error) => {
        console.error('Error saving asistencias:', error)
        // Aún así, quitar el estado de guardando
        setSavingDates((prev) => {
          const updated = new Set(prev)
          updated.delete(fechaStr)
          return updated
        })
      })
  }

  const handleEliminarTodasAsistencias = async (fechaStr: string) => {
    // Validar permisos: solo director y secretario pueden eliminar asistencias
    if (!canEdit || !selectedAula || (role !== 'director' && role !== 'secretario')) {
      return
    }

    // Confirmar eliminación
    const fechaDate = new Date(fechaStr)
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const dayName = dayNames[fechaDate.getDay()]
    const dayNumber = fechaDate.getDate()
    
    if (!confirm(`¿Estás seguro de que deseas eliminar todas las asistencias del ${dayName} ${dayNumber}?`)) {
      return
    }

    // Marcar la fecha como guardándose
    setSavingDates((prev) => new Set(prev).add(fechaStr))

    try {
      const supabase = createClient()
      
      // Obtener todas las asistencias de esa fecha para los estudiantes del aula
      const estudianteIds = estudiantes.map((e) => e.id)
      
      // Eliminar todas las asistencias de esa fecha
      const { error } = await supabase
        .from('asistencias')
        .delete()
        .eq('fcp_id', fcpId)
        .eq('fecha', fechaStr)
        .in('estudiante_id', estudianteIds)

      if (error) throw error

      // Actualizar estado local: eliminar todas las asistencias de esa fecha
      setAsistencias((prev) => {
        const updated = new Map(prev)
        estudiantes.forEach((estudiante) => {
          const key = `${estudiante.id}_${fechaStr}`
          updated.delete(key)
        })
        return updated
      })

      // Quitar el estado de guardando
      setSavingDates((prev) => {
        const updated = new Set(prev)
        updated.delete(fechaStr)
        return updated
      })

      // Mostrar toast de confirmación
      setToast({ message: `Asistencias eliminadas ${dayName} ${dayNumber}`, date: fechaStr })
      
      // Ocultar toast después de 3 segundos
      setTimeout(() => {
        setToast(null)
      }, 3000)
    } catch (error: any) {
      console.error('Error eliminando asistencias:', error)
      alert('Error al eliminar asistencias. Por favor, intenta nuevamente.')
      
      // Quitar el estado de guardando
      setSavingDates((prev) => {
        const updated = new Set(prev)
        updated.delete(fechaStr)
        return updated
      })
    }
  }

  const getEstadoIcon = (estado: AsistenciaEstado, isSaving: boolean) => {
    if (isSaving) {
      return <Clock className="h-4 w-4 text-gray-400 animate-spin" />
    }

    switch (estado) {
      case 'presente':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'falto':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'permiso':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <div className="h-5 w-5 border border-gray-300 rounded" />
    }
  }

  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${monthNames[month]} ${year}`
  }

  if (!selectedAula) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            Por favor, selecciona un aula para ver las asistencias.
          </p>
          {aulas.length > 0 && (
            <select
              value={selectedAula || ''}
              onChange={(e) => setSelectedAula(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="">Selecciona un aula</option>
              {aulas.map((aula) => (
                <option key={aula.id} value={aula.id}>
                  {aula.nombre}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Control de Asistencia - {formatMonthYear(selectedMonth, selectedYear)}</CardTitle>
          <div className="flex gap-2 items-center">
            {/* Selector de Aula */}
            <select
              value={selectedAula || ''}
              onChange={(e) => setSelectedAula(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {aulas.map((aula) => (
                <option key={aula.id} value={aula.id}>
                  {aula.nombre}
                </option>
              ))}
            </select>

            {/* Selector de Mes */}
            <input
              type="month"
              value={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-')
                setSelectedYear(parseInt(year))
                setSelectedMonth(parseInt(month) - 1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && estudiantes.length === 0 ? (
          <div className="text-center py-8">Cargando estudiantes...</div>
        ) : !loading && estudiantes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay estudiantes en esta aula.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-300 p-2 bg-gray-100 dark:bg-gray-800 sticky left-0 z-10 min-w-[120px] text-left">
                    Código
                  </th>
                  <th className="border border-gray-300 p-2 bg-gray-100 dark:bg-gray-800 sticky left-[120px] z-10 min-w-[180px] text-left">
                    Participante
                  </th>
                  {daysInMonth.map(({ day, date, dayName, fechaStr }) => {
                    const { marcados, total, faltantes } = getEstudiantesMarcadosPorFecha(fechaStr)
                    const todosMarcados = marcados === total && total > 0
                    const hayFaltantes = faltantes > 0 && total > 0 && marcados > 0 // Solo validar si hay al menos uno marcado
                    const esDiaSinAtencion = marcados === 0 && total > 0 // Día sin atención si no hay ninguno marcado
                    
                    return (
                      <th
                        key={`header-${day}-${selectedMonth}-${selectedYear}`}
                        className={`border border-gray-300 p-1 text-center min-w-[60px] ${
                          hayFaltantes ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium">{dayName}</span>
                          <span className="font-semibold">{day}</span>
                          {/* Indicador de validación - solo mostrar si hay al menos un estudiante marcado */}
                          {marcados > 0 && (
                            <span
                              className={`text-[10px] px-1 py-0.5 rounded ${
                                todosMarcados
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : hayFaltantes
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                              title={todosMarcados ? 'Todos los estudiantes marcados' : `${faltantes} estudiante(s) sin marcar`}
                            >
                              {marcados}/{total}
                            </span>
                          )}
                          {/* Indicador opcional para días sin atención (puedes comentar esto si no lo quieres) */}
                          {esDiaSinAtencion && (
                            <span
                              className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              title="Día sin atención"
                            >
                              Sin atención
                            </span>
                          )}
                          {canEdit && (role === 'director' || role === 'secretario') && (
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-700 dark:hover:text-green-300"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAllPresente(fechaStr)
                                }}
                                title="Marcar todos como presentes"
                                disabled={!canEdit || estudiantes.length === 0 || savingDates.has(fechaStr)}
                              >
                                {savingDates.has(fechaStr) ? (
                                  <Clock className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              {/* Verificar si hay asistencias en esta fecha */}
                              {estudiantes.some(est => {
                                const key = `${est.id}_${fechaStr}`
                                return asistencias.has(key)
                              }) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1 text-xs hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEliminarTodasAsistencias(fechaStr)
                                  }}
                                  title="Eliminar todas las asistencias de este día"
                                  disabled={savingDates.has(fechaStr)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((estudiante) => (
                  <tr key={estudiante.id}>
                    <td className="border border-gray-300 p-2 bg-gray-50 dark:bg-gray-900 sticky left-0 font-mono text-xs min-w-[120px]">
                      {estudiante.codigo}
                    </td>
                    <td className="border border-gray-300 p-2 bg-gray-50 dark:bg-gray-900 sticky left-[120px] text-xs min-w-[180px]">
                      {estudiante.nombre_completo}
                    </td>
                    {daysInMonth.map(({ day, date, fechaStr }) => {
                      const estado = getAsistenciaEstado(estudiante.id, fechaStr)
                      const key = `${estudiante.id}_${fechaStr}`
                      const isSaving = saving.has(key)
                      
                      // Log de depuración para las primeras celdas (solo una vez)
                      if (estudiante.id === estudiantes[0]?.id && day <= 5 && asistencias.size > 0) {
                        const existeEnMapa = asistencias.has(key)
                        if (day === 1) {
                          console.log('🔍 Renderizando celda:', {
                            estudianteId: estudiante.id.substring(0, 8),
                            fechaStr,
                            key,
                            existeEnMapa,
                            estado,
                            totalAsistencias: asistencias.size,
                            muestraKeys: Array.from(asistencias.keys()).filter(k => k.includes(fechaStr)).slice(0, 3)
                          })
                        }
                      }

                      return (
                        <td
                          key={day}
                          className={`border border-gray-300 p-1 text-center transition-colors ${
                            (canEdit && (role === 'director' || role === 'secretario'))
                              ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
                              : 'cursor-not-allowed opacity-60'
                          }`}
                          onClick={() => handleCellClick(estudiante.id, fechaStr, false)}
                          onDoubleClick={() => handleCellClick(estudiante.id, fechaStr, true)}
                          onMouseDown={() => handleCellMouseDown(estudiante.id, fechaStr)}
                          onMouseUp={() => handleCellMouseUp(estudiante.id, fechaStr)}
                          onMouseLeave={() => handleCellMouseLeave(estudiante.id, fechaStr)}
                          title={
                            (canEdit && (role === 'director' || role === 'secretario'))
                              ? 'Click: Presente | Doble click: Faltó | Mantén presionado: Permiso'
                              : 'Solo lectura'
                          }
                        >
                          {getEstadoIcon(estado, isSaving)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Toast de confirmación */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </Card>
  )
}

