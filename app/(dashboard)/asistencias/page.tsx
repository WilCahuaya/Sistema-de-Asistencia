'use client'

import { Suspense } from 'react'
import { AsistenciasPageContent } from '@/components/features/asistencias/AsistenciasPageContent'

export default function AsistenciasPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencias</h1>
        </div>
        <div className="text-center py-8">Cargando...</div>
      </div>
    }>
      <AsistenciasPageContent />
    </Suspense>
  )
}
