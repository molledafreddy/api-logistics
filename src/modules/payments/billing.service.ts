import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

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

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async getMyRenewal(companyId: string): Promise<MyRenewalView> {
    const sub = await this.subRepo.findOne({
      where: {
        company_id: companyId,
        status: In(['active', 'pending_payment']),
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
}
