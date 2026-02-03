/**
 * Zona horaria de la aplicación. Usada en servidor (Vercel/UTC) y cliente
 * para que "hoy" y "mes actual" sean siempre en la misma zona (ej. Perú).
 * Configurable con NEXT_PUBLIC_APP_TIMEZONE (ej. America/Lima).
 */
export function getAppTimezone(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_TIMEZONE) {
    return process.env.NEXT_PUBLIC_APP_TIMEZONE
  }
  return 'America/Lima'
}

/**
 * Obtiene la fecha "hoy" en la zona horaria de la app (YYYY-MM-DD).
 * Evita que en el servidor (Vercel = UTC) se use medianoche UTC en lugar
 * del día civil del usuario/negocio.
 */
export function getTodayInAppTimezone(): string {
  const tz = getAppTimezone()
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

/**
 * Obtiene el año y mes actuales en la zona horaria de la app.
 * month es 0-11 (como en Date).
 */
export function getCurrentMonthYearInAppTimezone(): { year: number; month: number } {
  const tz = getAppTimezone()
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '0', 10)
  const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '0', 10)
  return { year, month: month - 1 }
}

/**
 * Devuelve el rango del mes (inicio y fin) como YYYY-MM-DD para un año/mes dados.
 * month es 0-11.
 */
export function getMonthRangeInAppTimezone(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
  }
}

/**
 * Formatea una fecha como YYYY-MM-DD usando la fecha local (no UTC).
 * Evita que en zonas horarias UTC- el último día del mes se convierta al día
 * siguiente en UTC (ej. 31 ene 23:59 Lima → 1 feb UTC) y se incluyan datos
 * del mes siguiente en reportes filtrados por mes.
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Nombre del mes actual en la zona de la app (ej. "enero"), para títulos.
 */
export function getCurrentMonthLabelInAppTimezone(locale = 'es-ES'): string {
  const { year, month } = getCurrentMonthYearInAppTimezone()
  return new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}
