export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parsearExcelArchivo, type FilaCarta, type FilaFoto } from '@/lib/whatsapp-excel/parser'
import {
  agruparPorTutorConEstudiantes,
  filasAItemsPorCodigo,
  mapAOrdenados,
} from '@/lib/whatsapp-excel/formatMensajes'
import type { EstudianteMin } from '@/lib/whatsapp-excel/resolverTutorPorIdLocal'

async function puedeUsarHerramienta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fcpId: string
): Promise<boolean> {
  const { data: m } = await supabase
    .from('fcp_miembros')
    .select('id')
    .eq('usuario_id', userId)
    .eq('fcp_id', fcpId)
    .eq('activo', true)
    .in('rol', ['director', 'secretario'])
    .maybeSingle()
  return !!m
}

async function loadAulaToTutorYEstudiantes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fcpId: string
): Promise<{ aulaToTutor: Map<string, string>; estudiantes: EstudianteMin[] }> {
  const { data: tutorRows, error: taErr } = await supabase
    .from('tutor_aula')
    .select(
      `
      aula_id,
      fcp_miembro:fcp_miembros(
        nombre_display,
        email_pendiente,
        usuario:usuarios(nombre_completo, email)
      )
    `
    )
    .eq('fcp_id', fcpId)
    .eq('activo', true)

  if (taErr) throw taErr

  const aulaToTutor = new Map<string, string>()
  for (const row of tutorRows || []) {
    const r = row as {
      aula_id: string
      fcp_miembro?: {
        nombre_display?: string | null
        email_pendiente?: string | null
        usuario?: { nombre_completo?: string | null; email?: string | null } | null
      } | null
    }
    if (!r.aula_id || aulaToTutor.has(r.aula_id)) continue
    const fm = r.fcp_miembro
    const u = fm?.usuario
    const display =
      (fm?.nombre_display?.trim() ||
        u?.nombre_completo?.trim() ||
        u?.email ||
        fm?.email_pendiente) ??
      'Sin nombre de tutor'
    aulaToTutor.set(r.aula_id, display)
  }

  const { data: estudiantes, error: eErr } = await supabase
    .from('estudiantes')
    .select('codigo, aula_id')
    .eq('fcp_id', fcpId)

  if (eErr) throw eErr

  const list: EstudianteMin[] = (estudiantes || []).map((e) => ({
    codigo: String(e.codigo ?? ''),
    aula_id: e.aula_id ?? null,
  }))

  return { aulaToTutor, estudiantes: list }
}

/**
 * POST multipart: fcpId (string), files (1–5 .xlsx)
 * Genera mensajes WhatsApp agrupados por tutor del sistema.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const ct = request.headers.get('content-type') || ''
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type debe ser multipart/form-data.' },
        { status: 400 }
      )
    }

    const form = await request.formData()
    const fcpId = form.get('fcpId')
    if (!fcpId || typeof fcpId !== 'string') {
      return NextResponse.json({ error: 'Se requiere fcpId.' }, { status: 400 })
    }

    const ok = await puedeUsarHerramienta(supabase, user.id, fcpId)
    if (!ok) {
      return NextResponse.json(
        { error: 'No tienes permiso para esta FCP (solo director o secretario).' },
        { status: 403 }
      )
    }

    const rawFiles = form.getAll('files')
    const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Adjunta al menos un archivo Excel.' }, { status: 400 })
    }
    if (files.length > 5) {
      return NextResponse.json({ error: 'Máximo 5 archivos.' }, { status: 400 })
    }

    let todasFotos: FilaFoto[] = []
    let todasCartas: FilaCarta[] = []
    const advertencias: string[] = []
    let lectura: {
      archivo: string
      filaEncabezado?: number
      columnas?: Record<string, number>
    } | null = null

    for (const file of files) {
      const name = file.name || 'archivo.xlsx'
      if (!name.toLowerCase().endsWith('.xlsx') && !name.toLowerCase().endsWith('.xls')) {
        advertencias.push(`${name}: solo se admiten .xlsx / .xls.`)
        continue
      }
      const buf = await file.arrayBuffer()
      const parsed = parsearExcelArchivo(buf, name)
      advertencias.push(...parsed.advertencias)
      todasFotos = todasFotos.concat(parsed.fotos)
      todasCartas = todasCartas.concat(parsed.cartas)
      const totalFilas = parsed.fotos.length + parsed.cartas.length
      if (totalFilas > 0 || lectura === null) {
        lectura = {
          archivo: name,
          filaEncabezado: parsed.filaEncabezado,
          columnas: parsed.columnasDetectadas,
        }
      }
    }

    const { aulaToTutor, estudiantes } = await loadAulaToTutorYEstudiantes(supabase, fcpId)
    const itemsPorCodigo = filasAItemsPorCodigo(todasFotos, todasCartas)
    const { map: agrupado, advertenciasResolucion } = agruparPorTutorConEstudiantes(
      itemsPorCodigo,
      estudiantes,
      aulaToTutor
    )
    advertencias.push(...advertenciasResolucion)
    const mensajes = mapAOrdenados(agrupado)

    const conTutor = mensajes.filter((m) => m.tipoGrupo === 'tutor').length
    const sinTutor = mensajes.filter((m) => m.tipoGrupo === 'sin_tutor').length
    const noEnSistema = mensajes.filter((m) => m.tipoGrupo === 'no_en_sistema').length

    return NextResponse.json({
      mensajes,
      advertencias,
      resumen: {
        archivos: files.length,
        filasFoto: todasFotos.length,
        filasCarta: todasCartas.length,
        tutores: conTutor,
        apartadosSinTutor: sinTutor,
        apartadosNoEnSistema: noEnSistema,
        bloquesMensaje: mensajes.length,
        lectura,
      },
    })
  } catch (e) {
    console.error('whatsapp-desde-excel:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al procesar.' },
      { status: 500 }
    )
  }
}
