import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { MercadoPagoProvider } from './mercadopago.provider';

function buildConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    MERCADOPAGO_ACCESS_TOKEN: 'TEST-token',
    MERCADOPAGO_WEBHOOK_SECRET: 'whsec',
    MERCADOPAGO_NOTIFICATION_URL:
      'https://api.example.com/v1/payments/mercadopago/webhook',
    MERCADOPAGO_SUCCESS_URL: 'https://app/ok',
    MERCADOPAGO_FAILURE_URL: 'https://app/ko',
    MERCADOPAGO_PENDING_URL: 'https://app/pend',
    MERCADOPAGO_TIMEOUT_MS: 5000,
    ...overrides,
  };
  return {
    get: <T>(key: string, def?: T) => (defaults[key] as T) ?? (def as T),
  } as unknown as ConfigService;
}

describe('MercadoPagoProvider', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('providerName === "mercadopago"', () => {
    const p = new MercadoPagoProvider(buildConfig());
    expect(p.providerName).toBe('mercadopago');
  });

  it('createCheckout sin token → ServiceUnavailable (PAY-MP-001)', async () => {
    const p = new MercadoPagoProvider(
      buildConfig({ MERCADOPAGO_ACCESS_TOKEN: '' }),
    );
    await expect(
      p.createCheckout({
        subscriptionId: 'sub-1',
        companyId: 'co-1',
        amount: 9900,
        currency: 'CLP',
        itemTitle: 'Plan Pro',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('createCheckout llama a /checkout/preferences con Bearer y body válido', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'pref_1',
          init_point: 'https://mp/checkout/pref_1',
          sandbox_init_point: 'https://mp/sandbox/pref_1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const p = new MercadoPagoProvider(buildConfig());
    const out = await p.createCheckout({
      subscriptionId: 'sub-42',
      companyId: 'co-1',
      amount: 9900,
      currency: 'CLP',
      itemTitle: 'Plan Pro',
      payerEmail: 'foo@bar.cl',
    });

    expect(out.providerCheckoutId).toBe('pref_1');
    expect(out.initPoint).toContain('pref_1');
    expect(out.externalReference).toMatch(/^mp-sub-42-/);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST-token');
    expect(headers['X-Idempotency-Key']).toBe(out.externalReference);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.items[0].unit_price).toBe(9900);
    expect(body.items[0].currency_id).toBe('CLP');
    // payer debe ser undefined para evitar que MP detecte self-payment
    // cuando el comprador usa la misma cuenta que el vendedor.
    expect(body.payer).toBeUndefined();
    expect(body.external_reference).toBe(out.externalReference);
  });

  it('createCheckout HTTP 500 → ServiceUnavailable (PAY-MP-003)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('boom', { status: 500 }),
      ) as unknown as typeof fetch;

    const p = new MercadoPagoProvider(buildConfig());
    await expect(
      p.createCheckout({
        subscriptionId: 's1',
        companyId: 'c1',
        amount: 100,
        currency: 'CLP',
        itemTitle: 'x',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('verifyWebhookSignature: secret vacío → true (dev)', () => {
    const p = new MercadoPagoProvider(
      buildConfig({ MERCADOPAGO_WEBHOOK_SECRET: '' }),
    );
    expect(p.verifyWebhookSignature('{}', {})).toBe(true);
  });

  it('verifyWebhookSignature: HMAC válido → true', () => {
    const p = new MercadoPagoProvider(buildConfig());
    const ts = '1700000000';
    const xRequestId = 'req-123';
    const dataId = '999';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const v1 = createHmac('sha256', 'whsec').update(manifest).digest('hex');

    const ok = p.verifyWebhookSignature(
      JSON.stringify({ data: { id: dataId }, type: 'payment' }),
      {
        'x-signature': `ts=${ts},v1=${v1}`,
        'x-request-id': xRequestId,
      },
    );
    expect(ok).toBe(true);
  });

  it('verifyWebhookSignature: v1 manipulado → false', () => {
    const p = new MercadoPagoProvider(buildConfig());
    const ts = '1700000000';
    const ok = p.verifyWebhookSignature(
      JSON.stringify({ data: { id: '1' }, type: 'payment' }),
      {
        'x-signature': `ts=${ts},v1=${'00'.repeat(32)}`,
        'x-request-id': 'r1',
      },
    );
    expect(ok).toBe(false);
  });

  it('verifyWebhookSignature: header ausente → false', () => {
    const p = new MercadoPagoProvider(buildConfig());
    expect(p.verifyWebhookSignature('{}', {})).toBe(false);
  });

  it('resolveWebhookEvent: type !== payment → unknown (sin fetch)', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const p = new MercadoPagoProvider(buildConfig());
    const evt = await p.resolveWebhookEvent({
      type: 'subscription_preapproval',
      data: { id: 'x' },
    });
    expect(evt.type).toBe('unknown');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolveWebhookEvent: payment approved → mapea a payment.approved', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          status: 'approved',
          status_detail: 'accredited',
          external_reference: 'mp-sub-1-abc',
          transaction_amount: 9900,
          currency_id: 'CLP',
          order: { id: 'order-1' },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const p = new MercadoPagoProvider(buildConfig());
    const evt = await p.resolveWebhookEvent({
      type: 'payment',
      data: { id: 12345 },
    });
    expect(evt.type).toBe('payment.approved');
    expect(evt.externalId).toBe('12345');
    expect(evt.externalReference).toBe('mp-sub-1-abc');
    expect(evt.amount).toBe(9900);
    expect(evt.currency).toBe('CLP');
    expect(evt.providerCheckoutId).toBe('order-1');
  });

  it('resolveWebhookEvent mapea status: rejected, cancelled, refunded, pending, raro → unknown', async () => {
    const cases: Array<[string, string]> = [
      ['rejected', 'payment.rejected'],
      ['cancelled', 'payment.cancelled'],
      ['refunded', 'payment.refunded'],
      ['charged_back', 'payment.refunded'],
      ['in_process', 'payment.pending'],
      ['authorized', 'payment.pending'],
      ['weird_status', 'unknown'],
    ];
    const p = new MercadoPagoProvider(buildConfig());
    for (const [status, expected] of cases) {
      global.fetch = jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 1,
            status,
            transaction_amount: 1,
            currency_id: 'CLP',
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;
      const evt = await p.resolveWebhookEvent({
        type: 'payment',
        data: { id: 1 },
      });
      expect(evt.type).toBe(expected);
    }
  });
});
