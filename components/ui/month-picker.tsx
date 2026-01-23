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
}

export function MonthPicker({ value, onChange, className, placeholder = 'Seleccionar mes' }: MonthPickerProps) {
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
  
  // Generar años (desde 5 años atrás hasta 15 años adelante)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 5 + i)

  const handleMonthChange = (newMonthIndex: number) => {
    // newMonthIndex es 0-11, convertir a 1-12 para el formato "YYYY-MM"
    const monthValue = newMonthIndex + 1
    const newValue = `${year}-${String(monthValue).padStart(2, '0')}`
    onChange(newValue)
  }

  const handleYearChange = (newYear: number) => {
    // Mantener el mes actual (monthIndex es 0-11, convertir a 1-12)
    const monthValue = monthIndex + 1
    const newValue = `${newYear}-${String(monthValue).padStart(2, '0')}`
    onChange(newValue)
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
            <SelectItem key={m.value} value={m.value.toString()}>
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
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

