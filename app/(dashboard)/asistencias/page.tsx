import { AsistenciaList } from '@/components/features/asistencias/AsistenciaList'

export default function AsistenciasPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Asistencias</h1>
      <AsistenciaList />
    </div>
  )
}

