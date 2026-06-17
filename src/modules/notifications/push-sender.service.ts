import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushToken } from './entities/push-token.entity';
import { Notification } from './entities/notification.entity';
import { PushProvider } from './providers/push-provider.abstract';

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
    private readonly pushProvider: PushProvider,
  ) {}

  async sendPushToUser(
    userId: string,
    notification: Pick<Notification, 'id' | 'title' | 'body' | 'data'>,
  ): Promise<{ pushed: boolean; error: string | null }> {
    const tokens = await this.pushTokenRepo.find({
      where: { userId, isActive: true },
    });

    if (!tokens.length) {
      this.logger.warn(`No push tokens for user ${userId}`);
      return { pushed: false, error: 'No active tokens' };
    }

    const payload = {
      title: notification.title,
      body: notification.body ?? undefined,
      data: this.buildPushData(notification.id, notification.data),
    };

    let pushed = false;
    let lastError: string | null = null;

    for (const token of tokens) {
      try {
        await this.pushProvider.sendPush(token.token, payload);
        pushed = true;
      } catch (err) {
        lastError = (err as Error)?.message ?? String(err);
        this.logger.error(
          `Error sending push to ${token.token.slice(0, 30)}...: ${lastError}`,
        );

        if (this.isInvalidTokenError(lastError)) {
          await this.pushTokenRepo.update(
            { id: token.id },
            { isActive: false },
          );
          this.logger.warn(`Deactivated invalid push token id=${token.id}`);
        }
      }
    }

    return { pushed, error: pushed ? null : lastError };
  }

  private buildPushData(
    notificationId: string,
    extra?: Record<string, unknown> | null,
  ): Record<string, string> {
    return {
      notificationId,
      ...Object.fromEntries(
        Object.entries(extra ?? {}).map(([k, v]) => [k, String(v)]),
      ),
    };
  }

  private isInvalidTokenError(message: string): boolean {
    return (
      message.includes('DeviceNotRegistered') ||
      message.includes('InvalidRegistration') ||
      message.includes('NotRegistered')
    );
  }
}
