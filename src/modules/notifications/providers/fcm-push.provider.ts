import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type * as AdminTypes from 'firebase-admin';
import { PushProvider, type PushPayload } from './push-provider.abstract';

@Injectable()
export class FcmPushProvider extends PushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private _admin: typeof AdminTypes | null = null;

  constructor(private readonly config: ConfigService) {
    super();
  }

  private getAdmin(): typeof AdminTypes {
    if (!this._admin) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this._admin = require('firebase-admin') as typeof AdminTypes;

      if (!this._admin.apps.length) {
        const projectId = this.config.get<string>('FIREBASE_PROJECT_ID', '');
        const clientEmail = this.config.get<string>(
          'FIREBASE_CLIENT_EMAIL',
          '',
        );
        const rawKey = this.config.get<string>('FIREBASE_PRIVATE_KEY', '');

        if (projectId && clientEmail && rawKey) {
          const privateKey = rawKey.replace(/\\n/g, '\n');
          this._admin.initializeApp({
            credential: this._admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
          this.logger.log(
            'Firebase Admin inicializado con credenciales de entorno',
          );
        } else {
          this._admin.initializeApp({
            credential: this._admin.credential.applicationDefault(),
          });
          this.logger.log(
            'Firebase Admin inicializado con applicationDefault()',
          );
        }
      }
    }
    return this._admin;
  }

  async sendPush(token: string, payload: PushPayload): Promise<void> {
    const admin = this.getAdmin();
    await admin.messaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
    this.logger.log(`Push enviado a token=${token.slice(0, 20)}...`);
  }
}
