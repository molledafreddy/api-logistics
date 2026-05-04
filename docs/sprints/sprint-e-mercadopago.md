# Sprint E — MercadoPago Chile (Checkout Pro)

> **Status**: 🟢 **DONE** (2026-05-03)
> **Objetivo**: convertir la API en un producto monetizable habilitando cobros reales con MercadoPago Chile (CLP), con webhook seguro (HMAC) e idempotente.

---

## 1. Alcance

| Ítem                                                  | Estado                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| Provider abstraction (`IPaymentProvider`)             | ✅                                                                                                                     |
| MercadoPago Provider (Checkout Pro)                   | ✅                                                                                                                     |
| Mock Provider para dev/tests                          | ✅                                                                                                                     |
| `POST /v1/payments/checkout` (auth)                   | ✅                                                                                                                     |
| `POST /v1/payments/:provider/webhook` (HMAC, público) | ✅                                                                                                                     |
| Idempotencia de webhooks (`PAY-002`)                  | ✅                                                                                                                     |
| Subscription state machine: PAY-003/004/005           | ✅                                                                                                                     |
| Migración con índices únicos                          | ✅                                                                                                                     |
| 29 unit tests                                         | ✅                                                                                                                     |
| Renovación recurrente (cron)                          | 🟡 **out of scope** — re-usa `subscription-renewal.processor` existente; se crea una nueva preference cada renovación. |
| Frontend `/billing/success                            | failure                                                                                                                | pending` | 🟡 dependerá del cliente |

---

## 2. Estrategia de cobro

Se usa **Checkout Pro con Preference single-payment** en lugar de **Preapproval (suscripción recurrente nativa de MP)**:

| Criterio                   | Preference single-payment ✅                    | Preapproval ❌                         |
| -------------------------- | ----------------------------------------------- | -------------------------------------- |
| Habilitación               | Inmediata                                       | Requiere validación bancaria adicional |
| Métodos de pago            | Todos los habilitados en MP CL                  | Solo tarjetas                          |
| Control de cancelación     | Total (servidor decide si crea otra preference) | Limitado (depende del flujo MP)        |
| Reintento de cobro fallido | Manual desde nuestro scheduler                  | Automático MP (3 reintentos)           |
| Cambio de monto/plan       | Trivial (nueva preference)                      | Requiere modificar preapproval         |

**Renovación**: el `subscription-renewal.processor` existente (Sprint anterior) detecta subs próximas a vencer; en una iteración futura llamará a `paymentsService.createCheckout()` para emitir una nueva preference y notificar al usuario. Sprint E solo provee la infraestructura.

---

## 3. Arquitectura

```
                  ┌──────────────────────┐
   user ────────► │  POST /payments/     │
                  │     checkout         │
                  └──────────┬───────────┘
                             │ creates preference
                             ▼
                  ┌──────────────────────┐
                  │  PaymentsService     │
                  │  ─ persists external_│
                  │    reference on Sub  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ IPaymentProvider     │   PAYMENTS_PROVIDER
                  │ (Symbol DI token)    │   = mercadopago | mock
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌──────────────────┐         ┌──────────────────┐
     │ MercadoPagoProv  │         │ MockPaymentProv  │
     │  POST /checkout/ │         │  determinístico  │
     │   preferences    │         └──────────────────┘
     └──────────────────┘

   MP   ───POST /payments/mercadopago/webhook───►  PaymentsController
                                                          │
                                              verify HMAC │ (rawBody)
                                                          ▼
                                                  PaymentsService
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                    PAY-002 idempotency        PAY-003 approved → active   PAY-004/005 mapping
                    payment_events table          + invoice paid           rejected/refunded
```

---

## 4. Endpoints

### `POST /v1/payments/checkout` (auth)

Crea una preference y devuelve `initPoint`. Persiste `external_reference` y `provider_subscription_id` en la subscription para amarrar el webhook posterior.

**Body** (`CreateCheckoutDto`):

```json
{
  "subscriptionId": "8b7e...",
  "amount": 9900,
  "currency": "CLP",
  "itemTitle": "Plan Pro Mensual",
  "payerEmail": "user@example.cl"
}
```

