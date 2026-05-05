/**
 * Sprint F.2 — Eventos de dominio del ciclo de billing.
 *
 * Emitidos vía `EventEmitter2` y consumidos por:
 *   - `BillingNotificationsService` → crea Notification (push + WS).
 *   - Métricas/observabilidad (futuro Sprint F.3).
 *
 * Cada payload viaja como `BillingEventPayload` para garantizar que el
 * listener pueda resolver el `companyId` y enriquecer la notificación.
 */
export const BILLING_EVENTS = {
  /** El scheduler generó un checkout para renovar (sub aún en `active`). */
  RENEWAL_SCHEDULED: 'billing.renewal.scheduled',
  /** El intento de generar checkout falló (provider error). */
  RENEWAL_FAILED: 'billing.renewal.failed',
  /** La sub entró en gracia (periodo vencido, esperando pago). */
  GRACE_STARTED: 'billing.grace.started',
  /** Faltan ≤24h para que la gracia expire (se emite una sola vez). */
  GRACE_ENDING: 'billing.grace.ending',
  /** Gracia agotada → sub pasa a `suspended`. */
  SUBSCRIPTION_SUSPENDED: 'billing.subscription.suspended',
  /** Pago aprobado tras `pending_payment` o `suspended`. */
  SUBSCRIPTION_REACTIVATED: 'billing.subscription.reactivated',
} as const;

export type BillingEventName =
  (typeof BILLING_EVENTS)[keyof typeof BILLING_EVENTS];

export interface BillingEventPayload {
  subscriptionId: string;
  companyId: string;
  planName: string;
  /** Información variable según el evento. */
  meta?: {
    initPoint?: string;
    gracePeriodUntil?: string;
    currentPeriodEnd?: string;
    suspendedAt?: string;
    reactivatedAt?: string;
    error?: string;
  };
}
