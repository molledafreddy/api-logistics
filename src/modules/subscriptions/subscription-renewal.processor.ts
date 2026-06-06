import { Processor, WorkerHost, OnQueueEvent } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { PaymentsService } from '../payments/payments.service';
import { Subscription } from './entities/subscription.entity';
import { BILLING_EVENTS, BillingEventPayload } from './billing-events';

/**
 * Sprint F.1 + F.2 — SubscriptionRenewalProcessor.
 *
 * Procesa cada job encolado por `RenewalSchedulerService`:
 *   1. Carga sub + plan.
 *   2. Si la sub está dentro del periodo, genera un checkout y persiste
 *      `last_renewal_init_point` para que el frontend lo muestre.
 *   3. Si la sub ya pasó el periodo y aún no entró en gracia, abre la
 *      ventana de gracia (`grace_period_until = now + 7d`) y marca
 *      `pending_payment`.
 *   4. Si la sub está en gracia y ésta ya expiró, marca `suspended`
 *      (Sprint F.2 — antes era `canceled`; ahora `canceled` queda
 *      reservado para refunds o acción explícita del owner).
 *
 * Sprint F.2: emite eventos de dominio (`BILLING_EVENTS.*`) para que
 * `BillingNotificationsService` cree las notificaciones correspondientes.
 *
 * Es idempotente por job (jobId incluye `current_period_end`); si el webhook
 * de pago aprobado llega antes del próximo tick, `PaymentsService` ya
 * habrá movido la sub a un nuevo periodo y el siguiente scan generará otro job.
 */
