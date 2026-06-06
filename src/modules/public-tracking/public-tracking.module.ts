import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from '../shipments/entities/shipment.entity';
import { TrackingPoint } from '../tracking/entities/tracking-point.entity';
import { PublicTrackingService } from './public-tracking.service';
import { PublicTrackingController } from './public-tracking.controller';
import { TrackingPageController } from './tracking-page.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shipment, TrackingPoint])],
  controllers: [PublicTrackingController, TrackingPageController],
  providers: [PublicTrackingService],
})
export class PublicTrackingModule {}
