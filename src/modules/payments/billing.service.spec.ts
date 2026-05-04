import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { BillingService } from './billing.service';
import type { Subscription } from '../subscriptions/entities/subscription.entity';
import type { Plan } from '../plans/entities/plan.entity';

function repoMock<T extends object>() {
  return { findOne: jest.fn() } as unknown as jest.Mocked<Repository<T>>;
}

describe('BillingService', () => {
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let svc: BillingService;

  beforeEach(() => {
    subRepo = repoMock<Subscription>();
    planRepo = repoMock<Plan>();
    svc = new BillingService(subRepo, planRepo);
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
});
