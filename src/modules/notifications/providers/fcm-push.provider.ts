import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmPushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);

  constructor(private readonly config: ConfigService) {
    if (!admin.apps.length) {
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID', '');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL', '');
      const rawKey = this.config.get<string>('FIREBASE_PRIVATE_KEY', '');

      if (projectId && clientEmail && rawKey) {
        // Variables explícitas (FIREBASE_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY)
        // El .env almacena \n como \\n (literal backslash+n). La clave pasa por
        // dos niveles de escape: Python escribe \\n → dotenv lee \\n → replace resuelve.
        const privateKey = rawKey.replace(/\\n/g, '\n');
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log(
          'Firebase Admin inicializado con credenciales de entorno',
        );
      } else {
        // Fallback: GOOGLE_APPLICATION_CREDENTIALS o ADC de GCP
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        this.logger.log('Firebase Admin inicializado con applicationDefault()');
      }
    }
  }

  async sendPush(
    token: string,
    payload: admin.messaging.MessagingPayload,
  ): Promise<void> {
    await admin.messaging().send({ token, ...payload });
    this.logger.log(`Push enviado a token=${token.slice(0, 20)}...`);
  }
}
