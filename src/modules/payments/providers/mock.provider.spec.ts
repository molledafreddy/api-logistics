import { MockPaymentProvider } from './mock.provider';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('providerName === "mock"', () => {
    expect(provider.providerName).toBe('mock');
  });

  it('createCheckout devuelve URLs e ids con el externalReference', async () => {
    const out = await provider.createCheckout({
      subscriptionId: 'sub-123',
      companyId: 'co-1',
      amount: 9900,
      currency: 'CLP',
      itemTitle: 'Plan Pro',
    });
    expect(out.externalReference).toMatch(/^mock-sub-123-/);
    expect(out.providerCheckoutId).toMatch(/^mock_pref_/);
    expect(out.initPoint).toContain(out.externalReference);
    expect(out.sandboxInitPoint).toContain(out.externalReference);
  });

  it('verifyWebhookSignature acepta vacío y "mock-signature"', () => {
    expect(provider.verifyWebhookSignature('', {})).toBe(true);
    expect(
      provider.verifyWebhookSignature('{}', {
        'x-signature': 'mock-signature',
      }),
    ).toBe(true);
  });

  it('verifyWebhookSignature rechaza otras firmas', () => {
    expect(
      provider.verifyWebhookSignature('{}', { 'x-signature': 'foo' }),
    ).toBe(false);
  });

  it('resolveWebhookEvent normaliza payload pre-shaped', async () => {
    const evt = await provider.resolveWebhookEvent({
      type: 'payment.approved',
      externalId: 'pay-1',
      externalReference: 'mock-sub-1-abc',
      amount: 9900,
      currency: 'CLP',
    });
    expect(evt.type).toBe('payment.approved');
    expect(evt.externalId).toBe('pay-1');
    expect(evt.externalReference).toBe('mock-sub-1-abc');
    expect(evt.amount).toBe(9900);
  });

  it('resolveWebhookEvent default → unknown con id auto', async () => {
    const evt = await provider.resolveWebhookEvent({});
    expect(evt.type).toBe('unknown');
    expect(evt.externalId).toMatch(/^mock-evt-/);
  });
});
