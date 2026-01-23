/**
 * Utilidades para estilos de exportación (Excel y PDF) con colores del tema
 */

import {
  getThemeColors,
  getTableHeaderColor,
  getAlternateRowColor,
  getTotalRowColor,
  getHeaderTextColor,
  getCellTextColor,
} from './themeColors'

/**
 * Convierte RGB a hexadecimal
 */
function rgbToHex(r: number, g: number, b: number): string {
  return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

/**
 * Obtiene estilos para headers de tabla en Excel
 */
export function getExcelHeaderStyle() {
  const headerBgColor = getTableHeaderColor()
  const headerTextColor = getHeaderTextColor()
  const themeColors = getThemeColors()
  
  const headerBgHex = rgbToHex(headerBgColor[0], headerBgColor[1], headerBgColor[2])
  const headerTextHex = rgbToHex(headerTextColor[0], headerTextColor[1], headerTextColor[2])
  const borderHex = rgbToHex(themeColors.border[0], themeColors.border[1], themeColors.border[2])

  return {
    font: { bold: true, color: { rgb: headerTextHex }, sz: 11 },
    fill: { fgColor: { rgb: headerBgHex } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: borderHex } },
      bottom: { style: 'thin', color: { rgb: borderHex } },
      left: { style: 'thin', color: { rgb: borderHex } },
      right: { style: 'thin', color: { rgb: borderHex } },
    },
  }
}

/**
 * Obtiene estilos para celdas normales en Excel
 */
export function getExcelCellStyle() {
  const themeColors = getThemeColors()
  const borderHex = rgbToHex(themeColors.border[0], themeColors.border[1], themeColors.border[2])

  return {
    border: {
      top: { style: 'thin', color: { rgb: borderHex } },
      bottom: { style: 'thin', color: { rgb: borderHex } },
      left: { style: 'thin', color: { rgb: borderHex } },
      right: { style: 'thin', color: { rgb: borderHex } },
    },
    alignment: { vertical: 'center' },
  }
}

/**
 * Obtiene estilos para filas alternadas en Excel
 */
export function getExcelAlternateRowStyle() {
  const alternateRowColor = getAlternateRowColor()
  const themeColors = getThemeColors()
  
  const alternateBgHex = rgbToHex(alternateRowColor[0], alternateRowColor[1], alternateRowColor[2])
  const borderHex = rgbToHex(themeColors.border[0], themeColors.border[1], themeColors.border[2])

  return {
    ...getExcelCellStyle(),
    fill: { fgColor: { rgb: alternateBgHex } },
  }
}

/**
 * Obtiene estilos para fila de totales en Excel
 */
export function getExcelTotalStyle() {
  const totalRowColor = getTotalRowColor()
  const themeColors = getThemeColors()
  
  const totalBgHex = rgbToHex(totalRowColor[0], totalRowColor[1], totalRowColor[2])
  const borderHex = rgbToHex(themeColors.border[0], themeColors.border[1], themeColors.border[2])

  return {
    ...getExcelCellStyle(),
    font: { bold: true },
    fill: { fgColor: { rgb: totalBgHex } },
  }
}

/**
 * Obtiene estilos para headers de tabla en PDF (jsPDF-autoTable)
 */
export function getPDFHeaderStyles() {
  const headerBgColor = getTableHeaderColor()
  const headerTextColor = getHeaderTextColor()
  const themeColors = getThemeColors()

  return {
    fillColor: headerBgColor,
    textColor: headerTextColor,
    fontStyle: 'bold',
    fontSize: 9,
    cellPadding: 3,
    lineColor: themeColors.border,
    lineWidth: 0.1,
  }
}

/**
 * Obtiene estilos para celdas del cuerpo en PDF
 */
export function getPDFBodyStyles() {
  const cellTextColor = getCellTextColor()
  const themeColors = getThemeColors()

  return {
    fontSize: 9,
    textColor: cellTextColor,
    cellPadding: 3,
    lineColor: themeColors.border,
    lineWidth: 0.1,
  }
}

/**
 * Obtiene estilos para filas alternadas en PDF
 */
export function getPDFAlternateRowStyles() {
  const alternateRowColor = getAlternateRowColor()

  return {
    fillColor: alternateRowColor,
  }
}

/**
 * Obtiene color para fila de totales en PDF
 */
export function getPDFTotalRowColor(): [number, number, number] {
  return getTotalRowColor()
}

/**
 * Obtiene color de texto para celdas en PDF
 */
export function getPDFCellTextColor(): [number, number, number] {
  return getCellTextColor()
}

