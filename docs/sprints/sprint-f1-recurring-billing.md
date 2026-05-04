# Sprint F.1 — Auto-cobro recurrente (renovación mensual)

> **Estado:** ✅ Implementado — 13 tests verdes (`subscription-renewal.processor.spec.ts` 7, `renewal-scheduler.service.spec.ts` 3, `billing.service.spec.ts` 3).
> **Suite global tras F.1:** 85 suites / 772 tests.

## Objetivo

Renovar automáticamente las suscripciones de pago cada mes sin depender de
Preapproval/MercadoPago Suscripciones. La estrategia es **backend-driven**:
un cron horario detecta subs próximas a vencer, genera un `Checkout Pro`
(reutilizando `PaymentsService` del Sprint E) y persiste el `init_point` para
que el frontend lo abra.

## Diseño

```
┌──────────────────────────┐  every 1h   ┌─────────────────────────────┐
│ RenewalSchedulerService  │ ──────────▶ │ BullMQ:subscription-renewal │
│  @Cron(EVERY_HOUR)       │             └────────────┬────────────────┘
└──────────────────────────┘                          │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SubscriptionRenewalProcessor                                        │
│   1. load sub + plan                                                │
│   2. plan.price == 0 → extender periodo (free auto-renew)           │
│   3. periodo vigente → createCheckout + persist initPoint           │
│   4. periodo vencido y sin gracia → abrir gracia 7d + checkout      │
│   5. periodo vencido y gracia expirada → status='canceled'          │
└─────────────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
                            ┌────────────────────────────────────────┐
                            │ GET /v1/billing/me/renewal             │
                            │ → { initPoint, gracePeriodUntil, ... } │
                            └────────────────────────────────────────┘
```

## Reglas de negocio

| ID      | Regla                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| REN-001 | Look-ahead de scan: 3 días antes de `current_period_end`.                                                                                        |
| REN-002 | Throttle: no re-encolar si `last_renewal_attempt_at` < 6h.                                                                                       |
| REN-003 | Sólo subs en `active` o `pending_payment`; `canceled` quedan fuera.                                                                              |
| REN-004 | Si el periodo venció sin gracia, abrir `grace_period_until = now + 7d` y marcar `pending_payment`.                                               |
| REN-005 | Si la gracia ya expiró, `status = 'canceled'` + `canceled_at = now`.                                                                             |
| REN-006 | Si plan.price > 0, generar checkout y persistir `last_renewal_init_point` + `last_renewal_attempt_at`.                                           |
| REN-007 | Si plan.price == 0, extender `current_period_end += 1 mes` sin generar pago.                                                                     |
| REN-008 | Si `paymentsService.createCheckout()` falla, persistir `last_renewal_attempt_at` y re-lanzar (BullMQ reintenta con backoff exponencial 60s × 3). |

## Cambios técnicos

### Schema (migration `1715000000002`)

```sql
ALTER TABLE subscriptions
  ADD COLUMN grace_period_until      timestamptz NULL,
  ADD COLUMN last_renewal_attempt_at timestamptz NULL,
  ADD COLUMN last_renewal_init_point varchar(500) NULL;

CREATE INDEX subscriptions_renewal_scan_idx
  ON subscriptions (status, current_period_end)
  WHERE status IN ('active', 'pending_payment');
```

### Archivos nuevos

- `src/modules/subscriptions/renewal-scheduler.service.ts` — cron horario.
- `src/modules/subscriptions/renewal-scheduler.service.spec.ts` — 3 tests.
- `src/modules/subscriptions/subscription-renewal.processor.spec.ts` — 7 tests.
- `src/modules/payments/billing.service.ts` — lectura del estado de renovación.
- `src/modules/payments/billing.controller.ts` — `GET /v1/billing/me/renewal`.
- `src/modules/payments/billing.service.spec.ts` — 3 tests.
- `src/database/migrations/1715000000002-AddRenewalFieldsToSubscriptions.ts`.

### Archivos modificados

- `src/modules/subscriptions/subscription-renewal.processor.ts` — implementación real (antes era stub).
- `src/modules/subscriptions/subscription-renewal.module.ts` — importa `PaymentsModule`, registra `RenewalSchedulerService`.
- `src/modules/subscriptions/entities/subscription.entity.ts` — 3 columnas nuevas.
- `src/modules/payments/payments.module.ts` — exporta `BillingService`, registra `BillingController`.

## Endpoint

### `GET /v1/billing/me/renewal`

Auth: bearer JWT (companyId leído de `IUserPayload`).

**200**:

```json
{
  "subscriptionId": "f804c412-09c4-4e39-a65a-7058b6723738",
  "status": "pending_payment",
  "planId": "...",
  "planName": "Pro",
  "amount": 14990,
  "currency": "CLP",
  "currentPeriodEnd": "2026-06-04T00:00:00.000Z",
  "gracePeriodUntil": "2026-06-11T00:00:00.000Z",
  "lastRenewalAttemptAt": "2026-06-04T08:00:00.000Z",
  "initPoint": "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=..."
}
```

**404** sin suscripción activa.

## Observabilidad

- Logs estructurados por sub: `renewal scan: N candidates, M enqueued`,
  `renewing sub=<id> job=<jobId>`, `sub=<id> checkout generado initPoint=...`,
  `sub=<id> canceled (grace expired ...)`.
- BullMQ `OnQueueEvent('failed')` registra warnings.

## Validación local

```bash
# 1) aplicar migration
pnpm migration:run

# 2) verificar columnas
psql $DB -c "\\d subscriptions" | grep -E "renewal|grace"

# 3) levantar API
pnpm start:dev

# 4) provocar scan inmediato (en otra terminal, vía REPL)
# o esperar al próximo cron horario y revisar logs.

# 5) consultar estado
curl -H "Authorization: Bearer $JWT" http://localhost:3000/v1/billing/me/renewal
```

## Notas para Sprint F.2 (futuro)

- Notificación email/push al usuario cuando se genera un `initPoint` o cuando
  se entra en gracia / se cancela.
- Endpoint `POST /v1/billing/me/renewal/retry` para forzar regeneración del
  checkout si el initPoint expiró.
- Métricas Prometheus: contador de renovaciones exitosas, fallidas y subs
  canceladas por gracia expirada.
- Soporte multi-currency (hoy hardcode `CLP`).
