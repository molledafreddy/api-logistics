import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }) {
    const notif = this.notifRepo.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body || null,
      data: data.data || {},
    });
    const saved = await this.notifRepo.save(notif);
    // Notifica vía WebSocket de manera best-effort
    this.eventEmitter.emit(INTERNAL_EVENTS.NOTIFICATION_CREATED, saved);
    return saved;
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async markAsRead(id: string) {
    await this.notifRepo.update(id, { readAt: new Date() });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.notifRepo
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('user_id = :userId AND read_at IS NULL', { userId })
      .execute();
    return { success: true };
  }

  async registerPushToken(
    userId: string,
    token: string,
    platform: string,
    deviceName?: string,
  ) {
    const existing = await this.pushTokenRepo.findOneBy({ userId, token });
    if (existing) return existing;
    return this.pushTokenRepo.save(
      this.pushTokenRepo.create({
        userId,
        token,
        platform,
        deviceName: deviceName || null,
      }),
    );
  }

  async removePushToken(userId: string, token: string) {
    await this.pushTokenRepo.update({ userId, token }, { isActive: false });
    return { success: true };
  }
}
