import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PaymentsService } from './payments.service';

export interface MyRenewalView {
  subscriptionId: string;
  status: string;
  planId: string;
  planName: string;
  amount: number;
  currency: 'CLP';
  currentPeriodEnd: string;
  gracePeriodUntil: string | null;
  lastRenewalAttemptAt: string | null;
  /** URL del checkout pendiente (si el scheduler ya generó uno). */
  initPoint: string | null;
}

export interface RetryRenewalResult {
  subscriptionId: string;
  initPoint: string;
  expiresInSec: number;
}

/**
 * Sprint F.1 — BillingService.
 *
 * Expone al frontend el estado de la próxima renovación de la suscripción
 * activa de la company del usuario, incluido el `init_point` del checkout
 * pendiente si el scheduler ya lo generó.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  /** Sprint F.2 — throttle de retry manual (5 min). */
  private readonly RETRY_THROTTLE_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly paymentsService: PaymentsService,
  ) {}

  async getMyRenewal(companyId: string): Promise<MyRenewalView> {
    const sub = await this.subRepo.findOne({
      where: {
        company_id: companyId,
        status: In(['active', 'pending_payment', 'suspended']),
      },
      order: { current_period_end: 'DESC' },
    });
    if (!sub) {
      throw new NotFoundException(
        `No active subscription for company ${companyId}`,
      );
    }

    const plan = await this.planRepo.findOne({ where: { id: sub.plan_id } });
    if (!plan) {
      throw new NotFoundException(`Plan ${sub.plan_id} not found`);
    }

    return {
      subscriptionId: sub.id,
      status: sub.status,
      planId: plan.id,
      planName: plan.name,
      amount: Number(plan.price),
      currency: 'CLP',
      currentPeriodEnd: sub.current_period_end.toISOString(),
      gracePeriodUntil: sub.grace_period_until
        ? sub.grace_period_until.toISOString()
        : null,
      lastRenewalAttemptAt: sub.last_renewal_attempt_at
        ? sub.last_renewal_attempt_at.toISOString()
        : null,
      initPoint: sub.last_renewal_init_point ?? null,
    };
  }

  /**
   * Sprint F.2 — retry manual.
   *
   * El usuario fuerza la generación de un nuevo checkout sin esperar al cron.
   * Solo aplicable a subs en `pending_payment` o `suspended`.
   * Throttle: 5 minutos entre intentos para no abusar del provider.
   */
  async retry(companyId: string): Promise<RetryRenewalResult> {
    const sub = await this.subRepo.findOne({
      where: {
        company_id: companyId,
        status: In(['pending_payment', 'suspended']),
      },
      order: { current_period_end: 'DESC' },
    });
    if (!sub) {
      throw new NotFoundException(
        `No retriable subscription for company ${companyId}`,
      );
    }

    if (sub.last_renewal_attempt_at) {
      const elapsed = Date.now() - sub.last_renewal_attempt_at.getTime();
      if (elapsed < this.RETRY_THROTTLE_MS) {
        const waitSec = Math.ceil((this.RETRY_THROTTLE_MS - elapsed) / 1000);
        throw new BadRequestException(
          `Retry too soon. Try again in ${waitSec}s`,
        );
      }
    }

    const plan = await this.planRepo.findOne({ where: { id: sub.plan_id } });
    if (!plan) {
      throw new NotFoundException(`Plan ${sub.plan_id} not found`);
    }
    const amount = Number(plan.price ?? 0);
    if (amount <= 0) {
      throw new BadRequestException('Free plans cannot be retried');
    }

    const checkout = await this.paymentsService.createCheckout({
      subscriptionId: sub.id,
      companyId: sub.company_id,
      amount,
      currency: 'CLP',
      itemTitle: `Renovación ${plan.name}`,
    });

    sub.last_renewal_init_point = checkout.initPoint;
    sub.last_renewal_attempt_at = new Date();
    await this.subRepo.save(sub);

    this.logger.log(
      `manual retry sub=${sub.id} initPoint=${checkout.initPoint}`,
    );

    return {
      subscriptionId: sub.id,
      initPoint: checkout.initPoint,
      expiresInSec: this.RETRY_THROTTLE_MS / 1000,
    };
  }
}
