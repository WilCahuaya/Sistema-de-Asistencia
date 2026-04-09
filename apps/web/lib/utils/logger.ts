/**
 * Utilidad para logging condicional basado en variables de entorno
 * En producción, solo se muestran logs de error por defecto
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const debugLogsEnabled = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true'

/**
 * Logger condicional para desarrollo y producción
 */
export const logger = {
  /**
   * Log de información general (solo en desarrollo o si DEBUG_LOGS está habilitado)
   */
  info: (...args: any[]) => {
    if (isDevelopment || debugLogsEnabled) {
      console.log(...args)
    }
  },

  /**
   * Log de depuración (solo en desarrollo o si DEBUG_LOGS está habilitado)
   */
  debug: (...args: any[]) => {
    if (isDevelopment || debugLogsEnabled) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * Log de advertencias (siempre visible)
   */
  warn: (...args: any[]) => {
    console.warn(...args)
  },

  /**
   * Log de errores (siempre visible)
   */
  error: (...args: any[]) => {
    console.error(...args)
  },

  /**
   * Log de navegación/roles (solo en desarrollo o si DEBUG_LOGS está habilitado)
   */
  navigation: (...args: any[]) => {
    if (isDevelopment || debugLogsEnabled) {
      console.log('🧭', ...args)
    }
  },

  /**
   * Log de reportes (solo en desarrollo o si DEBUG_LOGS está habilitado)
   */
  report: (...args: any[]) => {
    if (isDevelopment || debugLogsEnabled) {
      console.log('📊', ...args)
    }
  },
}

