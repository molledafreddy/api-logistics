import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { PushSenderService } from './push-sender.service';
import { WhatsAppService } from './whatsapp.service';
import { ProximityAlertService } from './proximity-alert.service';
import { Shipment } from '../shipments/entities/shipment.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, PushToken, Shipment]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FcmPushProvider,
    PushSenderService,
    WhatsAppService,
    ProximityAlertService,
  ],
  exports: [NotificationsService, PushSenderService, WhatsAppService],
})
export class NotificationsModule {}
