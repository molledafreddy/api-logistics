import { Processor, WorkerHost, OnQueueEvent } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { PaymentsService } from '../payments/payments.service';
import { Subscription } from './entities/subscription.entity';

@Processor('subscription-renewal')
@Injectable()
export class SubscriptionRenewalProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(SubscriptionRenewalProcessor.name);
  private readonly GRACE_DAYS = 7;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly paymentsService: PaymentsService,
    @InjectQueue('subscription-renewal') private readonly renewalQueue: Queue,
  ) {
    super();
  }

  async onModuleDestroy() {
    if (this.renewalQueue) {
      await this.renewalQueue.close();
    }
  }

  async process(job: Job<{ subscriptionId: string }>): Promise<{
    status: 'checkout_created' | 'grace_opened' | 'canceled' | 'noop';
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

    if (periodEnded && graceExpired) {
      sub.status = 'canceled';
      sub.canceled_at = now;
      await this.subRepo.save(sub);
      this.logger.log(
        `sub=${subscriptionId} canceled (grace expired ${sub.grace_period_until!.toISOString()})`,
      );
      return { status: 'canceled' };
    }

    if (periodEnded && !inGrace) {
      sub.grace_period_until = new Date(
        now.getTime() + this.GRACE_DAYS * 24 * 60 * 60 * 1000,
      );
      sub.status = 'pending_payment';
    }

    const plan = await this.planRepo.findOne({ where: { id: sub.plan_id } });
    if (!plan) {
      this.logger.error(`sub=${subscriptionId} plan=${sub.plan_id} no existe`);
      throw new Error(`Plan ${sub.plan_id} not found`);
    }
    const amount = Number(plan.price ?? 0);
    if (amount <= 0) {
      const newStart = new Date(sub.current_period_end);
      const newEnd = new Date(newStart);
      newEnd.setMonth(newEnd.getMonth() + 1);
      sub.current_period_start = newStart;
      sub.current_period_end = newEnd;
      sub.status = 'active';
      sub.grace_period_until = null;
      sub.last_renewal_attempt_at = now;
      await this.subRepo.save(sub);
      this.logger.log(
        `sub=${subscriptionId} free plan auto-renovado hasta ${newEnd.toISOString()}`,
      );
      return { status: 'noop' };
    }

    try {
      const checkout = await this.paymentsService.createCheckout({
        subscriptionId: sub.id,
        companyId: sub.company_id,
        amount,
        currency: 'CLP',
        itemTitle: `Renovación ${plan.name}`,
      });

      sub.last_renewal_init_point = checkout.initPoint;
      sub.last_renewal_attempt_at = now;
      await this.subRepo.save(sub);

      this.logger.log(
        `sub=${subscriptionId} checkout generado initPoint=${checkout.initPoint}`,
      );
      return {
        status: periodEnded ? 'grace_opened' : 'checkout_created',
        initPoint: checkout.initPoint,
      };
    } catch (err) {
      sub.last_renewal_attempt_at = now;
      await this.subRepo.save(sub);
      this.logger.error(
        `sub=${subscriptionId} checkout falló: ${(err as Error).message}`,
      );
      throw err;
    }
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
