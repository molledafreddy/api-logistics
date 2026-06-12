/**
 * Sprint E — Tipos compartidos del módulo de pagos.
 *
 * Diseño:
 *   - `IPaymentProvider` abstrae al provider concreto (MercadoPago, Stripe,
 *     mock) para permitir A/B y testing sin acoplarse a un SDK.
 *   - Eventos normalizados a un set fijo (`PaymentEventType`) para que la
 *     lógica de subscription no dependa de los strings del provider.
 */

export type PaymentProviderName = 'mercadopago' | 'mock';

export type PaymentEventType =
  | 'payment.approved'
  | 'payment.rejected'
  | 'payment.refunded'
  | 'payment.cancelled'
  | 'payment.pending'
  | 'unknown';

export interface CheckoutInput {
  /** UUID interno de la subscription (se usa en metadata). */
  subscriptionId: string;
  companyId: string;
  /** Monto en la unidad menor de la moneda local (CLP no usa decimales). */
  amount: number;
  currency: 'CLP' | 'USD';
  /** Texto humano para mostrar en la pasarela. */
  itemTitle: string;
  /** Email del payer (opcional, mejora conversion en MP). */
  payerEmail?: string;
  /** URLs de retorno tras el pago. Si se omiten, el provider usa sus env vars. */
  backUrls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
}

export interface CheckoutResult {
  /** URL para redirigir al usuario al checkout del provider. */
  initPoint: string;
  /** URL sandbox (sólo MercadoPago test mode). */
  sandboxInitPoint?: string;
  /** ID interno del provider (preference id en MP). */
  providerCheckoutId: string;
  /** Token de idempotencia (se persiste en `subscriptions.external_reference`). */
  externalReference: string;
}

export interface NormalizedPaymentEvent {
  type: PaymentEventType;
  /** ID del payment del provider — clave de idempotencia en payment_events. */
  externalId: string;
  /** ID del checkout (preference) — vincula con subscription via metadata. */
  providerCheckoutId?: string;
  /** Token devuelto, debe coincidir con `subscriptions.external_reference`. */
  externalReference?: string;
  amount?: number;
  currency?: string;
  /** Payload crudo del provider para auditoría. */
  raw: unknown;
}

export interface IPaymentProvider {
  readonly providerName: PaymentProviderName;

  /** Crea un checkout y devuelve la URL para redirigir al usuario. */
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;

  /**
   * Verifica la firma del webhook entrante.
   *
   * @param rawBody  body en raw (string) — necesario para HMAC en MP.
   * @param headers  headers HTTP recibidos (lower-cased keys).
   * @returns true si la firma es válida.
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): boolean;

  /**
   * Resuelve el payload del webhook a un evento normalizado.
   * Algunos providers (MP) sólo envían un `id` y hay que hacer fetch al detalle.
   */
  resolveWebhookEvent(payload: unknown): Promise<NormalizedPaymentEvent>;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('IPaymentProvider');
