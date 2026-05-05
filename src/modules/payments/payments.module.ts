import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Invoice } from '../subscriptions/entities/invoice.entity';
import { PaymentEvent } from '../subscriptions/entities/payment-event.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingNotificationsService } from './billing-notifications.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER_TOKEN } from './payments.types';
import { MockPaymentProvider } from './providers/mock.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';

/**
 * Sprint E + F.1 + F.2 — PaymentsModule.
 *
 * Selecciona el provider activo en bootstrap mediante `PAYMENTS_PROVIDER`:
 *   - 'mercadopago' → MercadoPagoProvider (requiere MERCADOPAGO_ACCESS_TOKEN)
 *   - 'mock'        → MockPaymentProvider (default, dev/test sin red)
 *
 * Sprint F.1: agrega `BillingController` para exponer estado de renovación
 * al frontend y `BillingService` que lee Subscription + Plan.
 *
 * Sprint F.2: agrega `BillingNotificationsService` (listener de eventos de
 * dominio billing → crea Notification para owners/admins) y endpoint
 * `POST /v1/billing/me/retry` para retry manual del cobro.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Subscription, Invoice, PaymentEvent, Plan, User]),
    NotificationsModule,
  ],
  controllers: [PaymentsController, BillingController],
  providers: [
    PaymentsService,
    BillingService,
    BillingNotificationsService,
    MockPaymentProvider,
    MercadoPagoProvider,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, MockPaymentProvider, MercadoPagoProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
        mp: MercadoPagoProvider,
      ) => {
        const name = (
          config.get<string>('PAYMENTS_PROVIDER') ?? 'mock'
        ).toLowerCase();
        return name === 'mercadopago' ? mp : mock;
      },
    },
  ],
  exports: [PaymentsService, BillingService, PAYMENT_PROVIDER_TOKEN],
})
export class PaymentsModule {}
