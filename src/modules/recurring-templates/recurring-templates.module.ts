import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bullmq';

import { RecurringTemplate } from './entities/recurring-template.entity';
import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';

import { RecurringTemplatesService } from './recurring-templates.service';
import { RecurringTemplatesController } from './recurring-templates.controller';
import { RecurringGeneratorProcessor } from './recurring-templates.processor';
import { RecurringGeneratorScheduler } from './recurring-templates.scheduler';

const isOpenApiGen = process.env.OPENAPI_GEN === '1';

// In OPENAPI_GEN mode, avoid instantiating the BullMQ Queue (it eagerly opens
// 2 Redis sockets that block NestFactory.create). RecurringTemplatesService
// does not @InjectQueue, but the Scheduler does — and we already skip the
// Scheduler/Processor in this mode.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecurringTemplate,
      DeliveryRun,
      Shipment,
      Truck,
      Driver,
    ]),
    ...(isOpenApiGen
      ? []
      : [BullModule.registerQueue({ name: 'recurring-generator' })]),
  ],
  controllers: [RecurringTemplatesController],
  providers: isOpenApiGen
    ? [
        RecurringTemplatesService,
        // Stub for any @InjectQueue still resolved in this module's providers
        {
          provide: getQueueToken('recurring-generator'),
          useValue: { add: async () => undefined },
        },
      ]
    : [
        RecurringTemplatesService,
        RecurringGeneratorProcessor,
        RecurringGeneratorScheduler,
      ],
  exports: [RecurringTemplatesService],
})
export class RecurringTemplatesModule {}
