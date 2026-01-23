/**
 * Utilidades para obtener colores del tema actual para exportaciones
 */

export type Theme = 'blue' | 'green' | 'purple' | 'gray' | 'dark-blue' | 'dark-green' | 'dark-purple'

/**
 * Obtiene el tema actual desde localStorage
 */
export function getCurrentTheme(): Theme {
  if (typeof window === 'undefined') return 'blue'
  
  const savedTheme = localStorage.getItem('app-theme') as Theme | null
  const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple']
  if (savedTheme && validThemes.includes(savedTheme)) {
    return savedTheme
  }
  return 'blue'
}

/**
 * Convierte HSL a RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x
  }

  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)

  return [r, g, b]
}

/**
 * Obtiene los colores del tema actual en formato RGB para Excel/PDF
 */
export function getThemeColors() {
  const theme = getCurrentTheme()
  
  // Colores HSL definidos en globals.css convertidos a RGB
  const themeColors: Record<Theme, {
    primary: [number, number, number]
    primaryLight: [number, number, number]
    secondary: [number, number, number]
    muted: [number, number, number]
    accent: [number, number, number]
    border: [number, number, number]
  }> = {
    blue: {
      primary: hslToRgb(217, 91, 60),        // Azul principal
      primaryLight: hslToRgb(217, 91, 95),  // Azul claro
      secondary: hslToRgb(217, 33, 96),     // Azul secundario
      muted: hslToRgb(217, 33, 96),         // Muted azul
      accent: hslToRgb(217, 91, 95),        // Accent azul
      border: hslToRgb(217, 33, 90),        // Borde azul
    },
    green: {
      primary: hslToRgb(142, 71, 45),       // Verde principal
      primaryLight: hslToRgb(142, 71, 95), // Verde claro
      secondary: hslToRgb(142, 33, 96),     // Verde secundario
      muted: hslToRgb(142, 33, 96),         // Muted verde
      accent: hslToRgb(142, 71, 95),        // Accent verde
      border: hslToRgb(142, 33, 90),        // Borde verde
    },
    purple: {
      primary: hslToRgb(262, 83, 58),       // Púrpura principal
      primaryLight: hslToRgb(262, 83, 95),  // Púrpura claro
      secondary: hslToRgb(262, 33, 96),     // Púrpura secundario
      muted: hslToRgb(262, 33, 96),         // Muted púrpura
      accent: hslToRgb(262, 83, 95),        // Accent púrpura
      border: hslToRgb(262, 33, 90),        // Borde púrpura
    },
    gray: {
      primary: hslToRgb(0, 0, 45),          // Gris principal
      primaryLight: hslToRgb(0, 0, 95),     // Gris claro
      secondary: hslToRgb(0, 0, 96),         // Gris secundario
      muted: hslToRgb(0, 0, 96),            // Muted gris
      accent: hslToRgb(0, 0, 95),           // Accent gris
      border: hslToRgb(0, 0, 90),            // Borde gris
    },
    'dark-blue': {
      primary: hslToRgb(217, 91, 65),       // Azul oscuro principal (más claro para exportaciones)
      primaryLight: hslToRgb(217, 91, 95),  // Azul claro
      secondary: hslToRgb(217, 33, 96),     // Azul secundario claro
      muted: hslToRgb(217, 33, 96),          // Muted azul claro
      accent: hslToRgb(217, 91, 95),        // Accent azul claro
      border: hslToRgb(217, 33, 90),         // Borde azul claro
    },
    'dark-green': {
      primary: hslToRgb(142, 71, 50),       // Verde oscuro principal (más claro para exportaciones)
      primaryLight: hslToRgb(142, 71, 95),  // Verde claro
      secondary: hslToRgb(142, 33, 96),     // Verde secundario claro
      muted: hslToRgb(142, 33, 96),          // Muted verde claro
      accent: hslToRgb(142, 71, 95),        // Accent verde claro
      border: hslToRgb(142, 33, 90),         // Borde verde claro
    },
    'dark-purple': {
      primary: hslToRgb(262, 83, 63),       // Púrpura oscuro principal (más claro para exportaciones)
      primaryLight: hslToRgb(262, 83, 95),  // Púrpura claro
      secondary: hslToRgb(262, 33, 96),     // Púrpura secundario claro
      muted: hslToRgb(262, 33, 96),          // Muted púrpura claro
      accent: hslToRgb(262, 83, 95),        // Accent púrpura claro
      border: hslToRgb(262, 33, 90),         // Borde púrpura claro
    },
  }

  return themeColors[theme]
}

/**
 * Obtiene el color de fondo para headers de tabla en formato RGB
 */
export function getTableHeaderColor(): [number, number, number] {
  const colors = getThemeColors()
  // Usar muted con 30% de opacidad (mezclar con blanco)
  return [
    Math.round(colors.muted[0] * 0.3 + 255 * 0.7),
    Math.round(colors.muted[1] * 0.3 + 255 * 0.7),
    Math.round(colors.muted[2] * 0.3 + 255 * 0.7),
  ]
}

/**
 * Obtiene el color de fondo para filas alternadas en formato RGB
 */
export function getAlternateRowColor(): [number, number, number] {
  const colors = getThemeColors()
  // Usar accent con 50% de opacidad (mezclar con blanco)
  return [
    Math.round(colors.accent[0] * 0.5 + 255 * 0.5),
    Math.round(colors.accent[1] * 0.5 + 255 * 0.5),
    Math.round(colors.accent[2] * 0.5 + 255 * 0.5),
  ]
}

/**
 * Obtiene el color de fondo para fila de totales en formato RGB
 */
export function getTotalRowColor(): [number, number, number] {
  const colors = getThemeColors()
  // Usar primary con 20% de opacidad (mezclar con blanco)
  return [
    Math.round(colors.primary[0] * 0.2 + 255 * 0.8),
    Math.round(colors.primary[1] * 0.2 + 255 * 0.8),
    Math.round(colors.primary[2] * 0.2 + 255 * 0.8),
  ]
}

/**
 * Obtiene el color de texto para headers en formato RGB
 */
export function getHeaderTextColor(): [number, number, number] {
  return [0, 0, 0] // Negro para mejor contraste
}

/**
 * Obtiene el color de texto para celdas en formato RGB
 */
export function getCellTextColor(): [number, number, number] {
  return [0, 0, 0] // Negro para mejor contraste
}

