import type * as AdminTypes from 'firebase-admin';

export abstract class PushProvider {
  abstract sendPush(
    token: string,
    payload: AdminTypes.messaging.MessagingPayload,
  ): Promise<void>;
}
