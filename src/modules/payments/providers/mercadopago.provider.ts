import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type {
  CheckoutInput,
  CheckoutResult,
  IPaymentProvider,
  NormalizedPaymentEvent,
  PaymentEventType,
  PaymentProviderName,
} from '../payments.types';

/**
 * Sprint E — Provider MercadoPago Chile (CLP).
 *
 * Estrategia: **Checkout Pro con Preference single-payment**.
 *   - Más simple que Preapproval (que exige aprobación bancaria).
 *   - El renovado mensual se gestiona desde el scheduler de subscription
 *     (`subscription-renewal.processor`), creando una nueva preference si la
 *     subscription sigue activa.
 *
 * Endpoints:
 *   - POST https://api.mercadopago.com/checkout/preferences
 *   - GET  https://api.mercadopago.com/v1/payments/{id}        (resolveWebhookEvent)
 *
 * Webhook (Notificaciones IPN/Webhooks v2):
 *   - Header `x-signature`: `ts=...,v1=...` (HMAC-SHA256)
 *   - Header `x-request-id`
 *   - Body: `{ action, data: { id }, type, ... }`
 *   - Manifest a firmar: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 *
 * Reglas:
 *   PAY-MP-001  Sin `MERCADOPACO_ACCESS_TOKEN` → ServiceUnavailable al hacer checkout.
 *   PAY-MP-002  Firma inválida en webhook → verifyWebhookSignature() = false.
 *   PAY-MP-003  Timeout/HTTP error en createCheckout → ServiceUnavailable.
 */
@Injectable()
export class MercadoPagoProvider implements IPaymentProvider {
  readonly providerName: PaymentProviderName = 'mercadopago';
  private readonly logger = new Logger(MercadoPagoProvider.name);

