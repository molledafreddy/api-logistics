# Sprint F.2 — Notificaciones de billing + estado `suspended` + retry manual

> Cierra los gaps de UX/operación que quedaron pendientes tras F.1
> (auto-cobro recurrente). El cliente nunca quedaba notificado de qué
> pasaba con su cobro y la transición directa `pending_payment → canceled`
> era irreversible. F.2 introduce:
>
> 1. **Eventos de dominio** del ciclo de vida billing.
> 2. **Listener** que crea notificaciones (push + WS) para owners/admins.
> 3. **Estado intermedio `suspended`** (gracia agotada, datos preservados).
> 4. **Reactivación correcta** vía webhook de pago aprobado.
> 5. **Endpoint manual de retry** para que el usuario fuerce un nuevo cobro.

---

## 1. Decisiones técnicas

### 1.1 Eventos de dominio

Archivo: `src/modules/subscriptions/billing-events.ts`

```ts
BILLING_EVENTS = {
  RENEWAL_SCHEDULED: 'billing.renewal.scheduled',
  RENEWAL_FAILED: 'billing.renewal.failed',
  GRACE_STARTED: 'billing.grace.started',
  GRACE_ENDING: 'billing.grace.ending', // reservado F.3
  SUBSCRIPTION_SUSPENDED: 'billing.subscription.suspended',
  SUBSCRIPTION_REACTIVATED: 'billing.subscription.reactivated',
};
```

Bus: `EventEmitter2` (ya disponible y usado por `NotificationsService`).
Payload tipado (`BillingEventPayload`) con `subscriptionId`, `companyId`,
`planName`, y `meta` variable.

### 1.2 Estado `suspended`

Antes (F.1): gracia expira → `canceled` directo. Irreversible y agresivo.

Ahora (F.2): gracia expira → `suspended` (datos preservados, login bloqueado
en escrituras a futuro vía guard — pendiente F.3). `canceled` queda
reservado para refund o acción explícita del owner.

**Migration**: `1715100000000-AddSuspendedFieldsToSubscriptions.ts`

- `suspended_at`, `reactivated_at`, `grace_warning_sent_at` (timestamptz nullable).
- Índice parcial `subscriptions_renewal_scan_idx` actualizado para incluir `suspended`.
- Nuevo índice `subscriptions_suspended_idx` para purga futura T+30d.

### 1.3 Reactivación tras pago en gracia/suspended

Bug encontrado en `PaymentsService.applyEventToSubscription`:
`payment.approved` movía a `active` pero **no** extendía periodo, **no**
cerraba `grace_period_until`, **no** limpiaba `last_renewal_init_point`.

Ahora si la sub venía de `pending_payment` o `suspended`:

- Extiende periodo: `current_period_end += 1 mes` (desde `max(end, now)`).
- Limpia `grace_period_until`, `grace_warning_sent_at`, `last_renewal_init_point`.
- Marca `reactivated_at = now`.
- Emite `BILLING_EVENTS.SUBSCRIPTION_REACTIVATED`.

### 1.4 Retry manual

Endpoint `POST /v1/billing/me/retry`:

- Solo aplicable a subs `pending_payment` o `suspended`.
- Throttle 5 min entre intentos (`last_renewal_attempt_at`).
- Genera nuevo checkout via `paymentsService.createCheckout()`.
- Persiste `last_renewal_init_point` para reuso desde frontend.

Errores HTTP:

- 400 `Retry too soon. Try again in Xs`
- 400 `Free plans cannot be retried`
- 404 `No retriable subscription for company X`

### 1.5 BillingNotificationsService

Listener `@OnEvent(BILLING_EVENTS.*, { async: true })` en
`src/modules/payments/billing-notifications.service.ts`.

- Resuelve destinatarios: `users.role IN (company_owner, admin)` filtrados
  por `companyId`.
- Crea Notification con `NotificationType.SUBSCRIPTION_ALERT` (enum ya existía).
- No reusa enum nuevo → migration de enum **no** necesaria.
- `data` enriquecida con `subscriptionId`, `companyId`, `planName`,
  `actionUrl: '/billing'`, y `meta` del evento (gracia, suspendedAt, etc).
- **Error-tolerant**: si `NotificationsService.create` falla, se loggea
  y NO propaga (el evento de dominio sigue siendo válido).

### 1.6 Mensajes (es-CL)

