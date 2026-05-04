import { UnauthorizedException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import type { PaymentsService } from './payments.service';
import type { IPaymentProvider } from './payments.types';

describe('PaymentsController', () => {
  let provider: jest.Mocked<IPaymentProvider>;
  let svc: jest.Mocked<PaymentsService>;
  let ctrl: PaymentsController;

  beforeEach(() => {
    provider = {
      providerName: 'mock',
      createCheckout: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      resolveWebhookEvent: jest.fn(),
    } as unknown as jest.Mocked<IPaymentProvider>;
    svc = {
      createCheckout: jest.fn(),
      processWebhook: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;
    ctrl = new PaymentsController(svc, provider);
  });

  it('createCheckout delega al service con currency default CLP', async () => {
    svc.createCheckout.mockResolvedValue({
      initPoint: 'http://x',
      providerCheckoutId: 'p1',
      externalReference: 'r1',
    });
    const out = await ctrl.createCheckout({
      subscriptionId: 's1',
      amount: 9900,
      itemTitle: 'Pro',
    } as any);
    expect(out.initPoint).toBe('http://x');
    expect(svc.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'CLP', subscriptionId: 's1' }),
    );
  });

  it('webhook con firma inválida → 401 (PAY-001)', async () => {
    provider.verifyWebhookSignature.mockReturnValue(false);
    const req = { headers: {}, rawBody: '{}' } as any;
    await expect(ctrl.webhook(req, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(svc.processWebhook).not.toHaveBeenCalled();
  });

  it('webhook con firma válida → procesa y devuelve received', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    svc.processWebhook.mockResolvedValue({
      idempotent: false,
      type: 'payment.approved',
      externalId: 'pay-1',
    });
    const req = {
      headers: { 'X-Signature': 'mock-signature' },
      rawBody: '{}',
    } as any;
    const out = await ctrl.webhook(req, { type: 'payment' });
    expect(out).toEqual({
      received: true,
      idempotent: false,
      type: 'payment.approved',
      externalId: 'pay-1',
    });
    // headers lowercased
    const passedHeaders = provider.verifyWebhookSignature.mock.calls[0][1];
    expect(passedHeaders['x-signature']).toBe('mock-signature');
  });

  it('webhook usa rawBody si está, si no fallback a JSON.stringify(body)', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    svc.processWebhook.mockResolvedValue({
      idempotent: true,
      type: 'unknown',
      externalId: 'x',
    });
    const req = { headers: {} } as any;
    await ctrl.webhook(req, { hello: 'world' });
    const rawArg = provider.verifyWebhookSignature.mock.calls[0][0];
    expect(rawArg).toBe(JSON.stringify({ hello: 'world' }));
  });
});
