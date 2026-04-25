import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionAddon } from './entities/subscription-addon.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Coupon } from './entities/coupon.entity';
import { SubscriptionRenewalProcessor } from './subscription-renewal.processor';
import { SubscriptionsService } from './subscriptions.service';

const isOpenApiGen = process.env.OPENAPI_GEN === '1';

// In OPENAPI_GEN mode we MUST NOT instantiate BullMQ Queues — each opens 2
// eager Redis sockets (client + subscriber) ignoring `lazyConnect`, blocking
// NestFactory.create() forever. We provide a no-op stub for `@InjectQueue`.
const stubQueue = {
  add: async () => undefined,
  addBulk: async () => [],
  getJob: async () => null,
  close: async () => undefined,
};

@Module({
  imports: [
    ...(isOpenApiGen
      ? []
      : [
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
        ]),
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionAddon,
      Invoice,
      InvoiceLineItem,
      PaymentEvent,
      Coupon,
    ]),
  ],
  providers: isOpenApiGen
    ? [
        // SubscriptionsService is provided by SubscriptionsModule. Re-providing
        // it here causes Nest's DI graph to deadlock during NestFactory.create()
        // (silent hang with no active handles, no error). The only thing this
        // module must contribute in OPENAPI_GEN mode is the stub queue token.
        { provide: getQueueToken('subscription-renewal'), useValue: stubQueue },
      ]
    : [SubscriptionRenewalProcessor, SubscriptionsService],
  exports: isOpenApiGen
    ? [getQueueToken('subscription-renewal')]
    : [BullModule.registerQueue({ name: 'subscription-renewal' })],
})
export class SubscriptionRenewalModule {}
