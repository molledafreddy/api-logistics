import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly appUrl: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.accountSid = config.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = config.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = config.get<string>(
      'TWILIO_WHATSAPP_FROM',
      'whatsapp:+14155238886',
    );
    this.appUrl = config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
    this.enabled = !!(this.accountSid && this.authToken);
  }

  async sendProximityAlert(
    phone: string,
    trackingToken: string,
    address: string,
  ): Promise<void> {
    const trackingUrl = `${this.appUrl}/tracking/${trackingToken}`;
    const body =
      `🚚 Tu conductor está a menos de 500 metros de *${address}*.\n\n` +
      `Prepárate para la entrega. Sigue el recorrido en tiempo real:\n${trackingUrl}`;
    await this.send(phone, body);
  }

  async sendDeliveryConfirmation(
    phone: string,
    trackingToken: string,
    address: string,
  ): Promise<void> {
    const trackingUrl = `${this.appUrl}/tracking/${trackingToken}`;
    const body =
      `✅ Tu envío ha sido entregado exitosamente en *${address}*.\n\n` +
      `Puedes ver el comprobante y el historial aquí:\n${trackingUrl}`;
    await this.send(phone, body);
  }

  async sendPickupConfirmation(
    phone: string,
    trackingToken: string,
    address: string,
  ): Promise<void> {
    const trackingUrl = `${this.appUrl}/tracking/${trackingToken}`;
    const body =
      `📦 Tu paquete ha sido recogido en *${address}* y está en camino.\n\n` +
      `Sigue el recorrido en tiempo real:\n${trackingUrl}`;
    await this.send(phone, body);
  }

  private async send(phone: string, body: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        `[WhatsApp] No configurado — mensaje para ${phone}: ${body.slice(0, 60)}...`,
      );
      return;
    }

    const normalized = phone.startsWith('+') ? phone : `+${phone}`;
    const to = `whatsapp:${normalized}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const credentials = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
    ).toString('base64');
    const formData = new URLSearchParams({
      From: this.fromNumber,
      To: to,
      Body: body,
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`[WhatsApp] Twilio error ${res.status}: ${err}`);
      } else {
        this.logger.log(`[WhatsApp] Enviado a ${normalized}`);
      }
    } catch (err) {
      this.logger.error(`[WhatsApp] Fetch error: ${(err as Error).message}`);
    }
  }
}
