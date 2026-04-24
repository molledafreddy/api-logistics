/**
 * Estados del ciclo de vida de un DeliveryRun (manifiesto operativo del día).
 *
 *   planned ──► ready ──► in_progress ──► completed
 *      │          │             │
 *      └──────────┴─────────────┴──► cancelled
 *
 * Definido en PARTE 7 · sección 29.3 del plan.
 */
export enum DeliveryRunStatus {
  PLANNED = 'planned',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/** Turnos típicos del run. `custom` deja libre `startTime`. */
export type DeliveryRunShift =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'custom';
