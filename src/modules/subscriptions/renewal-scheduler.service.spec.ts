import type { Repository } from 'typeorm';
import { Queue } from 'bullmq';

import { RenewalSchedulerService } from './renewal-scheduler.service';
import type { Subscription } from './entities/subscription.entity';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? 'sub-1',
    current_period_end:
      overrides.current_period_end ??
      new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    ...overrides,
  } as unknown as Subscription;
}

describe('RenewalSchedulerService', () => {
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let queue: jest.Mocked<Queue>;
  let svc: RenewalSchedulerService;

  beforeEach(() => {
    subRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Subscription>>;
    queue = { add: jest.fn() } as unknown as jest.Mocked<Queue>;
    svc = new RenewalSchedulerService(subRepo, queue);
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
});
