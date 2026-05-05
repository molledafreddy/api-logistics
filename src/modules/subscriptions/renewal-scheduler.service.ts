import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Between, In, IsNull, LessThanOrEqual, Or, Repository } from 'typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { BILLING_EVENTS, BillingEventPayload } from './billing-events';
import { Subscription } from './entities/subscription.entity';

/**
 * Sprint F.1 + Sprint G — RenewalSchedulerService.
 *
 * Cron horario que escanea suscripciones próximas a vencer (o vencidas) y
 * encola un job de renovación por cada una. Idempotente: usa el id de la
 * suscripción como `jobId`, así múltiples ticks no duplican trabajo.
 *
 * Reglas:
 *   REN-001 Look-ahead: 3 días antes de `current_period_end`.
 *   REN-002 Throttle: no re-encolar si `last_renewal_attempt_at` < 6h.
 *   REN-003 Sólo subs en `active` o `pending_payment` (las `canceled` quedan fuera).
 *
 * Sprint G — defensivos extra:
 *   REN-008 `scanGraceEnding`: cada 6h emite `GRACE_ENDING` cuando la sub
 *           tiene gracia activa con < 24h restantes y no se ha avisado aún.
 *   REN-009 `scanSuspendOverdue`: cada hora suspende directamente subs con
 *           `grace_period_until <= now` que sigan en `pending_payment` (defensa
 *           si el processor no llegó a correr por throttle/colisión jobId).
 */
@Injectable()
export class RenewalSchedulerService {
  private readonly logger = new Logger(RenewalSchedulerService.name);

  /** Ventana de look-ahead antes del fin de periodo (ms). */
  private readonly LOOKAHEAD_MS = 3 * 24 * 60 * 60 * 1000;
  /** Throttle entre intentos por suscripción (ms). */
  private readonly THROTTLE_MS = 6 * 60 * 60 * 1000;
  /** Anticipación con la que avisamos "tu gracia vence en <24h" (ms). */
  private readonly GRACE_ENDING_MS = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectQueue('subscription-renewal')
    private readonly renewalQueue: Queue,
    // Optional para mantener compatibilidad con specs existentes que
    // construyen el servicio con sólo dos dependencias.
    @Optional()
    @InjectRepository(Plan)
    private readonly planRepo?: Repository<Plan>,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
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

  /**
   * REN-008 (Sprint G) — Aviso "tu gracia vence en <24h".
   *
   * Recorre subs en `pending_payment` con `grace_period_until` dentro de las
   * próximas 24h y aún sin `grace_warning_sent_at`, y emite `GRACE_ENDING`
   * para que `BillingNotificationsService` cree la notificación. Idempotente:
   * el flag `grace_warning_sent_at` evita reenviar.
   */
  @Cron(CronExpression.EVERY_6_HOURS, { name: 'subscription-grace-ending' })
  async scanGraceEnding(): Promise<{ scanned: number; notified: number }> {
    const now = new Date();
    const horizon = new Date(now.getTime() + this.GRACE_ENDING_MS);

    const candidates = await this.subRepo.find({
      where: {
        status: 'pending_payment',
        grace_period_until: Between(now, horizon),
        grace_warning_sent_at: IsNull(),
      },
      take: 500,
    });

    let notified = 0;
    for (const sub of candidates) {
      try {
        const planName = await this.resolvePlanName(sub.plan_id);
        sub.grace_warning_sent_at = now;
        await this.subRepo.save(sub);
        this.emit(BILLING_EVENTS.GRACE_ENDING, {
          subscriptionId: sub.id,
          companyId: sub.company_id,
          planName,
          meta: {
            gracePeriodUntil: sub.grace_period_until!.toISOString(),
          },
        });
        notified += 1;
      } catch (err) {
        this.logger.error(
          `grace-ending notify falló sub=${sub.id}: ${(err as Error).message}`,
        );
      }
    }

    if (candidates.length > 0) {
      this.logger.log(
        `grace-ending scan: ${candidates.length} candidates, ${notified} notified`,
      );
    }
    return { scanned: candidates.length, notified };
  }

  /**
   * REN-009 (Sprint G) — Suspensión defensiva.
   *
   * Detecta subs con `grace_period_until <= now` que aún no estén `suspended`
   * (típicamente quedaron en `pending_payment` porque BullMQ rechazó el job
   * por colisión de `jobId` o el processor no llegó a correr). Las suspende
   * inline y emite `SUBSCRIPTION_SUSPENDED`.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'subscription-suspend-overdue' })
  async scanSuspendOverdue(): Promise<{ scanned: number; suspended: number }> {
    const now = new Date();

    const candidates = await this.subRepo.find({
      where: {
        status: In(['pending_payment', 'active']),
        grace_period_until: LessThanOrEqual(now),
      },
      take: 500,
    });

    let suspended = 0;
    for (const sub of candidates) {
      if (!sub.grace_period_until) continue;
      try {
        const planName = await this.resolvePlanName(sub.plan_id);
        sub.status = 'suspended';
        sub.suspended_at = now;
        await this.subRepo.save(sub);
        this.emit(BILLING_EVENTS.SUBSCRIPTION_SUSPENDED, {
          subscriptionId: sub.id,
          companyId: sub.company_id,
          planName,
          meta: {
            suspendedAt: now.toISOString(),
            gracePeriodUntil: sub.grace_period_until.toISOString(),
          },
        });
        suspended += 1;
      } catch (err) {
        this.logger.error(
          `suspend-overdue falló sub=${sub.id}: ${(err as Error).message}`,
        );
      }
    }

    if (candidates.length > 0) {
      this.logger.log(
        `suspend-overdue scan: ${candidates.length} candidates, ${suspended} suspended`,
      );
    }
    return { scanned: candidates.length, suspended };
  }

  private async resolvePlanName(planId: string): Promise<string> {
    if (!this.planRepo) return 'plan';
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    return plan?.name ?? 'plan';
  }

  private emit(eventName: string, payload: BillingEventPayload): void {
    if (!this.eventEmitter) return;
    this.eventEmitter.emit(eventName, payload);
  }
}
