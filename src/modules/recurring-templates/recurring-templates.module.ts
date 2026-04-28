import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { RecurringTemplate } from './entities/recurring-template.entity';
import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';

import { RecurringTemplatesService } from './recurring-templates.service';
import { RecurringTemplatesController } from './recurring-templates.controller';
import { RecurringGeneratorProcessor } from './recurring-templates.processor';
import { RecurringGeneratorScheduler } from './recurring-templates.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecurringTemplate,
      DeliveryRun,
      Shipment,
      Truck,
      Driver,
    ]),
    ...(process.env.SKIP_BULL_SETUP !== 'true'
      ? [BullModule.registerQueue({ name: 'recurring-generator' })]
      : []),
  ],
  controllers: [RecurringTemplatesController],
  providers: [
    RecurringTemplatesService,
    RecurringGeneratorProcessor,
    RecurringGeneratorScheduler,
    ...(process.env.SKIP_BULL_SETUP === 'true'
      ? [
          {
            provide: 'BullQueue_recurring-generator',
            useValue: {
              add: async () => undefined,
              close: async () => undefined,
            },
          },
        ]
      : []),
  ],
  exports: [RecurringTemplatesService],
})
export class RecurringTemplatesModule {}
