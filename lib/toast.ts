/**
 * Utilidad de Toast (Sonner).
 * Usar para guardados, ediciones, eliminados, errores y avisos.
 */
import { toast as sonnerToast } from 'sonner'

export const toast = {
  /** Operación exitosa genérica */
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),

  /** Error */
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),

  /** Advertencia */
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),

  /** Info */
  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description }),

  /** Mensaje neutro */
  message: (message: string, description?: string) =>
    sonnerToast(message, { description }),

  /** Guardado exitoso */
  saved: (entity?: string) =>
    sonnerToast.success(entity ? `${entity} guardado correctamente` : 'Guardado correctamente'),

  /** Actualizado exitosamente */
  updated: (entity?: string) =>
    sonnerToast.success(entity ? `${entity} actualizado correctamente` : 'Actualizado correctamente'),

  /** Eliminado exitosamente */
  deleted: (entity?: string) =>
    sonnerToast.success(entity ? `${entity} eliminado correctamente` : 'Eliminado correctamente'),

  /** Creado exitosamente */
  created: (entity?: string) =>
    sonnerToast.success(entity ? `${entity} creado correctamente` : 'Creado correctamente'),

  /** Promesa (loading → success/error) */
  promise: sonnerToast.promise,

  /** Cargando */
  loading: (message: string) => sonnerToast.loading(message),

  /** Cerrar todos */
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
}