@Processor('subscription-renewal')
@Injectable()
export class SubscriptionRenewalProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(SubscriptionRenewalProcessor.name);

  /** Días de gracia tras vencimiento antes de suspender. */
  private readonly GRACE_DAYS = 7;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly paymentsService: PaymentsService,
    @InjectQueue('subscription-renewal') private readonly renewalQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async onModuleDestroy() {
    if (this.renewalQueue) {
      await this.renewalQueue.close();
    }
  }

  async process(job: Job<{ subscriptionId: string }>): Promise<{
    status:
      | 'checkout_created'
      | 'grace_opened'
      | 'suspended'
      | 'canceled'
      | 'noop';
    initPoint?: string;
  }> {
    const { subscriptionId } = job.data;
    this.logger.log(`renewing sub=${subscriptionId} job=${job.id}`);

    const sub = await this.subRepo.findOne({ where: { id: subscriptionId } });
    if (!sub) {
      this.logger.warn(`sub=${subscriptionId} no existe — descartando job`);
      return { status: 'noop' };
    }

    if (sub.status === 'canceled') {
      this.logger.debug(`sub=${subscriptionId} ya cancelada — noop`);
      return { status: 'noop' };
    }

    const now = new Date();
    const periodEnded = sub.current_period_end.getTime() <= now.getTime();
    const inGrace = !!sub.grace_period_until;
    const graceExpired =
      inGrace && sub.grace_period_until!.getTime() <= now.getTime();

    const plan = await this.planRepo.findOne({ where: { id: sub.plan_id } });
    if (!plan) {
      this.logger.error(`sub=${subscriptionId} plan=${sub.plan_id} no existe`);
      throw new Error(`Plan ${sub.plan_id} not found`);
    }

    // REN-005 (F.2): si el periodo expiró y la gracia también → suspender.
    if (periodEnded && graceExpired && sub.status !== 'suspended') {
      sub.status = 'suspended';
      sub.suspended_at = now;
      await this.subRepo.save(sub);
      this.emit(BILLING_EVENTS.SUBSCRIPTION_SUSPENDED, {
        subscriptionId: sub.id,
        companyId: sub.company_id,
        planName: plan.name,
        meta: {
          suspendedAt: now.toISOString(),
          gracePeriodUntil: sub.grace_period_until!.toISOString(),
        },
      });
      this.logger.log(
        `sub=${subscriptionId} suspended (grace expired ${sub.grace_period_until!.toISOString()})`,
      );
      return { status: 'suspended' };
    }

    const wasInGrace = periodEnded && inGrace && !graceExpired;

    // REN-004: si el periodo ya venció y aún no abrimos gracia → abrirla.
    let openedGraceNow = false;
    if (periodEnded && !inGrace) {
      sub.grace_period_until = new Date(
        now.getTime() + this.GRACE_DAYS * 24 * 60 * 60 * 1000,
      );
      sub.status = 'pending_payment';
      openedGraceNow = true;
    }

    const amount = Number(plan.price ?? 0);
    if (amount <= 0) {
      // Plan gratuito: extender periodo automáticamente.
      const newStart = new Date(sub.current_period_end);
      const newEnd = new Date(newStart);
      newEnd.setMonth(newEnd.getMonth() + 1);
      sub.current_period_start = newStart;
      sub.current_period_end = newEnd;
      sub.status = 'active';
      sub.grace_period_until = null;
      sub.grace_warning_sent_at = null;
      sub.last_renewal_attempt_at = now;
      await this.subRepo.save(sub);
      this.logger.log(
        `sub=${subscriptionId} free plan auto-renovado hasta ${newEnd.toISOString()}`,
      );
      return { status: 'noop' };
    }

    // REN-006: generar checkout y persistir initPoint.
    try {
      const referrerDiscountPct = sub.pending_referral_discount_pct ?? 0;
      const effectiveAmount =
        referrerDiscountPct > 0
          ? Math.round(amount * (1 - referrerDiscountPct / 100))
          : amount;
      const itemTitle =
        referrerDiscountPct > 0
          ? `Renovación ${plan.name} (${referrerDiscountPct}% desc. referido)`
          : `Renovación ${plan.name}`;

      const checkout = await this.paymentsService.createCheckout({
        subscriptionId: sub.id,
        companyId: sub.company_id,
        amount: effectiveAmount,
        currency: 'CLP',
        itemTitle,
      });

      sub.last_renewal_init_point = checkout.initPoint;
      sub.last_renewal_attempt_at = now;
      await this.subRepo.save(sub);

      const status: 'grace_opened' | 'checkout_created' = openedGraceNow
        ? 'grace_opened'
        : 'checkout_created';

      if (openedGraceNow) {
        this.emit(BILLING_EVENTS.GRACE_STARTED, {
          subscriptionId: sub.id,
          companyId: sub.company_id,
          planName: plan.name,
          meta: {
            initPoint: checkout.initPoint,
            gracePeriodUntil: sub.grace_period_until!.toISOString(),
            currentPeriodEnd: sub.current_period_end.toISOString(),
          },
        });
      } else if (!wasInGrace) {
        // Renovación normal pre-vencimiento.
        this.emit(BILLING_EVENTS.RENEWAL_SCHEDULED, {
          subscriptionId: sub.id,
          companyId: sub.company_id,
          planName: plan.name,
          meta: {
            initPoint: checkout.initPoint,
            currentPeriodEnd: sub.current_period_end.toISOString(),
          },
        });
      }

      this.logger.log(
        `sub=${subscriptionId} checkout generado initPoint=${checkout.initPoint}`,
      );
      return { status, initPoint: checkout.initPoint };
    } catch (err) {
      sub.last_renewal_attempt_at = now;
      await this.subRepo.save(sub);
      this.emit(BILLING_EVENTS.RENEWAL_FAILED, {
        subscriptionId: sub.id,
        companyId: sub.company_id,
        planName: plan.name,
        meta: { error: (err as Error).message },
      });
      this.logger.error(
        `sub=${subscriptionId} checkout falló: ${(err as Error).message}`,
      );
      throw err; // BullMQ reintentará según el backoff configurado.
    }
  }

  /** Helper centralizado: emite un evento de dominio billing. */
  private emit(eventName: string, payload: BillingEventPayload): void {
    this.eventEmitter.emit(eventName, payload);
  }

  @OnQueueEvent('active')
  onActive({ jobId }: { jobId: string }) {
    this.logger.debug(`Job activo: ${jobId}`);
  }

  @OnQueueEvent('failed')
  onFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
    this.logger.warn(`Job fallido ${jobId}: ${failedReason}`);
  }
}
