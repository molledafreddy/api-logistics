import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionAddon } from './entities/subscription-addon.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Coupon } from './entities/coupon.entity';
import { SubscriptionRenewalProcessor } from './subscription-renewal.processor';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    }),
    BullModule.registerQueue({
      name: 'subscription-renewal',
    }),
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionAddon,
      Invoice,
      InvoiceLineItem,
      PaymentEvent,
      Coupon,
    ]),
  ],
  providers: [SubscriptionRenewalProcessor, SubscriptionsService],
  exports: [BullModule.registerQueue({ name: 'subscription-renewal' })],
})
export class SubscriptionRenewalModule {}
