import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../drivers/entities/driver.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import {
  INTERNAL_EVENTS,
  type DeliveryRunAssignedPayload,
} from '../../gateways/events/internal.events';

@Injectable()
export class DeliveryRunNotificationListener {
  private readonly logger = new Logger(DeliveryRunNotificationListener.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(INTERNAL_EVENTS.DELIVERY_RUN_ASSIGNED, { async: true })
  async handle(payload: DeliveryRunAssignedPayload): Promise<void> {
    try {
      const driver = await this.driverRepo.findOne({
        where: { id: payload.driverId },
        select: ['userId'],
      });

      if (!driver?.userId) return;

      await this.notificationsService.create({
        userId: driver.userId,
        type: NotificationType.RUN_ASSIGNED,
        title: 'Nueva ruta asignada',
        body: `Tienes una ruta programada para el ${payload.scheduledDate}`,
        data: {
          type: 'run_assigned',
          runId: payload.runId,
          scheduledDate: payload.scheduledDate,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify driver ${payload.driverId} for run ${payload.runId}: ${(err as Error).message}`,
      );
    }
  }
}
