import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { BillingService } from './billing.service';
import type { Subscription } from '../subscriptions/entities/subscription.entity';
import type { Plan } from '../plans/entities/plan.entity';
import type { PaymentEvent } from '../subscriptions/entities/payment-event.entity';
import type { PaymentsService } from './payments.service';

function repoMock<T extends object>() {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (x: T) => x),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('BillingService', () => {
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let paymentEventRepo: jest.Mocked<Repository<PaymentEvent>>;
  let payments: jest.Mocked<PaymentsService>;
  let svc: BillingService;

  beforeEach(() => {
    subRepo = repoMock<Subscription>();
    planRepo = repoMock<Plan>();
    paymentEventRepo = repoMock<PaymentEvent>();
    payments = {
      createCheckout: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;
    svc = new BillingService(subRepo, planRepo, paymentEventRepo, payments);
  });

  it('404 si la company no tiene sub activa', async () => {
    subRepo.findOne.mockResolvedValue(null);
    await expect(svc.getMyRenewal('co-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 si el plan asociado no existe', async () => {
    subRepo.findOne.mockResolvedValue({
      id: 's',
      plan_id: 'p-missing',
      status: 'active',
      current_period_end: new Date('2025-02-01'),
      grace_period_until: null,
      last_renewal_attempt_at: null,
      last_renewal_init_point: null,
    } as unknown as Subscription);
    planRepo.findOne.mockResolvedValue(null);
    await expect(svc.getMyRenewal('co-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve la vista con initPoint si fue persistido', async () => {
    subRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      plan_id: 'plan-1',
      status: 'pending_payment',
      current_period_end: new Date('2025-02-01T00:00:00Z'),
      grace_period_until: new Date('2025-02-08T00:00:00Z'),
      last_renewal_attempt_at: new Date('2025-01-31T12:00:00Z'),
      last_renewal_init_point: 'https://mp/checkout/xyz',
    } as unknown as Subscription);
    planRepo.findOne.mockResolvedValue({
      id: 'plan-1',
      name: 'Pro',
      price: 14990,
    } as unknown as Plan);

    const r = await svc.getMyRenewal('co-1');

    expect(r).toEqual({
      subscriptionId: 'sub-1',
      status: 'pending_payment',
      planId: 'plan-1',
      planName: 'Pro',
      amount: 14990,
      currency: 'CLP',
      currentPeriodEnd: '2025-02-01T00:00:00.000Z',
      gracePeriodUntil: '2025-02-08T00:00:00.000Z',
      lastRenewalAttemptAt: '2025-01-31T12:00:00.000Z',
      initPoint: 'https://mp/checkout/xyz',
    });
  });

  describe('retry (Sprint F.2)', () => {
    function makeSub(overrides: Partial<Subscription> = {}): Subscription {
      return {
        id: 'sub-1',
        company_id: 'co-1',
        plan_id: 'plan-1',
        status: 'pending_payment',
        current_period_end: new Date('2025-02-01T00:00:00Z'),
        grace_period_until: null,
        last_renewal_attempt_at: null,
        last_renewal_init_point: null,
        ...overrides,
      } as unknown as Subscription;
    }

    it('lanza NotFound si no hay sub retriable', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(svc.retry('co-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza BadRequest si está dentro del throttle (5 min)', async () => {
      subRepo.findOne.mockResolvedValue(
        makeSub({
          last_renewal_attempt_at: new Date(Date.now() - 60 * 1000),
        }),
      );
      await expect(svc.retry('co-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('lanza BadRequest si el plan es free', async () => {
      subRepo.findOne.mockResolvedValue(makeSub());
      planRepo.findOne.mockResolvedValue({
        id: 'plan-1',
        name: 'Free',
        price: 0,
      } as unknown as Plan);
      await expect(svc.retry('co-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('genera nuevo checkout y persiste init_point', async () => {
      const sub = makeSub();
      subRepo.findOne.mockResolvedValue(sub);
      planRepo.findOne.mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
        price: 14990,
      } as unknown as Plan);
      payments.createCheckout.mockResolvedValue({
        initPoint: 'https://mp/new',
        providerCheckoutId: 'p',
        externalReference: 'r',
      });

      const r = await svc.retry('co-1');

      expect(r.initPoint).toBe('https://mp/new');
      expect(sub.last_renewal_init_point).toBe('https://mp/new');
      expect(sub.last_renewal_attempt_at).toBeInstanceOf(Date);
      expect(payments.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub-1',
          companyId: 'co-1',
          amount: 14990,
        }),
      );
    });

    it('acepta sub en estado suspended', async () => {
      const sub = makeSub({ status: 'suspended' });
      subRepo.findOne.mockResolvedValue(sub);
      planRepo.findOne.mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
        price: 14990,
      } as unknown as Plan);
      payments.createCheckout.mockResolvedValue({
        initPoint: 'https://mp/new2',
        providerCheckoutId: 'p',
        externalReference: 'r',
      });

      const r = await svc.retry('co-1');
      expect(r.initPoint).toBe('https://mp/new2');
    });
  });
});
