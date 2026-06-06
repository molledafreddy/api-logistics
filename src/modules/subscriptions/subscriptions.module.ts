import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionAddon } from './entities/subscription-addon.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Coupon } from './entities/coupon.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionRenewalModule } from './subscription-renewal.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionAddon,
      Invoice,
      InvoiceLineItem,
      PaymentEvent,
      Coupon,
    ]),
    SubscriptionRenewalModule,
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
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
  exports: [TypeOrmModule],
})
export class SubscriptionsModule {}
