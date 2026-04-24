import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { OnQueueEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Processor('subscription-renewal')
@Injectable()
export class SubscriptionRenewalProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  async onModuleDestroy() {
    if (this.renewalQueue) {
      await this.renewalQueue.close();
    }
  }
  private readonly logger = new Logger(SubscriptionRenewalProcessor.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectQueue('subscription-renewal') private readonly renewalQueue: Queue,
  ) {
    super();
  }

  // Procesa la renovación automática
  async process(job: Job) {
    const { subscriptionId } = job.data;
    this.logger.log(`Procesando renovación para suscripción ${subscriptionId}`);
    // Aquí iría la lógica real de renovación:
    // await this.subscriptionsService.renewSubscription(subscriptionId);
    // Simulación:
    await new Promise((res) => setTimeout(res, 500));
    this.logger.log(`Renovación completada para suscripción ${subscriptionId}`);
    return true;
  }

  @OnQueueEvent('active')
  onActive({ jobId }: { jobId: string }) {
    this.logger.debug(`Job activo: ${jobId}`);
  }
}
