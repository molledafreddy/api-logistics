import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';

import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Invoice } from '../subscriptions/entities/invoice.entity';
import { PaymentEvent } from '../subscriptions/entities/payment-event.entity';
import { Plan } from '../plans/entities/plan.entity';
import { BILLING_EVENTS } from '../subscriptions/billing-events';

import {
  CheckoutInput,
  CheckoutResult,
  IPaymentProvider,
  NormalizedPaymentEvent,
  PAYMENT_PROVIDER_TOKEN,
} from './payments.types';

/**
 * Sprint E — Orquesta el flujo de pagos.
 *
 * Reglas:
 *   PAY-001  Webhook sin firma válida → manejado en el controller (401).
 *   PAY-002  Idempotencia: si ya existe un PaymentEvent con el mismo
 *            (provider, externalId), devolvemos no-op.
 *   PAY-003  payment.approved → invoice.status='paid', subscription.status='active'.
 *   PAY-004  payment.rejected/cancelled → invoice.status='void',
 *            subscription.status='pending_payment' (preserva ventana de gracia).
 *   PAY-005  payment.refunded → invoice.status='refunded',
 *            subscription.status='canceled'.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly provider: IPaymentProvider,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(PaymentEvent)
    private readonly eventRepo: Repository<PaymentEvent>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Public API ────────────────────────────

  /** Crea un checkout para una subscription existente y persiste el `external_reference`. */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const sub = await this.subRepo.findOne({
      where: { id: input.subscriptionId },
    });
    if (!sub) {
      throw new NotFoundException(
        `Subscription ${input.subscriptionId} not found`,
      );
    }

    const result = await this.provider.createCheckout(input);

    // Persistimos el external_reference y marcamos provider en la subscription.
    sub.provider = this.provider.providerName;
    sub.external_reference = result.externalReference;
    sub.provider_subscription_id = result.providerCheckoutId;
    await this.subRepo.save(sub);

    this.logger.log(
      `checkout sub=${sub.id} provider=${this.provider.providerName} ref=${result.externalReference}`,
    );
    return result;
  }

  /**
   * Procesa un webhook ya verificado (firma OK).
   * Devuelve `{ idempotent: true }` si era duplicado.
   */
  async processWebhook(
    payload: unknown,
  ): Promise<{ idempotent: boolean; type: string; externalId: string }> {
    const evt = await this.provider.resolveWebhookEvent(payload);

    // PAY-002: idempotencia
    const existing = await this.eventRepo.findOne({
      where: {
        provider: this.provider.providerName,
        external_id: evt.externalId,
      },
    });
    if (existing) {
      this.logger.debug(
        `webhook duplicado [${evt.type} ${evt.externalId}] → no-op`,
      );
      return { idempotent: true, type: evt.type, externalId: evt.externalId };
    }

    // Localizar subscription por external_reference
    const sub = evt.externalReference
      ? await this.subRepo.findOne({
          where: { external_reference: evt.externalReference },
        })
      : null;

    if (!sub && evt.type !== 'unknown') {
      this.logger.warn(
        `webhook ${evt.type} ${evt.externalId} sin subscription (ref=${evt.externalReference}) — registrando evento huérfano`,
      );
    }

    // Persistir el evento (idempotencia futura). subscription_id queda NULL
    // si el evento es huérfano (sin sub matching) — auditoría y dedupe siguen.
    await this.eventRepo.save(
      this.eventRepo.create({
        subscription_id: sub?.id ?? null,
        event_type: evt.type,
        amount: evt.amount,
        event_date: new Date(),
        provider: this.provider.providerName,
        external_id: evt.externalId,
        metadata: this.safeMeta(evt),
      }),
    );

    if (sub) {
      await this.applyEventToSubscription(sub, evt);
    }

    return { idempotent: false, type: evt.type, externalId: evt.externalId };
  }

  // ─── Helpers ───────────────────────────────

  private async applyEventToSubscription(
    sub: Subscription,
    evt: NormalizedPaymentEvent,
  ): Promise<void> {
    switch (evt.type) {
      case 'payment.approved': {
        // PAY-003 + Sprint F.2: si la sub venía de pending_payment o suspended,
        // reactivamos completamente: extender período, cerrar gracia, limpiar
        // init_point y emitir evento de reactivación.
        const wasInactive =
          sub.status === 'pending_payment' || sub.status === 'suspended';
        const now = new Date();

        if (wasInactive) {
          // Extender período: nuevo inicio = max(current_period_end, now); +1 mes.
          const newStart =
            sub.current_period_end.getTime() > now.getTime()
              ? new Date(sub.current_period_end)
              : now;
          const newEnd = new Date(newStart);
          newEnd.setMonth(newEnd.getMonth() + 1);
          sub.current_period_start = newStart;
          sub.current_period_end = newEnd;
          sub.reactivated_at = now;
        }

        sub.status = 'active';
        sub.grace_period_until = null;
        sub.grace_warning_sent_at = null;
        sub.last_renewal_init_point = null;
        await this.subRepo.save(sub);
        await this.invoiceRepo.save(
          this.invoiceRepo.create({
            subscription_id: sub.id,
            amount_due: evt.amount ?? 0,
            amount_paid: evt.amount ?? 0,
            status: 'paid',
            due_date: new Date(),
            paid_at: new Date(),
          }),
        );

        if (wasInactive) {
          // Resolver nombre del plan para enriquecer la notificación.
          const plan = await this.planRepo.findOne({
            where: { id: sub.plan_id },
          });
          this.eventEmitter.emit(BILLING_EVENTS.SUBSCRIPTION_REACTIVATED, {
            subscriptionId: sub.id,
            companyId: sub.company_id,
            planName: plan?.name ?? 'tu plan',
            meta: {
              reactivatedAt: now.toISOString(),
              currentPeriodEnd: sub.current_period_end.toISOString(),
            },
          });
        }
        break;
      }
      case 'payment.rejected':
      case 'payment.cancelled': {
        // PAY-004
        sub.status = 'pending_payment';
        await this.subRepo.save(sub);
        await this.invoiceRepo.save(
          this.invoiceRepo.create({
            subscription_id: sub.id,
            amount_due: evt.amount ?? 0,
            amount_paid: 0,
            status: 'void',
            due_date: new Date(),
          }),
        );
        break;
      }
      case 'payment.refunded': {
        // PAY-005
        sub.status = 'canceled';
        sub.canceled_at = new Date();
        await this.subRepo.save(sub);
        await this.invoiceRepo.save(
          this.invoiceRepo.create({
            subscription_id: sub.id,
            amount_due: evt.amount ?? 0,
            amount_paid: 0,
            status: 'refunded',
            due_date: new Date(),
          }),
        );
        break;
      }
      case 'payment.pending':
        // No-op — se actualizará cuando llegue approved/rejected
        break;
      case 'unknown':
      default:
        this.logger.warn(
          `evento ${evt.type} sin acción (sub=${sub.id} ext=${evt.externalId})`,
        );
    }
  }

  private safeMeta(evt: NormalizedPaymentEvent): Record<string, unknown> {
    return {
      providerCheckoutId: evt.providerCheckoutId,
      externalReference: evt.externalReference,
      currency: evt.currency,
    };
  }
}
