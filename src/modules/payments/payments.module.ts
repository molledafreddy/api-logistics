import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Invoice } from '../subscriptions/entities/invoice.entity';
import { PaymentEvent } from '../subscriptions/entities/payment-event.entity';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER_TOKEN } from './payments.types';
import { MockPaymentProvider } from './providers/mock.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Subscription, Invoice, PaymentEvent, Plan]),
  ],
  controllers: [PaymentsController, BillingController],
  providers: [
    PaymentsService,
    BillingService,
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
