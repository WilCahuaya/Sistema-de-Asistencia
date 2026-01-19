'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, FileText, Calendar, Download } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useRouter } from 'next/navigation'

interface ReporteAsistenciaPorNivelProps {
  fcpId: string | null
}

interface AulaData {
  id: string
  nombre: string
  tutor?: {
    id: string
    nombre_completo?: string
    email: string
  }
}

interface AsistenciaPorFecha {
  [fecha: string]: {
    presente: number
    permiso: number
    falto: number
    total: number
  }
}

interface TutorData {
  tutorId: string | null
  tutorNombre: string
  aulaId: string
  aulaNombre: string
  asistencias: AsistenciaPorFecha
  totalPresente: number
  totalPermiso: number
  totalFalto: number
  totalRegistros: number
}

interface NivelGroup {
  nivel: string // Nombre del aula
  aulas: TutorData[]
  totalPresente: number
  totalPermiso: number
  totalFalto: number
  totalRegistros: number
  diasIncompletos: Array<{ fecha: string; aulaId: string; tutorNombre: string; marcados: number; total: number }> // Días donde no todos los estudiantes están marcados
}

interface DiaIncompleto {
  fecha: string
  fechaFormateada: string
  nivel: string
  tutorNombre: string
  marcados: number
  total: number
  aulaId: string
}

