import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, IsNull, LessThanOrEqual, Or, Repository } from 'typeorm';

import { Subscription } from './entities/subscription.entity';

/**
 * Sprint F.1 — RenewalSchedulerService.
 *
 * Cron horario que escanea suscripciones próximas a vencer (o vencidas) y
 * encola un job de renovación por cada una. Idempotente: usa el id de la
 * suscripción como `jobId`, así múltiples ticks no duplican trabajo.
 *
 * Reglas:
 *   REN-001 Look-ahead: 3 días antes de `current_period_end`.
 *   REN-002 Throttle: no re-encolar si `last_renewal_attempt_at` < 6h.
 *   REN-003 Sólo subs en `active` o `pending_payment` (las `canceled` quedan fuera).
 */
@Injectable()
export class RenewalSchedulerService {
  private readonly logger = new Logger(RenewalSchedulerService.name);

  /** Ventana de look-ahead antes del fin de periodo (ms). */
  private readonly LOOKAHEAD_MS = 3 * 24 * 60 * 60 * 1000;
  /** Throttle entre intentos por suscripción (ms). */
  private readonly THROTTLE_MS = 6 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectQueue('subscription-renewal')
    private readonly renewalQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'subscription-renewal-scan' })
  async scan(): Promise<{ enqueued: number; scanned: number }> {
    const now = new Date();
    const horizon = new Date(now.getTime() + this.LOOKAHEAD_MS);
    const throttleCutoff = new Date(now.getTime() - this.THROTTLE_MS);

    const candidates = await this.subRepo.find({
      where: [
        {
          status: In(['active', 'pending_payment']),
          current_period_end: LessThanOrEqual(horizon),
          last_renewal_attempt_at: Or(
            IsNull(),
            LessThanOrEqual(throttleCutoff),
          ),
        },
      ],
      take: 500, // safety cap
    });

    let enqueued = 0;
    for (const sub of candidates) {
      try {
        await this.renewalQueue.add(
          'renew',
          { subscriptionId: sub.id },
          {
            jobId: `renew-${sub.id}-${sub.current_period_end.getTime()}`,
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: { type: 'exponential', delay: 60_000 },
          },
        );
        enqueued += 1;
      } catch (err) {
        // BullMQ rechaza jobIds duplicados — esperado, no es error.
        this.logger.debug(
          `skip enqueue sub=${sub.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `renewal scan: ${candidates.length} candidates, ${enqueued} enqueued`,
    );
    return { enqueued, scanned: candidates.length };
  }
}
