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

// BullMQ requires Redis — skip when not available or explicitly disabled
const useBull =
  process.env.SKIP_BULL_SETUP !== 'true' && !!process.env.REDIS_URL;

@Module({
  imports: [
    PaymentsModule,
    ...(useBull
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
    ...(useBull ? [RenewalSchedulerService] : []),
    ...(!useBull
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
    ...(useBull
      ? [BullModule.registerQueue({ name: 'subscription-renewal' })]
      : ['BullQueue_subscription-renewal']),
  ],
})
export class SubscriptionRenewalModule {}
