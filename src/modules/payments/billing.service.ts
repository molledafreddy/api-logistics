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
import { PaymentEvent } from '../subscriptions/entities/payment-event.entity';
import { PaymentsService } from './payments.service';

export interface PaymentHistoryItem {
  id: string;
  eventType: string;
  amount: number | null;
  currency: 'CLP';
  provider: string | null;
  externalId: string | null;
  eventDate: string;
  createdAt: string;
}

export interface LastPaymentEventView {
  eventId: string;
  status: 'success' | 'failure' | 'pending' | 'unknown';
  eventType: string;
  amount: number | null;
  currency: 'CLP';
  eventDate: string;
  /** Edad del evento en segundos, para que el cliente filtre eventos viejos. */
  ageSec: number;
}

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
  sandboxInitPoint?: string;
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
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepo: Repository<PaymentEvent>,
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
    sub.last_renewal_attempt_at = new Date();
    await this.subRepo.save(sub);

    this.logger.log(
      `manual retry sub=${sub.id} initPoint=${checkout.initPoint}`,
    );

    return {
      subscriptionId: sub.id,
      initPoint: checkout.initPoint,
      sandboxInitPoint: checkout.sandboxInitPoint,
      expiresInSec: this.RETRY_THROTTLE_MS / 1000,
    };
  }

  /** Historial de eventos de pago para la company del usuario. */
  async getMyHistory(companyId: string): Promise<PaymentHistoryItem[]> {
    const sub = await this.subRepo.findOne({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      select: ['id'],
    });
    if (!sub) return [];

    const events = await this.paymentEventRepo.find({
      where: { subscription_id: sub.id },
      order: { event_date: 'DESC' },
      take: 50,
    });

    return events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      amount: e.amount ?? null,
      currency: 'CLP',
      provider: e.provider ?? null,
      externalId: e.external_id ?? null,
      eventDate: e.event_date.toISOString(),
      createdAt: e.created_at.toISOString(),
    }));
  }

  /**
   * Sprint G (Security) — Último evento de pago verificado por webhook.
   *
   * Fuente de verdad para que el cliente móvil pueda mostrar feedback
   * post-pago sin confiar en el query string del deep link (spoofeable).
   * El cliente recibe `logistics://payment/*` como TRIGGER y luego consulta
   * este endpoint para conocer el estado REAL del último PaymentEvent.
   *
   * Devuelve `null` si no hay eventos o si el más reciente está fuera del
   * timeframe relevante (24h por defecto).
   */
  async getMyLastPaymentEvent(
    companyId: string,
    options: { withinHours?: number } = {},
  ): Promise<LastPaymentEventView | null> {
    const sub = await this.subRepo.findOne({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      select: ['id'],
    });
    if (!sub) return null;

    const event = await this.paymentEventRepo.findOne({
      where: { subscription_id: sub.id },
      order: { event_date: 'DESC' },
    });
    if (!event) return null;

    const windowMs = (options.withinHours ?? 24) * 60 * 60 * 1000;
    const ageMs = Date.now() - event.event_date.getTime();
    if (ageMs > windowMs) return null;

    let status: 'success' | 'failure' | 'pending' | 'unknown';
    switch (event.event_type) {
      case 'payment.approved':
        status = 'success';
        break;
      case 'payment.rejected':
      case 'payment.cancelled':
      case 'payment.refunded':
        status = 'failure';
        break;
      case 'payment.pending':
      case 'payment.in_process':
        status = 'pending';
        break;
      default:
        status = 'unknown';
    }

    return {
      eventId: event.id,
      status,
      eventType: event.event_type,
      amount: event.amount ?? null,
      currency: 'CLP',
      eventDate: event.event_date.toISOString(),
      ageSec: Math.floor(ageMs / 1000),
    };
  }
}
