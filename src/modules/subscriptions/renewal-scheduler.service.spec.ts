import type { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RenewalSchedulerService } from './renewal-scheduler.service';
import { BILLING_EVENTS } from './billing-events';
import type { Subscription } from './entities/subscription.entity';
import type { Plan } from '../plans/entities/plan.entity';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? 'sub-1',
    company_id: overrides.company_id ?? 'company-1',
    plan_id: overrides.plan_id ?? 'plan-1',
    current_period_end:
      overrides.current_period_end ??
      new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    ...overrides,
  } as unknown as Subscription;
}

describe('RenewalSchedulerService', () => {
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let queue: jest.Mocked<Queue>;
  let emitter: EventEmitter2;
  let svc: RenewalSchedulerService;

  beforeEach(() => {
    subRepo = {
      find: jest.fn(),
      save: jest.fn(async (s) => s),
    } as unknown as jest.Mocked<Repository<Subscription>>;
    planRepo = {
      findOne: jest.fn(async () => ({ name: 'Pro' }) as Plan),
    } as unknown as jest.Mocked<Repository<Plan>>;
    queue = { add: jest.fn() } as unknown as jest.Mocked<Queue>;
    emitter = new EventEmitter2();
    jest.spyOn(emitter, 'emit');
    svc = new RenewalSchedulerService(subRepo, queue, planRepo, emitter);
  });

  it('encola un job por cada candidata', async () => {
    subRepo.find.mockResolvedValue([
      makeSub({ id: 'a' }),
      makeSub({ id: 'b' }),
    ]);
    queue.add.mockResolvedValue({} as never);

    const r = await svc.scan();

    expect(r.scanned).toBe(2);
    expect(r.enqueued).toBe(2);
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      'renew',
      { subscriptionId: 'a' },
      expect.objectContaining({
        jobId: expect.stringContaining('renew-a-'),
        attempts: 3,
      }),
    );
  });

  it('cuenta como skipped si BullMQ rechaza un job duplicado', async () => {
    subRepo.find.mockResolvedValue([makeSub({ id: 'a' })]);
    queue.add.mockRejectedValue(new Error('Job exists'));

    const r = await svc.scan();
    expect(r.scanned).toBe(1);
    expect(r.enqueued).toBe(0);
  });

  it('no rompe si no hay candidatas', async () => {
    subRepo.find.mockResolvedValue([]);
    const r = await svc.scan();
    expect(r).toEqual({ scanned: 0, enqueued: 0 });
    expect(queue.add).not.toHaveBeenCalled();
  });

  describe('scanGraceEnding (Sprint G)', () => {
    it('emite GRACE_ENDING y marca grace_warning_sent_at', async () => {
      const sub = makeSub({
        id: 'sub-grace',
        status: 'pending_payment',
        grace_period_until: new Date(Date.now() + 6 * 60 * 60 * 1000),
        grace_warning_sent_at: null,
      });
      subRepo.find.mockResolvedValue([sub]);

      const r = await svc.scanGraceEnding();

      expect(r).toEqual({ scanned: 1, notified: 1 });
      expect(sub.grace_warning_sent_at).toBeInstanceOf(Date);
      expect(subRepo.save).toHaveBeenCalledWith(sub);
      expect(emitter.emit).toHaveBeenCalledWith(
        BILLING_EVENTS.GRACE_ENDING,
        expect.objectContaining({
          subscriptionId: 'sub-grace',
          companyId: 'company-1',
          planName: 'Pro',
        }),
      );
    });

    it('noop si no hay candidatas', async () => {
      subRepo.find.mockResolvedValue([]);
      const r = await svc.scanGraceEnding();
      expect(r).toEqual({ scanned: 0, notified: 0 });
      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('scanSuspendOverdue (Sprint G)', () => {
    it('suspende subs con grace_period_until vencido y emite evento', async () => {
      const sub = makeSub({
        id: 'sub-overdue',
        status: 'pending_payment',
        grace_period_until: new Date(Date.now() - 60 * 1000),
      });
      subRepo.find.mockResolvedValue([sub]);

      const r = await svc.scanSuspendOverdue();

      expect(r).toEqual({ scanned: 1, suspended: 1 });
      expect(sub.status).toBe('suspended');
      expect(sub.suspended_at).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        BILLING_EVENTS.SUBSCRIPTION_SUSPENDED,
        expect.objectContaining({
          subscriptionId: 'sub-overdue',
          companyId: 'company-1',
          planName: 'Pro',
        }),
      );
    });

    it('noop si no hay subs vencidas', async () => {
      subRepo.find.mockResolvedValue([]);
      const r = await svc.scanSuspendOverdue();
      expect(r).toEqual({ scanned: 0, suspended: 0 });
    });
  });
});
