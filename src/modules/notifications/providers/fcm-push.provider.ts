import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type * as AdminTypes from 'firebase-admin';

@Injectable()
export class FcmPushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private _admin: typeof AdminTypes | null = null;

  constructor(private readonly config: ConfigService) {}

  // Lazy-load firebase-admin on first use instead of at module parse time.
  // A top-level `import * as admin from 'firebase-admin'` causes Node.js to
  // load the module synchronously during the require() chain, which deadlocks
  // on startup before any application code runs.
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

  async sendPush(
    token: string,
    payload: AdminTypes.messaging.MessagingPayload,
  ): Promise<void> {
    const admin = this.getAdmin();
    await admin.messaging().send({ token, ...payload });
    this.logger.log(`Push enviado a token=${token.slice(0, 20)}...`);
  }
}
