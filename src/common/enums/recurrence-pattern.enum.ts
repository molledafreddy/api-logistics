/**
 * Patrones de recurrencia para `RecurringTemplate` (PARTE 7 · Sprint 2 · sección 30).
 *
 * - DAILY    → genera 1 ocurrencia cada día calendario (entre startDate..endDate).
 * - WEEKLY   → genera ocurrencia solo si el día ISO (1..7) está en `daysOfWeek`.
 * - MONTHLY  → genera ocurrencia el mismo día-de-mes que `startDate`.
 * - CUSTOM   → no se dispara automáticamente; solo vía endpoint manual `POST /:id/generate`.
 */
export enum RecurrencePattern {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}
