import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryRun } from './entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { CompanyRelationship } from '../relationships/entities/company-relationship.entity';

import { DeliveryRunsService } from './delivery-runs.service';
import { DeliveryRunsController } from './delivery-runs.controller';
import { VerificationsModule } from '../verifications/verifications.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryRun,
      Shipment,
      Truck,
      Driver,
      CompanyRelationship,
    ]),
    VerificationsModule,
    NotificationsModule,
  ],
  controllers: [DeliveryRunsController],
  providers: [DeliveryRunsService],
  exports: [DeliveryRunsService],
})
export class DeliveryRunsModule {}