**Response 201**:

```json
{
  "initPoint": "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=...",
  "sandboxInitPoint": "https://sandbox.mercadopago.cl/...",
  "providerCheckoutId": "1234567890-abc",
  "externalReference": "mp-8b7e...-a1b2c3d4"
}
```

**Errores**:

- `404` — subscription no existe
- `503` — `PAY-MP-001` (sin token) o `PAY-MP-003` (HTTP/timeout MP)

### `POST /v1/payments/:provider/webhook` (`@Public()`, HMAC)

Recibe notificaciones del provider. Verifica firma, procesa idempotente. Siempre responde 200 a MP (incluso en duplicados) salvo firma inválida.

**Headers**:

- `x-signature: ts=1700000000,v1=<hex_hmac>`
- `x-request-id: <uuid>`

**Body típico (MP)**:

```json
{ "type": "payment", "action": "payment.updated", "data": { "id": "12345" } }
```

**Response 200**:

```json
{
  "received": true,
  "idempotent": false,
  "type": "payment.approved",
  "externalId": "12345"
}
```

**Errores**:

- `401` — `PAY-001`: firma inválida.

---

## 5. Reglas de negocio

| Código       | Regla                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAY-001`    | Firma HMAC inválida → `401 Unauthorized` (controller).                                                                                                                |
| `PAY-002`    | Idempotencia: si `(provider, external_id)` ya existe en `payment_events`, el webhook es no-op. Garantizada por `UNIQUE INDEX payment_events_provider_external_id_uq`. |
| `PAY-003`    | `payment.approved` → `subscription.status='active'` + `invoice(status='paid', amount_paid=evt.amount, paid_at=now)`.                                                  |
| `PAY-004`    | `payment.rejected` o `payment.cancelled` → `subscription.status='pending_payment'` (preserva ventana de gracia) + `invoice(status='void', amount_paid=0)`.            |
| `PAY-005`    | `payment.refunded` o `charged_back` → `subscription.status='canceled'` + `subscription.canceled_at=now` + `invoice(status='refunded')`.                               |
| `PAY-MP-001` | `MERCADOPAGO_ACCESS_TOKEN` ausente al hacer `createCheckout` o `resolveWebhookEvent` → `503 ServiceUnavailable`.                                                      |
| `PAY-MP-002` | Verificación HMAC: si `MERCADOPAGO_WEBHOOK_SECRET` está vacío, retorna `true` (modo dev — log warning). En prod **debe** estar seteado.                               |
| `PAY-MP-003` | Timeout (`AbortController`) o HTTP non-2xx llamando a MP → `503 ServiceUnavailable`.                                                                                  |

---

## 6. Verificación de firma HMAC

MP envía dos headers:

- `x-signature: ts=<unix_ts>,v1=<hex_hmac_sha256>`
- `x-request-id: <uuid>`

El **manifest** a firmar es:

```
id:{data.id};request-id:{x-request-id};ts:{ts};
```

donde `data.id` se lee del **body raw** del webhook. Por eso `main.ts` configura `bodyParser.json({ verify })` para preservar `req.rawBody`:

```ts
app.use(
  json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      if (buf?.length) (req as any).rawBody = buf.toString('utf8');
    },
  }),
);
```

La comparación usa `crypto.timingSafeEqual` para evitar timing attacks.

---

## 7. Variables de entorno

```bash
# Payments (Sprint E)
PAYMENTS_PROVIDER=mock                                    # mock | mercadopago
MERCADOPAGO_ACCESS_TOKEN=                                 # TEST-... o APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=                               # panel MP → Webhooks → Secret
MERCADOPAGO_NOTIFICATION_URL=                             # https://api.tudominio.cl/v1/payments/mercadopago/webhook
MERCADOPAGO_SUCCESS_URL=http://localhost:3001/billing/success
MERCADOPAGO_FAILURE_URL=http://localhost:3001/billing/failure
MERCADOPAGO_PENDING_URL=http://localhost:3001/billing/pending
MERCADOPAGO_TIMEOUT_MS=8000
```

---

## 8. Configuración del panel MercadoPago

1. **Credenciales** → copia `Access Token` (TEST en sandbox) → `MERCADOPAGO_ACCESS_TOKEN`.
2. **Webhooks** → modo "Webhooks" → URL = `https://<tu-dominio>/v1/payments/mercadopago/webhook` → eventos: `payment` → guarda y copia el **Secret** → `MERCADOPAGO_WEBHOOK_SECRET`.
3. En sandbox MP, el Secret se llama "Clave secreta" y va en `Webhooks → Configurar notificaciones`.

