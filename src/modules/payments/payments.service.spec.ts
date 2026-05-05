import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentsService } from './payments.service';
import { IPaymentProvider, NormalizedPaymentEvent } from './payments.types';
import { BILLING_EVENTS } from '../subscriptions/billing-events';
import type { Subscription } from '../subscriptions/entities/subscription.entity';
import type { Invoice } from '../subscriptions/entities/invoice.entity';
import type { PaymentEvent } from '../subscriptions/entities/payment-event.entity';
import type { Plan } from '../plans/entities/plan.entity';

function repoMock<T extends object>() {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (x: T) => x),
    create: jest.fn((x: Partial<T>) => x as T),
  } as unknown as jest.Mocked<Repository<T>>;
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    company_id: 'co-1',
    plan_id: 'plan-1',
    status: 'pending_payment',
    start_date: new Date(),
    end_date: new Date(),
    auto_renew: false,
    provider: 'mercadopago',
    external_reference: 'mp-sub-1-abc',
    ...overrides,
  } as unknown as Subscription;
}

describe('PaymentsService', () => {
  let provider: jest.Mocked<IPaymentProvider>;
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let invoiceRepo: jest.Mocked<Repository<Invoice>>;
  let eventRepo: jest.Mocked<Repository<PaymentEvent>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let svc: PaymentsService;

  beforeEach(() => {
    provider = {
      providerName: 'mercadopago',
      createCheckout: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      resolveWebhookEvent: jest.fn(),
    } as unknown as jest.Mocked<IPaymentProvider>;
    subRepo = repoMock<Subscription>();
    invoiceRepo = repoMock<Invoice>();
    eventRepo = repoMock<PaymentEvent>();
    planRepo = repoMock<Plan>();
    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;
    svc = new PaymentsService(
      provider,
      subRepo,
      invoiceRepo,
      eventRepo,
      planRepo,
      eventEmitter,
    );
  });

  describe('createCheckout', () => {
    it('lanza NotFound si la subscription no existe', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.createCheckout({
          subscriptionId: 'no',
          companyId: 'co',
          amount: 100,
          currency: 'CLP',
          itemTitle: 't',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('persiste provider/external_reference/provider_subscription_id', async () => {
      const sub = makeSub({ provider: 'free', external_reference: undefined });
      subRepo.findOne.mockResolvedValue(sub);
      provider.createCheckout.mockResolvedValue({
        initPoint: 'http://x',
        providerCheckoutId: 'pref_1',
        externalReference: 'mp-sub-1-xyz',
      });

      await svc.createCheckout({
        subscriptionId: 'sub-1',
        companyId: 'co-1',
        amount: 9900,
        currency: 'CLP',
        itemTitle: 'Pro',
      });

      expect(sub.provider).toBe('mercadopago');
      expect(sub.external_reference).toBe('mp-sub-1-xyz');
      expect(sub.provider_subscription_id).toBe('pref_1');
      expect(subRepo.save).toHaveBeenCalledWith(sub);
    });
  });

  describe('processWebhook (PAY-002 idempotencia)', () => {
    it('si ya existe el evento → no-op idempotent=true', async () => {
      const evt: NormalizedPaymentEvent = {
        type: 'payment.approved',
        externalId: 'pay-1',
        externalReference: 'mp-sub-1-abc',
        amount: 9900,
        raw: {},
      };
      provider.resolveWebhookEvent.mockResolvedValue(evt);
      eventRepo.findOne.mockResolvedValue({ id: 'e1' } as PaymentEvent);

      const res = await svc.processWebhook({});
      expect(res.idempotent).toBe(true);
      expect(eventRepo.save).not.toHaveBeenCalled();
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook (PAY-003 approved)', () => {
    it('aprueba sub + crea invoice paid', async () => {
      const sub = makeSub({ status: 'active' });
      provider.resolveWebhookEvent.mockResolvedValue({
        type: 'payment.approved',
        externalId: 'pay-9',
        externalReference: sub.external_reference ?? undefined,
        amount: 9900,
        raw: {},
      });
      eventRepo.findOne.mockResolvedValue(null);
      subRepo.findOne.mockResolvedValue(sub);

      const res = await svc.processWebhook({});
      expect(res.idempotent).toBe(false);
      expect(sub.status).toBe('active');
      expect(subRepo.save).toHaveBeenCalledWith(sub);
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_id: 'sub-1',
          amount_paid: 9900,
          status: 'paid',
        }),
      );
      expect(eventRepo.save).toHaveBeenCalled();
      // Sub ya estaba active → no reactivación → no evento
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('Sprint F.2: reactiva desde pending_payment (extiende periodo, cierra gracia, emite evento)', async () => {
      const periodEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // venció hace 2d
      const sub = makeSub({
        status: 'pending_payment',
        current_period_end: periodEnd,
        grace_period_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        last_renewal_init_point: 'https://mp/old',
      });
      provider.resolveWebhookEvent.mockResolvedValue({
        type: 'payment.approved',
        externalId: 'pay-react',
        externalReference: sub.external_reference ?? undefined,
        amount: 9900,
        raw: {},
      });
      eventRepo.findOne.mockResolvedValue(null);
      subRepo.findOne.mockResolvedValue(sub);
      planRepo.findOne.mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
      } as Plan);

      await svc.processWebhook({});

      expect(sub.status).toBe('active');
      expect(sub.grace_period_until).toBeNull();
      expect(sub.last_renewal_init_point).toBeNull();
      expect(sub.reactivated_at).toBeInstanceOf(Date);
      // Período extendido +1 mes desde now (porque current_period_end ya pasó)
      expect(sub.current_period_end.getTime()).toBeGreaterThan(
        periodEnd.getTime(),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        BILLING_EVENTS.SUBSCRIPTION_REACTIVATED,
        expect.objectContaining({
          subscriptionId: 'sub-1',
          planName: 'Pro',
        }),
      );
    });

    it('Sprint F.2: reactiva desde suspended', async () => {
      const sub = makeSub({
        status: 'suspended',
        current_period_end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        suspended_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
      provider.resolveWebhookEvent.mockResolvedValue({
        type: 'payment.approved',
        externalId: 'pay-react-2',
        externalReference: sub.external_reference ?? undefined,
        amount: 9900,
        raw: {},
      });
      eventRepo.findOne.mockResolvedValue(null);
      subRepo.findOne.mockResolvedValue(sub);
      planRepo.findOne.mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
      } as Plan);

      await svc.processWebhook({});

      expect(sub.status).toBe('active');
      expect(sub.reactivated_at).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        BILLING_EVENTS.SUBSCRIPTION_REACTIVATED,
        expect.any(Object),
      );
    });
  });

  describe('processWebhook (PAY-004 rejected/cancelled)', () => {
    it.each(['payment.rejected', 'payment.cancelled'] as const)(
      '%s → sub pending_payment + invoice void',
      async (type) => {
        const sub = makeSub({ status: 'active' });
        provider.resolveWebhookEvent.mockResolvedValue({
          type,
          externalId: `pay-${type}`,
          externalReference: sub.external_reference ?? undefined,
          amount: 9900,
          raw: {},
        });
        eventRepo.findOne.mockResolvedValue(null);
        subRepo.findOne.mockResolvedValue(sub);

        await svc.processWebhook({});
        expect(sub.status).toBe('pending_payment');
        expect(invoiceRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'void', amount_paid: 0 }),
        );
      },
    );
  });

  describe('processWebhook (PAY-005 refunded)', () => {
    it('refunded → sub canceled + invoice refunded', async () => {
      const sub = makeSub({ status: 'active' });
      provider.resolveWebhookEvent.mockResolvedValue({
        type: 'payment.refunded',
        externalId: 'pay-r',
        externalReference: sub.external_reference ?? undefined,
        amount: 9900,
        raw: {},
      });
      eventRepo.findOne.mockResolvedValue(null);
      subRepo.findOne.mockResolvedValue(sub);

      await svc.processWebhook({});
      expect(sub.status).toBe('canceled');
      expect(sub.canceled_at).toBeInstanceOf(Date);
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'refunded' }),
      );
    });
  });

  describe('processWebhook (huérfano)', () => {
    it('aproved sin subscription → registra evento, no toca invoices', async () => {
      provider.resolveWebhookEvent.mockResolvedValue({
        type: 'payment.approved',
        externalId: 'pay-orphan',
        externalReference: 'mp-no-existe',
        amount: 100,
        raw: {},
      });
      eventRepo.findOne.mockResolvedValue(null);
      subRepo.findOne.mockResolvedValue(null);

      const res = await svc.processWebhook({});
      expect(res.idempotent).toBe(false);
      expect(eventRepo.save).toHaveBeenCalled();
      expect(invoiceRepo.create).not.toHaveBeenCalled();
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });
});
