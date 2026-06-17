import { Injectable, Logger } from '@nestjs/common';
import { PushProvider, type PushPayload } from './push-provider.abstract';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class ExpoPushProvider extends PushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  async sendPush(token: string, payload: PushPayload): Promise<void> {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        channelId: 'default',
      }),
    });

    if (!response.ok) {
      throw new Error(`Expo Push API HTTP error: ${response.status}`);
    }

    const result = (await response.json()) as { data: ExpoPushTicket };
    const ticket = result.data;

    if (ticket.status === 'error') {
      throw new Error(
        `Expo Push error: ${ticket.message ?? 'unknown'} (${ticket.details?.error ?? ''})`,
      );
    }

    this.logger.log(
      `Push sent via Expo — ticket=${ticket.id}, token=${token.slice(0, 30)}...`,
    );
  }
}
