import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushToken } from './entities/push-token.entity';
import { Notification } from './entities/notification.entity';
import { FcmPushProvider } from './providers/fcm-push.provider';

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly fcmProvider: FcmPushProvider,
  ) {}

  async sendPushToUser(
    userId: string,
    notification: Notification,
  ): Promise<void> {
    const tokens = await this.pushTokenRepo.find({
      where: { userId, isActive: true },
    });
    if (!tokens.length) {
      this.logger.warn(`No push tokens for user ${userId}`);
      return;
    }

    const payload = {
      notification: {
        title: notification.title,
        body: notification.body || undefined,
      },
      data: {
        notificationId: notification.id,
        ...Object.fromEntries(
          Object.entries(notification.data ?? {}).map(([k, v]) => [
            k,
            String(v),
          ]),
        ),
      },
    };

    let pushed = false;
    let lastError: string | null = null;

    for (const token of tokens) {
      try {
        await this.fcmProvider.sendPush(token.token, payload);
        pushed = true;
      } catch (err) {
        lastError = (err as Error)?.message ?? String(err);
        this.logger.error(`Error enviando push a ${token.token}: ${lastError}`);
      }
    }

    await this.notifRepo.update(notification.id, {
      pushSent: pushed,
      pushSentAt: pushed ? new Date() : null,
      pushError: pushed ? null : lastError,
    });
  }
}
