import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY') || 're_no_key';
    this.resend = new Resend(apiKey);
    this.from = this.config.get<string>(
      'MAIL_FROM',
      'Logistics App <noreply@logistics-app.com>',
    );
  }

  async sendDriverInvitation(opts: {
    to: string;
    driverFirstName: string;
    companyName: string;
    token: string;
    expiresInHours?: number;
  }): Promise<boolean> {
    const {
      to,
      driverFirstName,
      companyName,
      token,
      expiresInHours = 72,
    } = opts;

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject: `${companyName} te invita a unirte`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <div style="margin-bottom:24px">
              <span style="display:inline-block;background:#22c55e;color:#fff;font-weight:700;
                           font-size:14px;padding:6px 14px;border-radius:6px">
                Logistics App
              </span>
            </div>

            <h2 style="color:#111827;font-size:22px;margin:0 0 8px">
              ¡Hola, ${driverFirstName}!
            </h2>
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px">
              <strong>${companyName}</strong> te ha invitado a activar tu cuenta de conductor
              en la plataforma de logística.
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
              Abre la app en tu dispositivo, ve a <strong>Activar cuenta</strong> e ingresa
              el siguiente código:
            </p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;
                        padding:20px;text-align:center;margin:0 0 24px">
              <p style="color:#6b7280;font-size:12px;margin:0 0 8px;text-transform:uppercase;
                         letter-spacing:.05em">Token de activación</p>
              <code style="font-size:13px;word-break:break-all;color:#111827;
                           font-family:monospace;line-height:1.8">${token}</code>
            </div>

            <p style="color:#9ca3af;font-size:13px;margin:0">
              Este código es válido por <strong>${expiresInHours} horas</strong>.
              Si no lo solicitaste, ignora este mensaje.
            </p>
          </div>
        `,
      });

      if (error) {
        this.logger.warn(`Resend error sending to ${to}: ${error.message}`);
        return false;
      }

      this.logger.log(`Driver invitation email sent to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed to send invitation email to ${to}: ${err.message}`,
      );
      return false;
    }
  }
}