| Evento                   | Título                              | Body                                             |
| ------------------------ | ----------------------------------- | ------------------------------------------------ |
| RENEWAL_SCHEDULED        | "Renovación de tu plan lista"       | "Tu plan {plan} se renovará pronto..."           |
| RENEWAL_FAILED           | "No pudimos procesar tu cobro"      | "Hubo un problema al generar el cobro..."        |
| GRACE_STARTED            | "Tu pago no se procesó"             | "Tienes hasta {fecha} para regularizar..."       |
| GRACE_ENDING             | "⚠️ Tu cuenta se suspende mañana"   | "Tu plan se suspenderá en menos de 24h..."       |
| SUBSCRIPTION_SUSPENDED   | "Tu cuenta fue suspendida"          | "Reactívalo cuando quieras desde facturación..." |
| SUBSCRIPTION_REACTIVATED | "✅ Tu plan está activo nuevamente" | "Recibimos tu pago..."                           |

---

## 2. Cambios por archivo

### Nuevos

| Archivo                                                                      | Propósito             |
| ---------------------------------------------------------------------------- | --------------------- |
| `src/database/migrations/1715100000000-AddSuspendedFieldsToSubscriptions.ts` | Columnas + índices    |
| `src/modules/subscriptions/billing-events.ts`                                | Constantes de eventos |
| `src/modules/payments/billing-notifications.service.ts`                      | Listener              |
| `src/modules/payments/billing-notifications.service.spec.ts`                 | 10 tests              |
| `docs/sprints/sprint-f2-billing-notifications.md`                            | Este doc              |

### Modificados

| Archivo                                                            | Cambio                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/modules/subscriptions/entities/subscription.entity.ts`        | +3 columnas                                                                      |
| `src/modules/subscriptions/subscription-renewal.processor.ts`      | Inyecta `EventEmitter2`; emite 4 eventos; canceled→suspended                     |
| `src/modules/subscriptions/subscription-renewal.processor.spec.ts` | Constructor + tests REN-005/009/010/011                                          |
| `src/modules/payments/payments.service.ts`                         | Inyecta `Plan`+`EventEmitter2`; reactivación correcta + emite REACTIVATED        |
| `src/modules/payments/payments.service.spec.ts`                    | Constructor + 2 tests reactivación                                               |
| `src/modules/payments/billing.service.ts`                          | Inyecta `PaymentsService`; método `retry()`; incluye `suspended` en getMyRenewal |
| `src/modules/payments/billing.service.spec.ts`                     | Tests del retry (5 casos)                                                        |
| `src/modules/payments/billing.controller.ts`                       | `POST /v1/billing/me/retry`                                                      |
| `src/modules/payments/payments.module.ts`                          | Importa `NotificationsModule`+`User`; registra `BillingNotificationsService`     |

---

## 3. Tests

```
Test Suites: 10 passed, 10 total
Tests:       86 passed, 86 total
```

Cobertura nueva:

- `billing-notifications.service.spec.ts` — 10 tests (1 por evento + edge cases).
- `billing.service.spec.ts` — 5 tests adicionales para retry.
- `payments.service.spec.ts` — 2 tests adicionales para reactivación (pending_payment + suspended).
- `subscription-renewal.processor.spec.ts` — 3 tests adicionales (REN-009/010/011 emisión de eventos) + actualización REN-005.

---

## 4. Pendientes (queda para Sprint F.3)

- [ ] Cron de `GRACE_ENDING` (24h antes de expirar gracia, idempotente vía `grace_warning_sent_at`).
- [ ] Cron de purga T+30d: `suspended` → `canceled` con notificación final.
- [ ] `SubscriptionActiveGuard` que rechace POST/PATCH/DELETE en shipments si sub `suspended`.
- [ ] Email backend (hoy solo push/WS via NotificationsService).
- [ ] Métricas Prometheus: counter por evento (`billing_event_emitted_total{event}`).
- [ ] Multi-currency (sólo CLP hoy).
- [ ] Dunning emails (3 toques previos al suspended).

---

## 5. Smoke test manual

1. Crear sub `pending_payment` con `grace_period_until` en el pasado:

```sql
UPDATE subscriptions
SET status='pending_payment',
    current_period_end=NOW() - INTERVAL '10 days',
    grace_period_until=NOW() - INTERVAL '1 day'
WHERE id='<sub-id>';
```

2. Encolar job manualmente (o esperar al scheduler):

```bash
curl -X POST http://localhost:3000/v1/billing/me/retry \
  -H "Authorization: Bearer <token>"
```

3. Verificar:
   - sub.status === 'suspended' tras tick del scheduler.
   - notifications de tipo SUBSCRIPTION_ALERT creadas para owners.
   - Si llega webhook `payment.approved`:
     - sub.status === 'active'.
     - sub.reactivated_at no nulo.
     - sub.current_period_end + 1 mes.
     - Notification "✅ Tu plan está activo nuevamente".