---

## 9. Migración

`1715000000000-AddPaymentProviderToSubscriptions`:

- `subscriptions`:
  - `provider varchar(20) NOT NULL DEFAULT 'free'`
  - `provider_subscription_id varchar(120)`
  - `external_reference varchar(120) UNIQUE`
- `payment_events`:
  - `provider varchar(20)`
  - `external_id varchar(120)`
  - `UNIQUE INDEX payment_events_provider_external_id_uq ON (provider, external_id) WHERE external_id IS NOT NULL`

Wrappers `DO $$ IF EXISTS table $$` la hacen idempotente para CI con BD limpia.

```bash
pnpm run migration:run
```

---

## 10. Smoke test (sandbox)

1. `PAYMENTS_PROVIDER=mercadopago` + token sandbox.
2. `POST /v1/payments/checkout` con una sub existente (test JWT) → obtienes `initPoint`.
3. Abres `initPoint` → pagas con tarjeta de prueba MP (`5031 7557 3453 0604`, cualquier CVV/exp futura, titular `APRO` para aprobado).
4. MP llama tu webhook (puede usar [smee.io](https://smee.io) o [ngrok](https://ngrok.com) si estás local).
5. Verifica en logs:
   ```
   [PaymentsService] webhook procesado payment.approved <id>
   ```
6. Verifica en BD:
   - `subscriptions.status = 'active'`
   - `invoices.status = 'paid'`
   - `payment_events` con el evento.
7. Reenvía el mismo webhook (botón "Reintentar" en panel MP) → log `webhook duplicado [...] → no-op`.

---

## 11. Tests

| Spec                                     | Tests                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `providers/mock.provider.spec.ts`        | 6                                                                          |
| `providers/mercadopago.provider.spec.ts` | 11 (HMAC válido/manipulado, mapStatus 7 casos, 503 sin token / HTTP error) |
| `payments.service.spec.ts`               | 8 (PAY-002/003/004/005 + huérfano + checkout)                              |
| `payments.controller.spec.ts`            | 4 (401 firma inválida, lowercase headers, rawBody fallback)                |
| **Total**                                | **29**                                                                     |

Resultado global tras Sprint E: **82 suites · 759 tests · 9.0 s** (antes 78 / 730).

---

## 12. Archivos del sprint

**Nuevos**:

- `src/database/migrations/1715000000000-AddPaymentProviderToSubscriptions.ts`
- `src/modules/payments/payments.types.ts`
- `src/modules/payments/payments.module.ts`
- `src/modules/payments/payments.service.ts`
- `src/modules/payments/payments.controller.ts`
- `src/modules/payments/dto/create-checkout.dto.ts`
- `src/modules/payments/providers/mercadopago.provider.ts`
- `src/modules/payments/providers/mock.provider.ts`
- 4 spec files

**Modificados**:

- `src/modules/subscriptions/entities/subscription.entity.ts` (+3 cols)
- `src/modules/subscriptions/entities/payment-event.entity.ts` (+2 cols)
- `src/main.ts` (rawBody verify)
- `src/app.module.ts` (registro PaymentsModule)
- `src/config/validation.schema.ts` (8 env vars)
- `.env.example`

---

## 13. Próximos pasos (post-Sprint E)

- Integrar `paymentsService.createCheckout()` en `subscription-renewal.processor` para auto-cobro mensual.
- DTO de respuesta tipado para el endpoint de checkout (eliminar warning `inline-body-schema` cuando se añada).
- E2E test con webhook real firmado (requiere fixture HMAC).
- Endpoint `GET /v1/payments/events?subscriptionId=...` para auditoría desde el panel del cliente.
