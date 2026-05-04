import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  CheckoutInput,
  CheckoutResult,
  IPaymentProvider,
  NormalizedPaymentEvent,
  PaymentEventType,
  PaymentProviderName,
} from '../payments.types';

/**
 * Sprint E — Provider mock para dev sin token y para tests unit/e2e.
 *
 * - `createCheckout` devuelve URLs determinísticas con el `externalReference`
 *   en query string para poder simular el callback manual.
 * - `verifyWebhookSignature` acepta cualquier firma `mock-signature` o vacía
 *   (solo dev/test).
 * - `resolveWebhookEvent` espera un body con shape `{ type, externalId, ... }`
 *   ya normalizado.
 */
@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly providerName: PaymentProviderName = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const externalReference = `mock-${input.subscriptionId}-${randomUUID().slice(0, 8)}`;
    const providerCheckoutId = `mock_pref_${randomUUID().slice(0, 12)}`;
    this.logger.debug(
      `mock.createCheckout sub=${input.subscriptionId} amount=${input.amount}${input.currency}`,
    );
    return {
      initPoint: `https://mock.payments/checkout?ref=${externalReference}`,
      sandboxInitPoint: `https://mock.payments/sandbox?ref=${externalReference}`,
      providerCheckoutId,
      externalReference,
    };
  }

  verifyWebhookSignature(
    _rawBody: string,
    headers: Record<string, string>,
  ): boolean {
    const sig = (headers['x-signature'] ?? '').toLowerCase();
    // Dev: aceptamos vacío o el literal 'mock-signature'
    return sig === '' || sig === 'mock-signature';
  }

  async resolveWebhookEvent(payload: unknown): Promise<NormalizedPaymentEvent> {
    const body = (payload ?? {}) as Partial<NormalizedPaymentEvent> & {
      type?: string;
    };
    const type = (body.type as PaymentEventType) ?? 'unknown';
    return {
      type,
      externalId: body.externalId ?? `mock-evt-${randomUUID().slice(0, 8)}`,
      providerCheckoutId: body.providerCheckoutId,
      externalReference: body.externalReference,
      amount: body.amount,
      currency: body.currency ?? 'CLP',
      raw: payload,
    };
  }
}
