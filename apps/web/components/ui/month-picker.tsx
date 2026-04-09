'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'

const months = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' },
]

interface MonthPickerProps {
  value: string // Formato: "YYYY-MM"
  onChange: (value: string) => void // Recibe formato "YYYY-MM"
  className?: string
  placeholder?: string
  /** Si true, no permite seleccionar meses posteriores al actual (solo actual y pasados) */
  disableFuture?: boolean
}

export function MonthPicker({ value, onChange, className, placeholder = 'Seleccionar mes', disableFuture = false }: MonthPickerProps) {
  // Convertir formato "YYYY-MM" (mes 1-12) a índices del array (mes 0-11)
  const parseValue = () => {
    if (!value) {
      const now = new Date()
      return { year: now.getFullYear(), monthIndex: now.getMonth() }
    }
    const [yearStr, monthStr] = value.split('-')
    const year = parseInt(yearStr)
    const monthFromValue = parseInt(monthStr) // 1-12
    const monthIndex = monthFromValue - 1 // Convertir a 0-11
    return { year, monthIndex }
  }

  const { year, monthIndex } = parseValue()
  const currentYear = new Date().getFullYear()
  const currentMonthIndex = new Date().getMonth()
  const years = disableFuture
    ? Array.from({ length: 10 }, (_, i) => currentYear - 9 + i)
    : Array.from({ length: 20 }, (_, i) => currentYear - 5 + i)

  const handleMonthChange = (newMonthIndex: number) => {
    let finalMonth = newMonthIndex
    if (disableFuture && year === currentYear && newMonthIndex > currentMonthIndex) {
      finalMonth = currentMonthIndex
    }
    const monthValue = finalMonth + 1
    onChange(`${year}-${String(monthValue).padStart(2, '0')}`)
  }

  const handleYearChange = (newYear: number) => {
    const finalYear = disableFuture && newYear > currentYear ? currentYear : newYear
    const maxMonth = disableFuture && finalYear === currentYear ? currentMonthIndex : 11
    const monthValue = Math.min(monthIndex, maxMonth) + 1
    onChange(`${finalYear}-${String(monthValue).padStart(2, '0')}`)
  }

  return (
    <div className={`flex gap-2 items-center ${className || ''}`}>
      <Select
        value={monthIndex.toString()}
        onValueChange={(val) => handleMonthChange(parseInt(val))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{months[monthIndex]?.label || 'Mes'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem
              key={m.value}
              value={m.value.toString()}
              disabled={disableFuture && year === currentYear && m.value > currentMonthIndex}
            >
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select
        value={year.toString()}
        onValueChange={(val) => handleYearChange(parseInt(val))}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue>{year}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()} disabled={disableFuture && y > currentYear}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