export function ReporteAsistenciaPorNivel({ fcpId: fcpIdProp }: ReporteAsistenciaPorNivelProps) {
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedFCP, setSelectedFCP] = useState<string | null>(fcpIdProp || null)
  const [userFCPs, setUserFCPs] = useState<Array<{ id: string; nombre: string }>>([])
  const [reporteData, setReporteData] = useState<{
    ong: { id: string; razon_social: string; numero_identificacion?: string }
    year: number
    month: number
    niveles: NivelGroup[]
    fechasUnicas: string[] // Solo fechas completas (todos marcados o día sin atención)
    diasIncompletos: DiaIncompleto[] // Días que no se completaron
  } | null>(null)
  const [responsable, setResponsable] = useState<{ nombre: string; email: string; rol: string } | null>(null)
  const [isFacilitador, setIsFacilitador] = useState(false)
  const { canViewReports, loading: roleLoading } = useUserRole(selectedFCP)
  const router = useRouter()

  useEffect(() => {
    const initialize = async () => {
      await checkIfFacilitador()
      if (fcpIdProp) {
        setSelectedFCP(fcpIdProp)
      }
      await loadUserONGs()
    }
    initialize()
  }, [fcpIdProp])

  const checkIfFacilitador = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: usuarioOngData, error: usuarioOngError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (usuarioOngError) {
        console.error('Error checking facilitador:', usuarioOngError)
        return
      }

      setIsFacilitador(usuarioOngData && usuarioOngData.length > 0)
    } catch (error) {
      console.error('Error checking facilitador:', error)
    }
  }

  const loadUserONGs = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el usuario es facilitador en alguna ONG
      const { data: usuarioOngData, error: usuarioOngError } = await supabase
        .from('fcp_miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('rol', 'facilitador')
        .eq('activo', true)
        .limit(1)

      if (usuarioOngError) throw usuarioOngError

      const isFacilitador = usuarioOngData && usuarioOngData.length > 0

      let ongs: Array<{ id: string; nombre: string }> = []

      if (isFacilitador) {
        // Facilitadores pueden ver todas las ONGs del sistema
        const { data: todasLasONGs, error: ongsError } = await supabase
          .from('fcps')
          .select('id, razon_social')
          .eq('activa', true)
          .order('razon_social', { ascending: true })
        
        if (ongsError) throw ongsError
        ongs = todasLasONGs || []
      } else {
        // Usuarios no facilitadores solo ven sus ONGs
        const { data, error } = await supabase
          .from('fcp_miembros')
          .select(`
            fcp_id,
            fcp:fcps(id, razon_social)
          `)
          .eq('usuario_id', user.id)
          .eq('activo', true)

        if (error) throw error

        ongs = data?.map((item: any) => ({
          id: item.ong.id,
          nombre: item.ong.razon_social || item.ong.numero_identificacion || 'FCP',
        })) || []
      }

      setUserFCPs(ongs)
      if (ongs.length > 0 && !selectedFCP) {
        setSelectedFCP(ongs[0].id)
      }
    } catch (error) {
      console.error('Error loading ONGs:', error)
    }
  }

  const generarReporte = async () => {
    if (!selectedFCP) {
      alert('Por favor, selecciona una ONG')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // Obtener datos del usuario actual (responsable)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Obtener rol y datos del usuario en la ONG
        const { data: usuarioOngData, error: usuarioOngError } = await supabase
          .from('fcp_miembros')
          .select(`
            rol,
            usuario:usuarios(nombre_completo, email)
          `)
          .eq('usuario_id', user.id)
          .eq('fcp_id', selectedFCP)
          .eq('activo', true)
          .single()

        if (!usuarioOngError && usuarioOngData) {
          const usuario = usuarioOngData.usuario as any
          const rol = usuarioOngData.rol === 'facilitador' ? 'Facilitador' : usuarioOngData.rol === 'director' ? 'Director' : usuarioOngData.rol === 'secretario' ? 'Secretario' : ''
          if (rol && (rol === 'Facilitador' || rol === 'Secretario')) {
            setResponsable({
              nombre: usuario?.nombre_completo || usuario?.email || user.email || '',
              email: usuario?.email || user.email || '',
              rol,
            })
          }
        }
      }

      // Obtener datos de la ONG
      const { data: ongData, error: ongError } = await supabase
        .from('fcps')
        .select('id, razon_social')
        .eq('id', selectedFCP)
        .single()

      if (ongError) throw ongError

      // Obtener todas las aulas de la ONG con sus tutores
      const { data: aulasData, error: aulasError } = await supabase
        .from('aulas')
        .select(`
          id,
          nombre,
          tutor_aula!inner(
            fcp_miembro:fcp_miembros!inner(
              usuario_id,
              usuario:usuarios(id, email, nombre_completo)
            )
          )
        `)
        .eq('fcp_id', selectedFCP)
        .eq('activa', true)
        .eq('tutor_aula.activo', true)

      if (aulasError && aulasError.code !== 'PGRST116') {
        throw aulasError
      }

      // Si no hay aulas con tutores asignados, intentar obtener todas las aulas
      let aulas: AulaData[] = []
      if (!aulasData || aulasData.length === 0) {
        const { data: todasLasAulas, error: todasLasAulasError } = await supabase
          .from('aulas')
          .select('id, razon_social')
          .eq('fcp_id', selectedFCP)
          .eq('activa', true)

        if (todasLasAulasError) throw todasLasAulasError
        aulas = (todasLasAulas || []).map(a => ({ id: a.id, nombre: a.nombre }))
      } else {
        aulas = (aulasData || []).map((a: any) => {
          const tutorAula = Array.isArray(a.tutor_aula) ? a.tutor_aula[0] : a.tutor_aula
          const fcpMiembro = tutorAula?.fcp_miembro
          const usuario = fcpMiembro?.usuario
          
          return {
            id: a.id,
            nombre: a.nombre,
            tutor: usuario ? {
              id: usuario.id,
              nombre_completo: usuario.nombre_completo || undefined,
              email: usuario.email,
            } : undefined,
          }
        })
      }

      // Obtener todas las aulas sin tutores para incluirlas también
      if (aulas.length > 0) {
        const aulasIds = aulas.map(a => a.id)
        const { data: todasLasAulas, error: todasLasAulasError } = await supabase
          .from('aulas')
          .select('id, razon_social')
          .eq('fcp_id', selectedFCP)
          .eq('activa', true)

        if (!todasLasAulasError && todasLasAulas) {
          const aulasSinTutor = todasLasAulas.filter(a => !aulasIds.includes(a.id))
          aulas.push(...aulasSinTutor.map(a => ({ id: a.id, nombre: a.nombre })))
        }
      }

      console.log('📚 Aulas cargadas en reporte:', {
        total: aulas.length,
        aulas: aulas.map(a => ({ 
          id: a.id, 
          nombre: a.nombre, 
          tutor: a.tutor?.nombre_completo || a.tutor?.email || 'Sin tutor' 
        })),
        aulasPorNombre: aulas.reduce((acc, aula) => {
          if (!acc[aula.nombre]) acc[aula.nombre] = []
          acc[aula.nombre].push({ id: aula.id, tutor: aula.tutor?.nombre_completo || aula.tutor?.email || 'Sin tutor' })
          return acc
        }, {} as Record<string, Array<{ id: string; tutor: string }>>),
      })

      // Calcular rango de fechas del mes
      const firstDay = new Date(selectedYear, selectedMonth, 1)
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
      const fechaInicio = firstDay.toISOString().split('T')[0]
      const fechaFin = lastDay.toISOString().split('T')[0]

      // Obtener estudiantes por aula
      const { data: estudiantesData, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select('id, codigo, nombre_completo, aula_id')
        .eq('fcp_id', selectedFCP)
        .eq('activo', true)
        .in('aula_id', aulas.map(a => a.id))

      if (estudiantesError) throw estudiantesError

      // Obtener asistencias del mes
      const estudianteIds = estudiantesData?.map(e => e.id) || []
      
      console.log('🔍 Debug ReporteAsistenciaPorNivel:', {
        fcpId: selectedFCP,
        estudiantesCount: estudiantesData?.length || 0,
        estudianteIds: estudianteIds.slice(0, 3), // Primeros 3 IDs
        fechaInicio,
        fechaFin,
        year: selectedYear,
        month: selectedMonth,
      })
      
      const { data: asistenciasData, error: asistenciasError } = await supabase
        .from('asistencias')
        .select('estudiante_id, fecha, estado')
        .eq('fcp_id', selectedFCP)
        .in('estudiante_id', estudianteIds)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)

      console.log('📊 Asistencias en reporte:', {
        count: asistenciasData?.length || 0,
        fechasUnicas: [...new Set(asistenciasData?.map(a => a.fecha) || [])].sort(),
        muestra: asistenciasData?.slice(0, 5).map(a => ({ estudiante_id: a.estudiante_id, fecha: a.fecha, estado: a.estado })),
        asistenciasPorEstudiante: estudiantesData?.map(e => ({
          id: e.id,
          codigo: e.codigo,
          nombre: e.nombre_completo,
          aula_id: e.aula_id,
          asistenciasCount: asistenciasData?.filter(a => a.estudiante_id === e.id).length || 0,
          fechas: [...new Set(asistenciasData?.filter(a => a.estudiante_id === e.id).map(a => a.fecha) || [])].sort(),
        })),
      })

      if (asistenciasError) throw asistenciasError

      // Agrupar asistencias por aula y tutor
      const nivelesMap = new Map<string, NivelGroup>()
      const fechasSet = new Set<string>()

      const diasIncompletosGlobales: DiaIncompleto[] = []

      aulas.forEach(aula => {
        const estudiantesDeAula = estudiantesData?.filter(e => e.aula_id === aula.id) || []
        const totalEstudiantes = estudiantesDeAula.length
        const asistenciasPorFecha: AsistenciaPorFecha = {}
        const diasIncompletosAula: Array<{ fecha: string; aulaId: string; tutorNombre: string; marcados: number; total: number }> = []
        const tutorNombre = aula.tutor?.nombre_completo || aula.tutor?.email || 'Sin tutor asignado'
        const tutorId = aula.tutor?.id || null
        
        let totalPresente = 0
        let totalPermiso = 0
        let totalFalto = 0
        let totalRegistros = 0

        // 1. Primero procesar todas las asistencias por fecha (sin agregar a totales todavía)
        estudiantesDeAula.forEach(estudiante => {
          const asistenciasEstudiante = asistenciasData?.filter(a => a.estudiante_id === estudiante.id) || []
          
          asistenciasEstudiante.forEach(asistencia => {
            const fecha = asistencia.fecha
            
            if (!asistenciasPorFecha[fecha]) {
              asistenciasPorFecha[fecha] = {
                presente: 0,
                permiso: 0,
                falto: 0,
                total: 0,
              }
            }

            asistenciasPorFecha[fecha].total++
            if (asistencia.estado === 'presente') {
              asistenciasPorFecha[fecha].presente++
            } else if (asistencia.estado === 'permiso') {
              asistenciasPorFecha[fecha].permiso++
            } else if (asistencia.estado === 'falto') {
              asistenciasPorFecha[fecha].falto++
            }
          })
        })

        // 2. Validar días completos: solo incluir días donde todos los estudiantes están marcados o ningún estudiante está marcado (día sin atención)
        const fechasParaEliminar: string[] = []
        Object.keys(asistenciasPorFecha).forEach(fecha => {
          const marcadosEnFecha = asistenciasPorFecha[fecha].total
          // Si hay al menos uno marcado pero no todos, es un día incompleto
          if (marcadosEnFecha > 0 && marcadosEnFecha < totalEstudiantes) {
            diasIncompletosAula.push({
              fecha,
              aulaId: aula.id,
              tutorNombre,
              marcados: marcadosEnFecha,
              total: totalEstudiantes,
            })
            
            // También agregar a la lista global
            // Parsear fecha como fecha local para evitar problemas de zona horaria
            const [year, month, day] = fecha.split('-').map(Number)
            const fechaDate = new Date(year, month - 1, day)
            if (fechaDate.getFullYear() === selectedYear && fechaDate.getMonth() === selectedMonth) {
              diasIncompletosGlobales.push({
                fecha,
                fechaFormateada: fechaDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
                nivel: aula.nombre,
                tutorNombre,
                marcados: marcadosEnFecha,
                total: totalEstudiantes,
                aulaId: aula.id,
              })
            }
            
            // Marcar para eliminar (este día no se incluirá en los totales)
            fechasParaEliminar.push(fecha)
          } else if (marcadosEnFecha === totalEstudiantes || marcadosEnFecha === 0) {
            // Día completo o día sin atención: incluir en fechasSet y contar en totales
            fechasSet.add(fecha)
            
            // Agregar a totales solo si es un día completo o día sin atención
            const asistenciaFecha = asistenciasPorFecha[fecha]
            totalPresente += asistenciaFecha.presente
            totalPermiso += asistenciaFecha.permiso
            totalFalto += asistenciaFecha.falto
            totalRegistros += asistenciaFecha.total
          }
        })
        
        // 3. Eliminar días incompletos del objeto asistenciasPorFecha (no se mostrarán en el reporte)
        fechasParaEliminar.forEach(fecha => {
          delete asistenciasPorFecha[fecha]
        })

        if (!nivelesMap.has(aula.nombre)) {
          nivelesMap.set(aula.nombre, {
            nivel: aula.nombre,
            aulas: [],
            totalPresente: 0,
            totalPermiso: 0,
            totalFalto: 0,
            totalRegistros: 0,
          })
        }

        const nivelGroup = nivelesMap.get(aula.nombre)!
        nivelGroup.aulas.push({
          tutorId,
          tutorNombre,
          aulaId: aula.id,
          aulaNombre: aula.nombre,
          asistencias: asistenciasPorFecha,
          totalPresente,
          totalPermiso,
          totalFalto,
          totalRegistros,
        })

        nivelGroup.totalPresente += totalPresente
        nivelGroup.totalPermiso += totalPermiso
        nivelGroup.totalFalto += totalFalto
        nivelGroup.totalRegistros += totalRegistros
      })

      // Filtrar y ordenar fechas: solo las del mes seleccionado, ordenadas por fecha
      const fechasUnicas = Array.from(fechasSet)
        .filter(fecha => {
          const fechaDate = new Date(fecha)
          return fechaDate.getFullYear() === selectedYear && 
                 fechaDate.getMonth() === selectedMonth
        })
        .sort((a, b) => {
          const dateA = new Date(a)
          const dateB = new Date(b)
          return dateA.getTime() - dateB.getTime()
        })

      setReporteData({
        ong: {
          id: ongData.id,
          razon_social: ongData.razon_social || ongData.numero_identificacion || 'FCP',
          numero_identificacion: ongData.numero_identificacion,
        },
        year: selectedYear,
        month: selectedMonth,
        niveles: Array.from(nivelesMap.values()).sort((a, b) => a.nivel.localeCompare(b.nivel)),
        fechasUnicas, // Solo fechas completas
        diasIncompletos: diasIncompletosGlobales.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      })
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Error al generar el reporte. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = async () => {
    if (!reporteData) return

    try {
      const XLSX = await import('xlsx-js-style')

      // Crear workbook
      const wb = XLSX.utils.book_new()

      // Preparar datos para Excel
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]

      // Estilos comunes
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '4472C4' } }, // Azul
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      }

      const cellStyle = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { vertical: 'center' },
      }

      const subtotalStyle = {
        ...cellStyle,
        font: { bold: true },
        fill: { fgColor: { rgb: 'E7E6E6' } }, // Gris claro
      }

      // Helper para aplicar estilos a un rango
      const applyStyle = (ws: any, range: string, style: any) => {
        const cellRange = XLSX.utils.decode_range(range)
        for (let R = cellRange.s.r; R <= cellRange.e.r; ++R) {
          for (let C = cellRange.s.c; C <= cellRange.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ c: C, r: R })
            if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' }
            ws[cellAddress].s = style
          }
        }
      }

      const header = [
        'Nive',
        'TUTOR',
        ...reporteData.fechasUnicas.map(f => {
          // Parsear fecha como fecha local para evitar problemas de zona horaria
          const [year, month, day] = f.split('-').map(Number)
          const date = new Date(year, month - 1, day)
          return date.getDate().toString()
        }),
        'Asis.Pro.m',
        'Reg.Pro.m',
        '% Asistió',
        '% Permiso',
        '% Faltó',
      ]

      const rows: any[] = []
      const subtotalRows: number[] = [] // Índices de filas de subtotal

      reporteData.niveles.forEach(nivel => {
        nivel.aulas.forEach((aula, index) => {
          const row: any[] = [
            index === 0 ? nivel.nivel : '', // Solo mostrar nivel en la primera fila
            aula.tutorNombre,
          ]

          // Agregar asistencias por fecha
          reporteData.fechasUnicas.forEach(fecha => {
            const asistenciaFecha = aula.asistencias[fecha]
            if (asistenciaFecha) {
              row.push(asistenciaFecha.presente)
            } else {
              row.push('')
            }
          })

          // Totales
          row.push(aula.totalPresente) // Asis.Pro.m
          row.push(aula.totalRegistros) // Reg.Pro.m
          
          // Porcentajes
          const porcentajeAsistio = aula.totalRegistros > 0
            ? ((aula.totalPresente / aula.totalRegistros) * 100).toFixed(2)
            : '0.00'
          const porcentajePermiso = aula.totalRegistros > 0
            ? ((aula.totalPermiso / aula.totalRegistros) * 100).toFixed(2)
            : '0.00'
          const porcentajeFalto = aula.totalRegistros > 0
            ? ((aula.totalFalto / aula.totalRegistros) * 100).toFixed(2)
            : '0.00'
          row.push(`${porcentajeAsistio}%`)
          row.push(`${porcentajePermiso}%`)
          row.push(`${porcentajeFalto}%`)

          rows.push(row)
        })

        // Fila de subtotal
        const subtotalRow: any[] = [
          nivel.nivel,
          'Subtotal',
        ]

        reporteData.fechasUnicas.forEach(fecha => {
          const totalFecha = nivel.aulas.reduce((sum, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sum + (asistenciaFecha?.presente || 0)
          }, 0)
          subtotalRow.push(totalFecha)
        })

        subtotalRow.push(nivel.totalPresente) // Asis.Pro.m
        subtotalRow.push(nivel.totalRegistros) // Reg.Pro.m
        
        const porcentajeAsistioNivel = nivel.totalRegistros > 0
          ? ((nivel.totalPresente / nivel.totalRegistros) * 100).toFixed(2)
          : '0.00'
        const porcentajePermisoNivel = nivel.totalRegistros > 0
          ? ((nivel.totalPermiso / nivel.totalRegistros) * 100).toFixed(2)
          : '0.00'
        const porcentajeFaltoNivel = nivel.totalRegistros > 0
          ? ((nivel.totalFalto / nivel.totalRegistros) * 100).toFixed(2)
          : '0.00'
        subtotalRow.push(`${porcentajeAsistioNivel}%`)
        subtotalRow.push(`${porcentajePermisoNivel}%`)
        subtotalRow.push(`${porcentajeFaltoNivel}%`)

        subtotalRows.push(rows.length) // Guardar índice de fila de subtotal
        rows.push(subtotalRow)
      })

      // Calcular totales generales
      const totalGeneralPresente = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPresente, 0)
      const totalGeneralPermiso = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPermiso, 0)
      const totalGeneralFalto = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalFalto, 0)
      const totalGeneralRegistros = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalRegistros, 0)

      // Fila de Total General
      const totalGeneralRow: any[] = [
        'Total General',
        '',
      ]

      reporteData.fechasUnicas.forEach(fecha => {
        const totalFecha = reporteData.niveles.reduce((sum, nivel) => {
          const totalFechaNivel = nivel.aulas.reduce((sumAula, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sumAula + (asistenciaFecha?.presente || 0)
          }, 0)
          return sum + totalFechaNivel
        }, 0)
        totalGeneralRow.push(totalFecha)
      })

      totalGeneralRow.push(totalGeneralPresente) // Asis.Pro.m
      totalGeneralRow.push(totalGeneralRegistros) // Reg.Pro.m
      
      const porcentajeAsistioGeneral = totalGeneralRegistros > 0
        ? ((totalGeneralPresente / totalGeneralRegistros) * 100).toFixed(2)
        : '0.00'
      const porcentajePermisoGeneral = totalGeneralRegistros > 0
        ? ((totalGeneralPermiso / totalGeneralRegistros) * 100).toFixed(2)
        : '0.00'
      const porcentajeFaltoGeneral = totalGeneralRegistros > 0
        ? ((totalGeneralFalto / totalGeneralRegistros) * 100).toFixed(2)
        : '0.00'
      totalGeneralRow.push(`${porcentajeAsistioGeneral}%`)
      totalGeneralRow.push(`${porcentajePermisoGeneral}%`)
      totalGeneralRow.push(`${porcentajeFaltoGeneral}%`)

      const totalGeneralRowIndex = rows.length
      rows.push(totalGeneralRow)

      // Número de filas del encabezado (título, info, fila vacía, header)
      const headerRows = responsable ? 9 : 7
      const headerRowIndex = headerRows - 1 // Índice de la fila de encabezado (0-based)

      // Preparar datos con encabezado
      const encabezado = [
        [`Reporte de Asistencia por Nivel`],
        [],
        [`Proyecto: ${reporteData.ong.razon_social}`],
        [`Año: ${reporteData.year}`],
        [`Mes: ${monthNames[reporteData.month]} ${reporteData.year}`],
        ...(responsable ? [[`Responsable: ${responsable.nombre} (${responsable.rol})`], [`Email: ${responsable.email}`]] : []),
        [],
        header,
        ...rows,
      ]
      const ws = XLSX.utils.aoa_to_sheet(encabezado)
      
      // Aplicar estilos
      // Título
      ws['A1'].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }
      
      // Encabezado de tabla
      const headerRange = XLSX.utils.encode_range({ s: { c: 0, r: headerRowIndex }, e: { c: header.length - 1, r: headerRowIndex } })
      applyStyle(ws, headerRange, headerStyle)
      
      // Celdas de datos
      if (rows.length > 0) {
        const dataStartRow = headerRowIndex + 1
        const dataEndRow = headerRowIndex + rows.length
        const dataRange = XLSX.utils.encode_range({ s: { c: 0, r: dataStartRow }, e: { c: header.length - 1, r: dataEndRow } })
        applyStyle(ws, dataRange, cellStyle)
      }
      
      // Filas de subtotal
      subtotalRows.forEach((subtotalIndex) => {
        const subtotalRow = headerRowIndex + 1 + subtotalIndex
        const subtotalRange = XLSX.utils.encode_range({ s: { c: 0, r: subtotalRow }, e: { c: header.length - 1, r: subtotalRow } })
        applyStyle(ws, subtotalRange, subtotalStyle)
      })
      
      // Fila de Total General
      const totalGeneralRowExcel = headerRowIndex + 1 + totalGeneralRowIndex
      const totalGeneralRange = XLSX.utils.encode_range({ s: { c: 0, r: totalGeneralRowExcel }, e: { c: header.length - 1, r: totalGeneralRowExcel } })
      const totalGeneralStyle = {
        ...cellStyle,
        font: { bold: true },
        fill: { fgColor: { rgb: 'B4C6E7' } }, // Azul claro para diferenciarlo del subtotal
      }
      applyStyle(ws, totalGeneralRange, totalGeneralStyle)
      
      // Anchos de columna
      const colWidths = [
        { wch: 15 }, // Nivel
        { wch: 30 }, // TUTOR
        ...reporteData.fechasUnicas.map(() => ({ wch: 8 })), // Fechas
        { wch: 12 }, // Asis.Pro.m
        { wch: 12 }, // Reg.Pro.m
        { wch: 12 }, // % Asistió
        { wch: 12 }, // % Permiso
        { wch: 12 }, // % Faltó
      ]
      ws['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte por Nivel')

      // Descargar
      const nombreArchivo = `Reporte_Asistencia_por_Nivel_${reporteData.ong.razon_social}_${monthNames[reporteData.month]}_${reporteData.year}.xlsx`
      XLSX.writeFile(wb, nombreArchivo)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Error al exportar a Excel. Por favor, intenta nuevamente.')
    }
  }

  const exportarPDF = async () => {
    if (!reporteData) return

    try {
      // Importar jsPDF
      const jsPDF = (await import('jspdf')).default
      
      // Importar jspdf-autotable (puede ser default o named export)
      const autotableModule = await import('jspdf-autotable')
      
      // Extraer autoTable del módulo (puede estar como named export o default)
      let autoTable: any = null
      if ((autotableModule as any).autoTable && typeof (autotableModule as any).autoTable === 'function') {
        autoTable = (autotableModule as any).autoTable
      } else if ((autotableModule as any).default && typeof (autotableModule as any).default === 'function') {
        autoTable = (autotableModule as any).default
      }
      
      // Intentar aplicar el plugin si existe applyPlugin
      if ((autotableModule as any).applyPlugin && typeof (autotableModule as any).applyPlugin === 'function') {
        (autotableModule as any).applyPlugin(jsPDF)
      }
      
      const doc = new jsPDF('landscape') // Orientación horizontal para más espacio
      
      // Log para debugging (remover en producción si es necesario)
      console.log('autoTable disponible:', typeof autoTable === 'function')
      console.log('doc.autoTable disponible:', typeof (doc as any).autoTable === 'function')
      const pageWidth = doc.internal.pageSize.getWidth()

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]

      let y = 15

      // Título
      doc.setFontSize(16)
      doc.setFont(undefined, 'bold')
      doc.text('Reporte de Asistencia por Nivel', pageWidth / 2, y, { align: 'center' })
      y += 8

      // Información general
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`Proyecto: ${reporteData.ong.razon_social}`, 15, y)
      y += 5
      doc.text(`Año: ${reporteData.year}`, 15, y)
      y += 5
      doc.text(`Mes: ${monthNames[reporteData.month]} ${reporteData.year}`, 15, y)
      if (responsable) {
        y += 5
        doc.text(`Responsable: ${responsable.nombre} (${responsable.rol})`, 15, y)
        y += 3
        doc.setFontSize(9)
        doc.text(`Email: ${responsable.email}`, 15, y)
        doc.setFontSize(10)
      }
      y += 8

      // Advertencia de días incompletos si existen
      if (reporteData.diasIncompletos.length > 0) {
        doc.setFontSize(9)
        doc.setTextColor(255, 140, 0) // Naranja
        doc.text('⚠️ Días con asistencia incompleta (no incluidos en totales):', 15, y)
        y += 5
        doc.setFontSize(8)
        const warningLines: string[] = []
        reporteData.diasIncompletos.slice(0, 5).forEach((dia) => {
          warningLines.push(`• ${dia.fechaFormateada} - ${dia.nivel} (${dia.marcados}/${dia.total})`)
        })
        if (reporteData.diasIncompletos.length > 5) {
          warningLines.push(`... y ${reporteData.diasIncompletos.length - 5} día(s) más`)
        }
        doc.text(warningLines, 20, y)
        y += warningLines.length * 4 + 3
        doc.setTextColor(0, 0, 0) // Volver a negro
      }

      // Preparar datos para la tabla
      const headers: string[] = [
        'Nivel',
        'TUTOR',
        ...reporteData.fechasUnicas.map(f => {
          const date = new Date(f)
          return date.getDate().toString()
        }),
        'Asis.Pro.m',
        'Reg.Pro.m',
        '% Asistió',
        '% Permiso',
        '% Faltó',
      ]

      const body: any[] = []

      reporteData.niveles.forEach((nivel) => {
        nivel.aulas.forEach((aula, aulaIndex) => {
          const row: any[] = [
            aulaIndex === 0 ? nivel.nivel : '', // Solo mostrar nivel en la primera fila
            aula.tutorNombre,
          ]

          // Agregar asistencias por fecha
          reporteData.fechasUnicas.forEach(fecha => {
            const asistenciaFecha = aula.asistencias[fecha]
            row.push(asistenciaFecha ? asistenciaFecha.presente.toString() : '')
          })

          // Totales
          row.push(aula.totalPresente.toString()) // Asis.Pro.m
          row.push(aula.totalRegistros.toString()) // Reg.Pro.m
          
          // Porcentajes
          const porcentajeAsistio = aula.totalRegistros > 0
            ? ((aula.totalPresente / aula.totalRegistros) * 100).toFixed(2)
            : '0.00'
          const porcentajePermiso = aula.totalRegistros > 0
            ? ((aula.totalPermiso / aula.totalRegistros) * 100).toFixed(2)
            : '0.00'
          const porcentajeFalto = aula.totalRegistros > 0
            ? ((aula.totalFalto / aula.totalRegistros) * 100).toFixed(2)
            : '0.00'
          row.push(`${porcentajeAsistio}%`)
          row.push(`${porcentajePermiso}%`)
          row.push(`${porcentajeFalto}%`)

          body.push(row)
        })

        // Fila de subtotal
        const subtotalRow: any[] = [
          nivel.nivel,
          'Subtotal',
        ]

        reporteData.fechasUnicas.forEach(fecha => {
          const totalFecha = nivel.aulas.reduce((sum, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sum + (asistenciaFecha?.presente || 0)
          }, 0)
          subtotalRow.push(totalFecha.toString())
        })

        subtotalRow.push(nivel.totalPresente.toString())
        subtotalRow.push(nivel.totalRegistros.toString())

        const porcentajeAsistioNivel = nivel.totalRegistros > 0
          ? ((nivel.totalPresente / nivel.totalRegistros) * 100).toFixed(2)
          : '0.00'
        const porcentajePermisoNivel = nivel.totalRegistros > 0
          ? ((nivel.totalPermiso / nivel.totalRegistros) * 100).toFixed(2)
          : '0.00'
        const porcentajeFaltoNivel = nivel.totalRegistros > 0
          ? ((nivel.totalFalto / nivel.totalRegistros) * 100).toFixed(2)
          : '0.00'
        subtotalRow.push(`${porcentajeAsistioNivel}%`)
        subtotalRow.push(`${porcentajePermisoNivel}%`)
        subtotalRow.push(`${porcentajeFaltoNivel}%`)

        body.push(subtotalRow)
      })

      // Calcular totales generales
      const totalGeneralPresente = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPresente, 0)
      const totalGeneralPermiso = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPermiso, 0)
      const totalGeneralFalto = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalFalto, 0)
      const totalGeneralRegistros = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalRegistros, 0)

      // Fila de Total General
      const totalGeneralRow: any[] = [
        'Total General',
        '',
      ]

      reporteData.fechasUnicas.forEach(fecha => {
        const totalFecha = reporteData.niveles.reduce((sum, nivel) => {
          const totalFechaNivel = nivel.aulas.reduce((sumAula, a) => {
            const asistenciaFecha = a.asistencias[fecha]
            return sumAula + (asistenciaFecha?.presente || 0)
          }, 0)
          return sum + totalFechaNivel
        }, 0)
        totalGeneralRow.push(totalFecha.toString())
      })

      totalGeneralRow.push(totalGeneralPresente.toString())
      totalGeneralRow.push(totalGeneralRegistros.toString())

      const porcentajeAsistioGeneral = totalGeneralRegistros > 0
        ? ((totalGeneralPresente / totalGeneralRegistros) * 100).toFixed(2)
        : '0.00'
      const porcentajePermisoGeneral = totalGeneralRegistros > 0
        ? ((totalGeneralPermiso / totalGeneralRegistros) * 100).toFixed(2)
        : '0.00'
      const porcentajeFaltoGeneral = totalGeneralRegistros > 0
        ? ((totalGeneralFalto / totalGeneralRegistros) * 100).toFixed(2)
        : '0.00'
      totalGeneralRow.push(`${porcentajeAsistioGeneral}%`)
      totalGeneralRow.push(`${porcentajePermisoGeneral}%`)
      totalGeneralRow.push(`${porcentajeFaltoGeneral}%`)

      body.push(totalGeneralRow)

      // Generar tabla con autoTable (función independiente en versión 5.x)
      // Si autoTable está disponible como método del doc, usarlo; si no, como función
      const tableOptions = {
        startY: y,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [0, 0, 0],
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        styles: {
          cellPadding: 1.5,
          overflow: 'linebreak',
          fontSize: 6.5,
        },
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 1.5,
        },
        bodyStyles: {
          fontSize: 6.5,
          textColor: [0, 0, 0],
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: 18 }, // Nivel - más corto
          1: { cellWidth: 35, cellPadding: 1, overflow: 'linebreak' }, // TUTOR - más corto, permite wrap de texto
          // Fechas: ancho más pequeño
          ...Object.fromEntries(
            reporteData.fechasUnicas.map((_, idx) => [2 + idx, { cellWidth: 8, halign: 'center' }])
          ),
          [2 + reporteData.fechasUnicas.length]: { cellWidth: 'auto', minCellWidth: 18, halign: 'center' }, // Asis.Pro.m
          [3 + reporteData.fechasUnicas.length]: { cellWidth: 'auto', minCellWidth: 18, halign: 'center' }, // Reg.Pro.m
          [4 + reporteData.fechasUnicas.length]: { cellWidth: 'auto', minCellWidth: 16, halign: 'center' }, // % Asistió
          [5 + reporteData.fechasUnicas.length]: { cellWidth: 'auto', minCellWidth: 16, halign: 'center' }, // % Permiso
          [6 + reporteData.fechasUnicas.length]: { cellWidth: 'auto', minCellWidth: 16, halign: 'center' }, // % Faltó
        },
        tableWidth: 'wrap',
        didParseCell: function (data: any) {
          // Resaltar filas de subtotal y total general
          // En versión 5.x, verificar el texto de la celda actual o el contenido de la fila
          try {
            const cellText = (data.cell?.text?.toString() || data.cell?.text || '').toString().trim()
            
            // Si la celda contiene "Subtotal", aplicar estilos a toda la fila
            if (cellText === 'Subtotal') {
              data.cell.styles.fillColor = [230, 230, 230]
              data.cell.styles.fontStyle = 'bold'
              return
            }
            
            // Si la celda contiene "Total General", aplicar estilos más destacados
            if (cellText === 'Total General') {
              data.cell.styles.fillColor = [180, 198, 231] // Azul claro
              data.cell.styles.fontStyle = 'bold'
              return
            }
            
            // Intentar verificar si alguna celda de la fila contiene "Subtotal" o "Total General"
            // En versión 5.x, data puede tener diferentes estructuras
            if (data.table && data.table.body) {
              const rowIndex = data.rowIndex
              if (rowIndex !== undefined && rowIndex >= 0) {
                const row = data.table.body[rowIndex]
                if (row) {
                  // row puede ser un array de celdas o un objeto con celdas
                  const cells = Array.isArray(row) ? row : (row.cells || Object.values(row))
                  if (Array.isArray(cells)) {
                    const hasSubtotal = cells.some((cell: any) => {
                      const text = (cell?.text?.toString() || cell?.text || cell?.toString() || '').toString().trim()
                      return text === 'Subtotal'
                    })
                    
                    const hasTotalGeneral = cells.some((cell: any) => {
                      const text = (cell?.text?.toString() || cell?.text || cell?.toString() || '').toString().trim()
                      return text === 'Total General'
                    })
                    
                    if (hasSubtotal) {
                      data.cell.styles.fillColor = [230, 230, 230]
                      data.cell.styles.fontStyle = 'bold'
                    } else if (hasTotalGeneral) {
                      data.cell.styles.fillColor = [180, 198, 231] // Azul claro
                      data.cell.styles.fontStyle = 'bold'
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Si hay error, simplemente no aplicar estilos especiales
            console.warn('Error en didParseCell:', e)
          }
        },
        margin: { top: y, left: 15, right: 15 },
      }

      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(tableOptions)
      } else if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions)
      } else {
        throw new Error('autoTable no está disponible. Verifica la instalación de jspdf-autotable.')
      }

      // Descargar
      const nombreArchivo = `Reporte_Asistencia_por_Nivel_${reporteData.ong.razon_social}_${monthNames[reporteData.month]}_${reporteData.year}.pdf`
      doc.save(nombreArchivo)
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      alert('Error al exportar a PDF. Por favor, intenta nuevamente.')
    }
  }

  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${monthNames[month]} ${year}`
  }

  if (!selectedFCP && userFCPs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            Cargando FCPs...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!roleLoading && !canViewReports) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            No tienes permisos para ver reportes. Solo los facilitadores, directores y secretarios pueden acceder a esta funcionalidad.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurar Reporte de Asistencia por Nivel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(!fcpIdProp || isFacilitador) && (
              <div>
                <label className="text-sm font-medium mb-2 block">FCP:</label>
                <select
                  value={selectedFCP || ''}
                  onChange={(e) => setSelectedFCP(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  {userFCPs.map((ong) => (
                    <option key={ong.id} value={ong.id}>
                      {ong.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Mes:</label>
              <input
                type="month"
                value={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-')
                  setSelectedYear(parseInt(year))
                  setSelectedMonth(parseInt(month) - 1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
          </div>

          <RoleGuard fcpId={selectedFCP} allowedRoles={['facilitador', 'director', 'secretario']}>
            <div className="mt-4">
              <Button onClick={generarReporte} disabled={loading || !selectedFCP}>
                {loading ? (
                  <>
                    <Calendar className="mr-2 h-4 w-4 animate-pulse" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </>
                )}
              </Button>
            </div>
          </RoleGuard>
        </CardContent>
      </Card>

      {reporteData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Reporte de Asistencia por Nivel</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Proyecto: {reporteData.ong.razon_social} | Año: {reporteData.year} | Mes: {formatMonthYear(reporteData.month, reporteData.year)}
                </p>
                {responsable && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Responsable: {responsable.nombre} ({responsable.rol}) | Email: {responsable.email}
                  </p>
                )}
              </div>
              <RoleGuard fcpId={selectedFCP} allowedRoles={['facilitador', 'director', 'secretario']}>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportarExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button variant="outline" onClick={exportarPDF}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </RoleGuard>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mensaje de días incompletos */}
            {reporteData.diasIncompletos.length > 0 && (
              <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  ⚠️ Días con asistencia incompleta
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                  Los siguientes días no se completó la asistencia de todos los estudiantes. Estos días <strong>no se incluyen</strong> en los totales del reporte:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                  {reporteData.diasIncompletos.map((dia, index) => {
                    // Parsear fecha como fecha local para evitar problemas de zona horaria
                    const [year, month, day] = dia.fecha.split('-').map(Number)
                    const fechaDate = new Date(year, month - 1, day)
                    const yearForUrl = fechaDate.getFullYear()
                    const monthForUrl = fechaDate.getMonth()
                    const asistenciasUrl = `/asistencias?aulaId=${dia.aulaId}&month=${monthForUrl}&year=${yearForUrl}`
                    
                    return (
                      <li key={`${dia.fecha}-${dia.nivel}-${index}`} className="flex items-center justify-between gap-3 p-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
                        <span className="flex-1">
                          • <strong>{dia.fechaFormateada}</strong> - Nivel: <strong>{dia.nivel}</strong> 
                          {' '}(Tutor: {dia.tutorNombre}) - Marcados: {dia.marcados}/{dia.total} estudiantes
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(asistenciasUrl)}
                          className="ml-auto text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
                        >
                          <Calendar className="h-4 w-4 mr-1.5" />
                          Corregir asistencia
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-left">Nivel</th>
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-left">TUTOR</th>
                    {reporteData.fechasUnicas.map((fecha) => {
                      const date = new Date(fecha)
                      return (
                        <th
                          key={fecha}
                          className="border border-gray-300 p-2 bg-blue-600 text-white text-center min-w-[50px]"
                        >
                          {date.getDate()}
                        </th>
                      )
                    })}
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center">Asis.Pro.m</th>
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center">Reg.Pro.m</th>
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center">% Asistió</th>
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center">% Permiso</th>
                    <th className="border border-gray-300 p-2 bg-blue-600 text-white text-center">% Faltó</th>
                  </tr>
                </thead>
                <tbody>
                  {reporteData.niveles.map((nivel, nivelIndex) => (
                    <React.Fragment key={nivel.nivel}>
                      {nivel.aulas.map((aula, aulaIndex) => (
                        <tr key={`${aula.aulaId}-${aulaIndex}`}>
                          <td className="border border-gray-300 p-2 font-semibold">
                            {aulaIndex === 0 ? nivel.nivel : ''}
                          </td>
                          <td className="border border-gray-300 p-2">{aula.tutorNombre}</td>
                          {reporteData.fechasUnicas.map((fecha) => {
                            const asistenciaFecha = aula.asistencias[fecha]
                            return (
                              <td
                                key={fecha}
                                className="border border-gray-300 p-2 text-center"
                              >
                                {asistenciaFecha ? asistenciaFecha.presente : ''}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 p-2 text-center font-semibold">
                            {aula.totalPresente}
                          </td>
                          <td className="border border-gray-300 p-2 text-center font-semibold">
                            {aula.totalRegistros}
                          </td>
                          <td className="border border-gray-300 p-2 text-center font-semibold">
                            {aula.totalRegistros > 0
                              ? ((aula.totalPresente / aula.totalRegistros) * 100).toFixed(2)
                              : '0.00'}%
                          </td>
                          <td className="border border-gray-300 p-2 text-center font-semibold">
                            {aula.totalRegistros > 0
                              ? ((aula.totalPermiso / aula.totalRegistros) * 100).toFixed(2)
                              : '0.00'}%
                          </td>
                          <td className="border border-gray-300 p-2 text-center font-semibold">
                            {aula.totalRegistros > 0
                              ? ((aula.totalFalto / aula.totalRegistros) * 100).toFixed(2)
                              : '0.00'}%
                          </td>
                        </tr>
                      ))}
                      {/* Fila de subtotal */}
                      <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                        <td className="border border-gray-300 p-2">{nivel.nivel}</td>
                        <td className="border border-gray-300 p-2">Subtotal</td>
                        {reporteData.fechasUnicas.map((fecha) => {
                          const totalFecha = nivel.aulas.reduce((sum, a) => {
                            const asistenciaFecha = a.asistencias[fecha]
                            return sum + (asistenciaFecha?.presente || 0)
                          }, 0)
                          return (
                            <td
                              key={fecha}
                              className="border border-gray-300 p-2 text-center"
                            >
                              {totalFecha}
                            </td>
                          )
                        })}
                        <td className="border border-gray-300 p-2 text-center">{nivel.totalPresente}</td>
                        <td className="border border-gray-300 p-2 text-center">{nivel.totalRegistros}</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {nivel.totalRegistros > 0
                            ? ((nivel.totalPresente / nivel.totalRegistros) * 100).toFixed(2)
                            : '0.00'}%
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {nivel.totalRegistros > 0
                            ? ((nivel.totalPermiso / nivel.totalRegistros) * 100).toFixed(2)
                            : '0.00'}%
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {nivel.totalRegistros > 0
                            ? ((nivel.totalFalto / nivel.totalRegistros) * 100).toFixed(2)
                            : '0.00'}%
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {/* Fila de Total General */}
                  {(() => {
                    // Calcular totales generales sumando todos los niveles
                    const totalGeneralPresente = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPresente, 0)
                    const totalGeneralPermiso = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalPermiso, 0)
                    const totalGeneralFalto = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalFalto, 0)
                    const totalGeneralRegistros = reporteData.niveles.reduce((sum, nivel) => sum + nivel.totalRegistros, 0)
                    
                    return (
                      <tr className="bg-blue-100 dark:bg-blue-900 font-bold">
                        <td className="border border-gray-300 p-2">Total General</td>
                        <td className="border border-gray-300 p-2"></td>
                        {reporteData.fechasUnicas.map((fecha) => {
                          const totalFecha = reporteData.niveles.reduce((sum, nivel) => {
                            const totalFechaNivel = nivel.aulas.reduce((sumAula, a) => {
                              const asistenciaFecha = a.asistencias[fecha]
                              return sumAula + (asistenciaFecha?.presente || 0)
                            }, 0)
                            return sum + totalFechaNivel
                          }, 0)
                          return (
                            <td
                              key={fecha}
                              className="border border-gray-300 p-2 text-center"
                            >
                              {totalFecha}
                            </td>
                          )
                        })}
                        <td className="border border-gray-300 p-2 text-center">{totalGeneralPresente}</td>
                        <td className="border border-gray-300 p-2 text-center">{totalGeneralRegistros}</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {totalGeneralRegistros > 0
                            ? ((totalGeneralPresente / totalGeneralRegistros) * 100).toFixed(2)
                            : '0.00'}%
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {totalGeneralRegistros > 0
                            ? ((totalGeneralPermiso / totalGeneralRegistros) * 100).toFixed(2)
                            : '0.00'}%
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {totalGeneralRegistros > 0
                            ? ((totalGeneralFalto / totalGeneralRegistros) * 100).toFixed(2)
                            : '0.00'}%
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

