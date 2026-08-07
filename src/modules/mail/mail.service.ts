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

  async sendBillingEmail(opts: {
    to: string;
    subject: string;
    preheader: string;
    planName: string;
    /** Pill de estado — colores de STATUS_CONFIG del app. */
    badge: { label: string; bg: string; border: string; color: string };
    /** Banner de alerta coloreado (pending/suspended/error). Opcional para eventos positivos. */
    alert?: {
      bg: string;
      border: string;
      iconBg: string;
      icon: string;
      title: string;
      titleColor: string;
      body: string;
      bodyColor: string;
    };
    /** Filas de info con fondo #f8fafc, igual que la sección de InfoRow del app. */
    infoRows?: Array<{ label: string; value: string; valueColor?: string }>;
    ctaLabel: string;
  }): Promise<boolean> {
    const appUrl =
      this.config.get<string>('APP_PUBLIC_URL') ?? 'https://logisticsapp.cl';

    const infoRowsHtml = opts.infoRows?.length
      ? `<tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:4px 18px 8px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${opts.infoRows
              .map(
                (row, i) => `
            <tr>
              <td style="padding:11px 0;font-size:13px;color:#64748b;border-bottom:${i < opts.infoRows!.length - 1 ? '1px solid #f1f5f9' : 'none'}">${row.label}</td>
              <td align="right" style="padding:11px 0;font-size:13px;font-weight:600;color:${row.valueColor ?? '#0f172a'};border-bottom:${i < opts.infoRows!.length - 1 ? '1px solid #f1f5f9' : 'none'}">${row.value}</td>
            </tr>`,
              )
              .join('')}
          </table>
        </td></tr>`
      : '';

    const alertHtml = opts.alert
      ? `<tr><td style="padding-top:12px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${opts.alert.bg};border:1px solid ${opts.alert.border};border-radius:14px">
            <tr>
              <td width="46" style="padding:14px 0 14px 14px;vertical-align:top">
                <div style="width:34px;height:34px;border-radius:17px;background:${opts.alert.iconBg};text-align:center;line-height:34px;font-size:16px">${opts.alert.icon}</div>
              </td>
              <td style="padding:14px 14px 14px 10px;vertical-align:top">
                <div style="font-size:13px;font-weight:600;color:${opts.alert.titleColor};margin-bottom:3px">${opts.alert.title}</div>
                <div style="font-size:12px;color:${opts.alert.bodyColor};line-height:1.6">${opts.alert.body}</div>
              </td>
            </tr>
          </table>
        </td></tr>`
      : '';

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Logistics App</title>
</head>
<body style="margin:0;padding:0;background:#7ee8a2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${opts.preheader}</div>

  <!-- Header verde — replica el encabezado de la pantalla de Suscripción -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="background:#7ee8a2;padding:32px 20px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
        <tr><td style="padding-bottom:20px">
          <span style="display:inline-block;background:#ffffff;color:#15803d;font-weight:700;font-size:13px;padding:5px 14px;border-radius:8px">Logistics App</span>
        </td></tr>
        <tr><td style="padding-bottom:4px">
          <div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1.2">Suscripción</div>
        </td></tr>
        <tr><td style="padding-bottom:24px">
          <div style="font-size:13px;color:#166534">Plan ${opts.planName}</div>
        </td></tr>
      </table>
    </td></tr>

    <!-- Transición verde → #f8fafc con border-radius superior, igual que la app -->
    <tr><td align="center" style="background:#f8fafc;border-radius:28px 28px 0 0;padding:20px 16px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <!-- Card del plan: fondo blanco, borde #e2e8f0, border-radius 20px -->
        <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">
          <table width="100%" cellpadding="0" cellspacing="0">

            <!-- Encabezado: "Plan actual" + badge de estado -->
            <tr><td style="padding:18px 18px 0">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;font-weight:500">Plan actual</td>
                  <td align="right">
                    <span style="display:inline-block;background:${opts.badge.bg};border:1px solid ${opts.badge.border};color:${opts.badge.color};font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px">${opts.badge.label}</span>
                  </td>
                </tr>
              </table>
            </td></tr>

            <!-- Nombre del plan -->
            <tr><td style="padding:10px 18px 14px;font-size:24px;font-weight:800;color:#0f172a">${opts.planName}</td></tr>

            <!-- Filas de información (fondo #f8fafc, igual que InfoRow del app) -->
            ${infoRowsHtml}

          </table>
        </td></tr>

        <!-- Banner de alerta coloreado (pending_payment / suspended) -->
        ${alertHtml}

        <!-- Botón CTA — mismo estilo que "Pagar ahora" del app -->
        <tr><td style="padding-top:10px">
          <a href="${appUrl}" style="display:block;background:#22c55e;color:#ffffff;text-align:center;text-decoration:none;font-weight:600;font-size:15px;padding:16px 24px;border-radius:14px">${opts.ctaLabel}</a>
        </td></tr>

      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="background:#f8fafc;padding:24px 20px 40px">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;text-align:center">
        Recibiste este correo porque eres administrador de tu empresa en Logistics App.<br>
        ¿Tienes dudas? Escríbenos a <a href="mailto:soporte@logisticsapp.cl" style="color:#22c55e;text-decoration:none">soporte@logisticsapp.cl</a>
      </p>
    </td></tr>
  </table>

</body>
</html>`,
      });

      if (error) {
        this.logger.warn(
          `Resend billing email error to ${opts.to}: ${error.message}`,
        );
        return false;
      }

      this.logger.log(`Billing email "${opts.subject}" sent to ${opts.to}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed to send billing email to ${opts.to}: ${err.message}`,
      );
      return false;
    }
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
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Logistics App</title>
</head>
<body style="margin:0;padding:0;background:#7ee8a2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${companyName} te invita a activar tu cuenta de conductor.</div>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="background:#7ee8a2;padding:32px 20px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
        <tr><td style="padding-bottom:20px">
          <span style="display:inline-block;background:#ffffff;color:#15803d;font-weight:700;font-size:13px;padding:5px 14px;border-radius:8px">Logistics App</span>
        </td></tr>
        <tr><td style="padding-bottom:4px">
          <div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1.2">¡Hola, ${driverFirstName}!</div>
        </td></tr>
        <tr><td style="padding-bottom:24px">
          <div style="font-size:13px;color:#166534">${companyName} te invita a activar tu cuenta</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="background:#f8fafc;border-radius:28px 28px 0 0;padding:20px 16px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:18px 18px 0">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;font-weight:500">Invitación de conductor</div>
            </td></tr>
            <tr><td style="padding:10px 18px 14px;font-size:16px;font-weight:700;color:#0f172a;line-height:1.5">
              <strong>${companyName}</strong> te ha invitado a activar tu cuenta de conductor en la plataforma de logística.<br>
              <span style="font-size:14px;font-weight:400;color:#64748b">Abre la app, ve a <strong>Activar cuenta</strong> e ingresa el código:</span>
            </td></tr>
            <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 18px;text-align:center">
              <div style="font-size:11px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">Token de activación</div>
              <code style="display:inline-block;font-size:13px;word-break:break-all;color:#0f172a;font-family:monospace;line-height:1.8;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px">${token}</code>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:10px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.6">
            ⏳ Este código es válido por <strong>${expiresInHours} horas</strong>. Si no lo solicitaste, puedes ignorar este mensaje.
          </div>
        </td></tr>

      </table>
    </td></tr>

    <tr><td align="center" style="background:#f8fafc;padding:24px 20px 40px">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;text-align:center">
        Recibiste este correo porque alguien ingresó tu correo en Logistics App.<br>
        ¿Tienes dudas? Escríbenos a <a href="mailto:soporte@logisticsapp.cl" style="color:#22c55e;text-decoration:none">soporte@logisticsapp.cl</a>
      </p>
    </td></tr>
  </table>

</body>
</html>`,
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

  async sendVerificationCode(opts: {
    to: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<boolean> {
    const { to, firstName, code, expiresInMinutes } = opts;

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Verifica tu correo electrónico',
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Logistics App</title>
</head>
<body style="margin:0;padding:0;background:#7ee8a2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Tu código de verificación de Logistics App.</div>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="background:#7ee8a2;padding:32px 20px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
        <tr><td style="padding-bottom:20px">
          <span style="display:inline-block;background:#ffffff;color:#15803d;font-weight:700;font-size:13px;padding:5px 14px;border-radius:8px">Logistics App</span>
        </td></tr>
        <tr><td style="padding-bottom:4px">
          <div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1.2">¡Hola, ${firstName}!</div>
        </td></tr>
        <tr><td style="padding-bottom:24px">
          <div style="font-size:13px;color:#166534">Confirma tu correo para activar tu cuenta</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="background:#f8fafc;border-radius:28px 28px 0 0;padding:20px 16px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:18px 18px 0">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;font-weight:500">Verificación de cuenta</div>
            </td></tr>
            <tr><td style="padding:10px 18px 14px;font-size:16px;font-weight:700;color:#0f172a;line-height:1.5">
              Ingresa este código en la app para verificar tu correo electrónico:
            </td></tr>
            <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 18px;text-align:center">
              <div style="font-size:11px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">Código de verificación</div>
              <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:0.3em;color:#0f172a;font-family:monospace;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 20px">${code}</span>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:10px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.6">
            ⏳ Este código es válido por <strong>${expiresInMinutes} minutos</strong>. Si no lo solicitaste, puedes ignorar este mensaje.
          </div>
        </td></tr>

      </table>
    </td></tr>

    <tr><td align="center" style="background:#f8fafc;padding:24px 20px 40px">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;text-align:center">
        Recibiste este correo porque alguien registró esta dirección en Logistics App.<br>
        ¿Tienes dudas? Escríbenos a <a href="mailto:soporte@logisticsapp.cl" style="color:#22c55e;text-decoration:none">soporte@logisticsapp.cl</a>
      </p>
    </td></tr>
  </table>

</body>
</html>`,
      });

      if (error) {
        this.logger.warn(`Resend error sending to ${to}: ${error.message}`);
        return false;
      }

      this.logger.log(`Verification code email sent to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed to send verification code email to ${to}: ${err.message}`,
      );
      return false;
    }
  }

  async sendPasswordResetCode(opts: {
    to: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<boolean> {
    const { to, firstName, code, expiresInMinutes } = opts;

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Restablece tu contraseña',
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Logistics App</title>
</head>
<body style="margin:0;padding:0;background:#7ee8a2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Tu código para restablecer tu contraseña en Logistics App.</div>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="background:#7ee8a2;padding:32px 20px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
        <tr><td style="padding-bottom:20px">
          <span style="display:inline-block;background:#ffffff;color:#15803d;font-weight:700;font-size:13px;padding:5px 14px;border-radius:8px">Logistics App</span>
        </td></tr>
        <tr><td style="padding-bottom:4px">
          <div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1.2">¡Hola, ${firstName}!</div>
        </td></tr>
        <tr><td style="padding-bottom:24px">
          <div style="font-size:13px;color:#166534">Restablece el acceso a tu cuenta</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="background:#f8fafc;border-radius:28px 28px 0 0;padding:20px 16px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:18px 18px 0">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;font-weight:500">Recuperación de contraseña</div>
            </td></tr>
            <tr><td style="padding:10px 18px 14px;font-size:16px;font-weight:700;color:#0f172a;line-height:1.5">
              Ingresa este código en la app para crear una nueva contraseña:
            </td></tr>
            <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 18px;text-align:center">
              <div style="font-size:11px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">Código de recuperación</div>
              <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:0.3em;color:#0f172a;font-family:monospace;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 20px">${code}</span>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:10px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.6">
            ⏳ Este código es válido por <strong>${expiresInMinutes} minutos</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje — tu contraseña actual sigue siendo válida.
          </div>
        </td></tr>

      </table>
    </td></tr>

    <tr><td align="center" style="background:#f8fafc;padding:24px 20px 40px">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;text-align:center">
        Recibiste este correo porque se solicitó restablecer la contraseña de esta cuenta en Logistics App.<br>
        ¿Tienes dudas? Escríbenos a <a href="mailto:soporte@logisticsapp.cl" style="color:#22c55e;text-decoration:none">soporte@logisticsapp.cl</a>
      </p>
    </td></tr>
  </table>

</body>
</html>`,
      });

      if (error) {
        this.logger.warn(`Resend error sending to ${to}: ${error.message}`);
        return false;
      }

      this.logger.log(`Password reset code email sent to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed to send password reset code email to ${to}: ${err.message}`,
      );
      return false;
    }
  }
}