  private readonly token: string;
  private readonly webhookSecret: string;
  private readonly notificationUrl: string;
  private readonly successUrl: string;
  private readonly failureUrl: string;
  private readonly pendingUrl: string;
  private readonly timeoutMs: number;
  private readonly baseUrl = 'https://api.mercadopago.com';

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN', '');
    this.webhookSecret = this.config.get<string>(
      'MERCADOPAGO_WEBHOOK_SECRET',
      '',
    );
    this.notificationUrl = this.config.get<string>(
      'MERCADOPAGO_NOTIFICATION_URL',
      '',
    );
    this.successUrl = this.config.get<string>(
      'MERCADOPAGO_SUCCESS_URL',
      'http://localhost:3001/billing/success',
    );
    this.failureUrl = this.config.get<string>(
      'MERCADOPAGO_FAILURE_URL',
      'http://localhost:3001/billing/failure',
    );
    this.pendingUrl = this.config.get<string>(
      'MERCADOPAGO_PENDING_URL',
      'http://localhost:3001/billing/pending',
    );
    this.timeoutMs = Number(
      this.config.get<number>('MERCADOPAGO_TIMEOUT_MS', 8000),
    );
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'PAY-MP-001: MERCADOPAGO_ACCESS_TOKEN no configurado.',
      );
    }
    const externalReference = `mp-${input.subscriptionId}-${randomUUID().slice(0, 8)}`;

    const body = {
      items: [
        {
          id: input.subscriptionId,
          title: input.itemTitle,
          description: input.itemTitle,
          quantity: 1,
          currency_id: input.currency,
          unit_price: input.amount,
        },
      ],
      external_reference: externalReference,
      back_urls: {
        success: this.successUrl,
        failure: this.failureUrl,
        pending: this.pendingUrl,
      },
      auto_return: 'approved' as const,
      notification_url: this.notificationUrl || undefined,
      metadata: {
        subscription_id: input.subscriptionId,
        company_id: input.companyId,
      },
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    };

    const url = `${this.baseUrl}/checkout/preferences`;
    const data = await this.callJson<{
      id: string;
      init_point: string;
      sandbox_init_point?: string;
    }>(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': externalReference,
      },
      body: JSON.stringify(body),
    });

    return {
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
      providerCheckoutId: data.id,
      externalReference,
    };
  }

  /**
   * Verifica la firma HMAC-SHA256 enviada por MercadoPago.
   *
   * Header `x-signature` viene como `ts=1700000000,v1=hex...`.
   * Manifiesto: `id:{data.id};request-id:{x-request-id};ts:{ts};`
   *
   * En sandbox/dev, si no hay `MERCADOPAGO_WEBHOOK_SECRET`, devolvemos `true`
   * (modo desarrollo). En producción debe estar siempre seteado.
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'MERCADOPAGO_WEBHOOK_SECRET vacío — saltando verificación (NO usar en producción).',
      );
      return true;
    }

    const xSignature = headers['x-signature'] ?? '';
    const xRequestId = headers['x-request-id'] ?? '';
    if (!xSignature) return false;

    // Parse "ts=...,v1=..."
    const parts = Object.fromEntries(
      xSignature
        .split(',')
        .map((p) => p.trim().split('='))
        .filter((kv) => kv.length === 2)
        .map(([k, v]) => [k.trim(), v.trim()]),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // dataId: leer del body parseado o del query (?id=)
    let dataId = '';
    try {
      const parsed = JSON.parse(rawBody);
      dataId = String(parsed?.data?.id ?? parsed?.id ?? '');
    } catch {
      /* body vacío o no-json */
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(manifest)
      .digest('hex');

    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(v1, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * MercadoPago envía un webhook minimalista; hay que hacer GET al detalle del
   * payment para conocer status/amount/external_reference.
   *
   * Body típico:
   *   { action: 'payment.updated', data: { id: '12345' }, type: 'payment', ... }
   */
  async resolveWebhookEvent(payload: unknown): Promise<NormalizedPaymentEvent> {
    const body = (payload ?? {}) as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
    };

    const paymentId = body?.data?.id ? String(body.data.id) : '';
    if (!paymentId || body.type !== 'payment') {
      // Otros tipos (subscription_preapproval, plan, etc.) los ignoramos en E1.
      return {
        type: 'unknown',
        externalId: paymentId || `mp-noid-${randomUUID().slice(0, 8)}`,
        raw: payload,
      };
    }

    if (!this.token) {
      throw new ServiceUnavailableException(
        'PAY-MP-001: MERCADOPAGO_ACCESS_TOKEN no configurado.',
      );
    }

    const url = `${this.baseUrl}/v1/payments/${paymentId}`;
    const detail = await this.callJson<MpPaymentDetail>(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });

    return {
      type: this.mapStatus(detail.status, detail.status_detail),
      externalId: String(detail.id),
      providerCheckoutId: detail?.order?.id
        ? String(detail.order.id)
        : undefined,
      externalReference: detail.external_reference ?? undefined,
      amount: detail.transaction_amount,
      currency: detail.currency_id,
      raw: detail,
    };
  }

  // ─── Helpers ───────────────────────────────

  private mapStatus(status?: string, statusDetail?: string): PaymentEventType {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return 'payment.approved';
      case 'rejected':
        return 'payment.rejected';
      case 'cancelled':
        return 'payment.cancelled';
      case 'refunded':
      case 'charged_back':
        return 'payment.refunded';
      case 'in_process':
      case 'pending':
      case 'authorized':
        return 'payment.pending';
      default:
        this.logger.warn(
          `MP status desconocido: ${status} (${statusDetail}) → unknown`,
        );
        return 'unknown';
    }
  }

  private async callJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `PAY-MP-003: MercadoPago ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg =
        (err as Error)?.name === 'AbortError'
          ? `timeout ${this.timeoutMs}ms`
          : (err as Error).message;
      throw new ServiceUnavailableException(`PAY-MP-003: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── MP API types (subset) ───────────────────
interface MpPaymentDetail {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  order?: { id?: number | string };
  metadata?: Record<string, unknown>;
}
