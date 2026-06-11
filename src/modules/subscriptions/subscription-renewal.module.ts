import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRedisConnection } from '../../config/redis-connection.helper';

import { PaymentsModule } from '../payments/payments.module';
import { Plan } from '../plans/entities/plan.entity';

import { Subscription } from './entities/subscription.entity';
import { SubscriptionAddon } from './entities/subscription-addon.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Coupon } from './entities/coupon.entity';
import { RenewalSchedulerService } from './renewal-scheduler.service';
import { SubscriptionRenewalProcessor } from './subscription-renewal.processor';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Sprint F.1 — SubscriptionRenewalModule.
 *
 * Compone:
 *   - BullMQ queue `subscription-renewal` (host Redis).
 *   - `RenewalSchedulerService` con cron horario que escanea subs próximas
 *     a vencer y encola jobs.
 *   - `SubscriptionRenewalProcessor` que consume jobs y orquesta cobros via
 *     `PaymentsService` (importado de `PaymentsModule`).
 *
 * Cuando `SKIP_BULL_SETUP=true` (generación de OpenAPI / unit tests), se
 * sustituye la queue por un mock no-op y el scheduler queda inerte.
 */
@Module({
  imports: [
    PaymentsModule,
    ...(process.env.SKIP_BULL_SETUP !== 'true'
      ? [
          BullModule.forRoot({
            connection: getRedisConnection(),
          }),
          BullModule.registerQueue({
            name: 'subscription-renewal',
          }),
        ]
      : []),
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionAddon,
      Invoice,
      InvoiceLineItem,
      PaymentEvent,
      Coupon,
      Plan,
    ]),
  ],
  providers: [
    SubscriptionRenewalProcessor,
    SubscriptionsService,
    ...(process.env.SKIP_BULL_SETUP !== 'true'
      ? [RenewalSchedulerService]
      : []),
    ...(process.env.SKIP_BULL_SETUP === 'true'
      ? [
          {
            provide: 'BullQueue_subscription-renewal',
            useValue: {
              add: async () => undefined,
              close: async () => undefined,
            },
          },
        ]
      : []),
  ],
  exports: [
    ...(process.env.SKIP_BULL_SETUP !== 'true'
      ? [BullModule.registerQueue({ name: 'subscription-renewal' })]
      : []),
  ],
})
export class SubscriptionRenewalModule {}
