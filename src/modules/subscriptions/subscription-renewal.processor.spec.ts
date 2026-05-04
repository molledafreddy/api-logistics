import type { Repository } from 'typeorm';
import { Job, Queue } from 'bullmq';

import { SubscriptionRenewalProcessor } from './subscription-renewal.processor';
import type { Subscription } from './entities/subscription.entity';
import type { Plan } from '../plans/entities/plan.entity';
import type { PaymentsService } from '../payments/payments.service';

function repoMock<T extends object>() {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (x: T) => x),
  } as unknown as jest.Mocked<Repository<T>>;
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    company_id: 'co-1',
    plan_id: 'plan-1',
    status: 'active',
    current_period_start: new Date('2025-01-01T00:00:00Z'),
    current_period_end: new Date('2025-02-01T00:00:00Z'),
    cancel_at_period_end: false,
    provider: 'mercadopago',
    grace_period_until: null,
    last_renewal_attempt_at: null,
    last_renewal_init_point: null,
    ...overrides,
  } as unknown as Subscription;
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'Pro',
    price: 14990,
    ...overrides,
  } as unknown as Plan;
}

function makeJob(subscriptionId = 'sub-1') {
  return {
    id: 'job-1',
    data: { subscriptionId },
  } as unknown as Job<{ subscriptionId: string }>;
}

describe('SubscriptionRenewalProcessor', () => {
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let paymentsService: jest.Mocked<PaymentsService>;
  let queue: jest.Mocked<Queue>;
  let proc: SubscriptionRenewalProcessor;

  beforeEach(() => {
    subRepo = repoMock<Subscription>();
    planRepo = repoMock<Plan>();
    paymentsService = {
      createCheckout: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;
    queue = { close: jest.fn() } as unknown as jest.Mocked<Queue>;
    proc = new SubscriptionRenewalProcessor(
      subRepo,
      planRepo,
      paymentsService,
      queue,
    );
  });

  it('REN-001: noop si la sub no existe', async () => {
    subRepo.findOne.mockResolvedValue(null);
    const r = await proc.process(makeJob('missing'));
    expect(r.status).toBe('noop');
    expect(paymentsService.createCheckout).not.toHaveBeenCalled();
  });

  it('REN-002: noop si la sub ya está canceled', async () => {
    subRepo.findOne.mockResolvedValue(makeSub({ status: 'canceled' }));
    const r = await proc.process(makeJob());
    expect(r.status).toBe('noop');
    expect(paymentsService.createCheckout).not.toHaveBeenCalled();
  });

  it('REN-003: genera checkout y persiste initPoint cuando aún hay periodo', async () => {
    const sub = makeSub({
      current_period_end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // dentro de 2d
    });
    subRepo.findOne.mockResolvedValue(sub);
    planRepo.findOne.mockResolvedValue(makePlan());
    paymentsService.createCheckout.mockResolvedValue({
      initPoint: 'https://mp/checkout/abc',
      providerCheckoutId: 'pref-1',
      externalReference: 'ref-1',
    });

    const r = await proc.process(makeJob());

    expect(r.status).toBe('checkout_created');
    expect(r.initPoint).toBe('https://mp/checkout/abc');
    expect(paymentsService.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-1',
        companyId: 'co-1',
        amount: 14990,
        currency: 'CLP',
        itemTitle: expect.stringContaining('Pro'),
      }),
    );
    expect(sub.last_renewal_init_point).toBe('https://mp/checkout/abc');
    expect(sub.last_renewal_attempt_at).toBeInstanceOf(Date);
  });

  it('REN-004: abre gracia y genera checkout cuando el periodo ya venció', async () => {
    const sub = makeSub({
      status: 'active',
      current_period_end: new Date(Date.now() - 1 * 60 * 60 * 1000), // hace 1h
      grace_period_until: null,
    });
    subRepo.findOne.mockResolvedValue(sub);
    planRepo.findOne.mockResolvedValue(makePlan());
    paymentsService.createCheckout.mockResolvedValue({
      initPoint: 'https://mp/checkout/xyz',
      providerCheckoutId: 'pref-2',
      externalReference: 'ref-2',
    });

    const r = await proc.process(makeJob());

    expect(r.status).toBe('grace_opened');
    expect(sub.status).toBe('pending_payment');
    expect(sub.grace_period_until).toBeInstanceOf(Date);
    expect(sub.grace_period_until!.getTime()).toBeGreaterThan(Date.now());
  });

  it('REN-005: cancela cuando la gracia ya expiró', async () => {
    const sub = makeSub({
      status: 'pending_payment',
      current_period_end: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      grace_period_until: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });
    subRepo.findOne.mockResolvedValue(sub);

    const r = await proc.process(makeJob());

    expect(r.status).toBe('canceled');
    expect(sub.status).toBe('canceled');
    expect(sub.canceled_at).toBeInstanceOf(Date);
    expect(paymentsService.createCheckout).not.toHaveBeenCalled();
  });

  it('REN-007: plan free auto-renueva sin checkout', async () => {
    const sub = makeSub({
      current_period_end: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    });
    subRepo.findOne.mockResolvedValue(sub);
    planRepo.findOne.mockResolvedValue(makePlan({ price: 0, name: 'Free' }));

    const r = await proc.process(makeJob());

    expect(r.status).toBe('noop');
    expect(paymentsService.createCheckout).not.toHaveBeenCalled();
    expect(sub.status).toBe('active');
    expect(sub.current_period_end.getTime()).toBeGreaterThan(Date.now());
  });

  it('REN-008: persiste timestamp de intento aún si el checkout falla', async () => {
    const sub = makeSub({
      current_period_end: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    });
    subRepo.findOne.mockResolvedValue(sub);
    planRepo.findOne.mockResolvedValue(makePlan());
    paymentsService.createCheckout.mockRejectedValue(new Error('MP down'));

    await expect(proc.process(makeJob())).rejects.toThrow('MP down');
    expect(sub.last_renewal_attempt_at).toBeInstanceOf(Date);
  });
});
