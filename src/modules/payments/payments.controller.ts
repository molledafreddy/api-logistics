import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentsService } from './payments.service';
import { IPaymentProvider, PAYMENT_PROVIDER_TOKEN } from './payments.types';

/**
 * Sprint E — Endpoints del módulo de pagos.
 *
 *   POST /v1/payments/checkout            (auth) — crea preference y devuelve initPoint
 *   POST /v1/payments/:provider/webhook   (PUBLIC, firma HMAC verificada)
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly provider: IPaymentProvider,
  ) {}

  // ─── Checkout (auth) ───────────────────────

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear checkout de pago para una subscription',
    description:
      'Devuelve `initPoint` (URL del provider) para redirigir al usuario. ' +
      'El `externalReference` queda persistido en la subscription para amarrar el webhook posterior.',
  })
  @ApiResponse({ status: 201, description: 'Checkout creado' })
  @ApiResponse({ status: 404, description: 'Subscription no encontrada' })
  @ApiResponse({
    status: 503,
    description: 'Provider no configurado o caído (PAY-MP-001 / PAY-MP-003)',
  })
  async createCheckout(
    @CurrentUser() user: IUserPayload,
    @Body() dto: CreateCheckoutDto,
  ) {
    if (!user?.companyId) {
      throw new UnauthorizedException('Usuario sin company asociada');
    }
    return this.paymentsService.createCheckout({
      subscriptionId: dto.subscriptionId,
      companyId: user.companyId,
      amount: dto.amount,
      currency: dto.currency ?? 'CLP',
      itemTitle: dto.itemTitle,
      payerEmail: dto.payerEmail ?? user.email,
      backUrls: dto.back_urls,
    });
  }

  // ─── Webhook (público, firma HMAC) ─────────

  @Public()
  @Post(':provider/webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook del provider de pagos',
    description:
      'Recibe notificaciones del provider (firma HMAC verificada). ' +
      'Idempotente: eventos duplicados devuelven 200 sin efectos secundarios. ' +
      'En modo **mock**: usar `x-signature: mock-signature` (o vacío) y body normalizado.',
  })
  @ApiParam({
    name: 'provider',
    description: 'Nombre del provider activo',
    enum: ['mock', 'mercadopago'],
    example: 'mock',
  })
  @ApiHeader({
    name: 'x-signature',
    description:
      'Firma HMAC-SHA256 del webhook. En mock usar "mock-signature" o dejar vacío.',
    required: false,
    example: 'mock-signature',
  })
  @ApiBody({
    description: 'Payload del webhook. En mock: body normalizado directamente.',
    examples: {
      mock_approved: {
        summary: 'Pago aprobado (mock)',
        value: {
          type: 'payment.approved',
          externalId: 'test-pay-001',
          externalReference: 'mock-SUBSCRIPTION_ID-XXXXXXXX',
          amount: 10000,
          currency: 'CLP',
        },
      },
      mock_rejected: {
        summary: 'Pago rechazado (mock)',
        value: {
          type: 'payment.rejected',
          externalId: 'test-pay-002',
          externalReference: 'mock-SUBSCRIPTION_ID-XXXXXXXX',
          amount: 10000,
          currency: 'CLP',
        },
      },
      mercadopago: {
        summary: 'Webhook real MercadoPago',
        value: {
          action: 'payment.updated',
          type: 'payment',
          data: { id: '123456789' },
        },
      },
    },
    schema: { type: 'object' },
  })
  @ApiResponse({ status: 200, description: 'Procesado o no-op (idempotente)' })
  @ApiResponse({ status: 401, description: 'Firma inválida' })
  async webhook(
    @Req() req: Request & { rawBody?: string },
    @Body() body: unknown,
  ) {
    const headers = this.lowercaseHeaders(req.headers);
    const rawBody = req.rawBody ?? JSON.stringify(body ?? {});

    if (!this.provider.verifyWebhookSignature(rawBody, headers)) {
      this.logger.warn(
        `webhook firma inválida (provider=${this.provider.providerName})`,
      );
      throw new UnauthorizedException('PAY-001: firma inválida');
    }

    const result = await this.paymentsService.processWebhook(body);
    return {
      received: true,
      idempotent: result.idempotent,
      type: result.type,
      externalId: result.externalId,
    };
  }

  // ─── Redirect pages (back_urls de MercadoPago) ─────────────────────────────
  //
  // MercadoPago requiere back_urls con HTTPS válido para superar la
  // "Calidad de integración" (mínimo 73/100). Estas páginas sirven HTML
  // con redirect automático al deep link de la app nativa.

  @Public()
  @Get('redirect/success')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Página de retorno tras pago exitoso (back_url de MercadoPago)',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML con redirect al deep link de la app',
  })
  redirectSuccess() {
    return this.buildRedirectPage({
      status: 'success',
      icon: '✅',
      title: '¡Pago exitoso!',
      body: 'Tu plan fue activado correctamente. Puedes cerrar esta ventana y volver a la aplicación.',
      deepLink: 'logistics://payment/success',
      btnClass: 'success',
    });
  }

  @Public()
  @Get('redirect/failure')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Página de retorno tras pago fallido (back_url de MercadoPago)',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML con redirect al deep link de la app',
  })
  redirectFailure() {
    return this.buildRedirectPage({
      status: 'failure',
      icon: '❌',
      title: 'Pago no procesado',
      body: 'No se pudo completar el pago. Vuelve a la app para intentarlo nuevamente.',
      deepLink: 'logistics://payment/failure',
      btnClass: 'failure',
    });
  }

  @Public()
  @Get('redirect/pending')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Página de retorno tras pago pendiente (back_url de MercadoPago)',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML con redirect al deep link de la app',
  })
  redirectPending() {
    return this.buildRedirectPage({
      status: 'pending',
      icon: '⏳',
      title: 'Pago en revisión',
      body: 'Tu pago está siendo procesado. Te notificaremos cuando sea confirmado.',
      deepLink: 'logistics://payment/pending',
      btnClass: 'pending',
    });
  }

  private buildRedirectPage(opts: {
    status: string;
    icon: string;
    title: string;
    body: string;
    deepLink: string;
    btnClass: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Logistics App</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;visibility:hidden}
    body.show{visibility:visible}
    .card{background:#fff;border-radius:20px;padding:36px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{font-size:52px;margin-bottom:20px;display:block}
    h1{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:10px}
    p{font-size:14px;color:#64748b;line-height:1.6;margin-bottom:28px}
    .btn{display:inline-block;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px}
    .success{background:#22c55e}.failure{background:#ef4444}.pending{background:#f59e0b}
  </style>
  <script>
    // Redirige inmediatamente. En el WebView nativo de la app esto es interceptado
    // por onLoadStart/onShouldStartLoadWithRequest antes de que el body sea visible.
    // En un navegador sin la app instalada falla silenciosamente y se muestra el contenido.
    try { window.location.replace('${opts.deepLink}'); } catch(e) {}
  </script>
</head>
<body>
  <div class="card">
    <span class="icon">${opts.icon}</span>
    <h1>${opts.title}</h1>
    <p>${opts.body}</p>
    <a href="${opts.deepLink}" class="btn ${opts.btnClass}">Volver a la app</a>
  </div>
  <script>
    // Si el redirect al deep link falló (navegador sin la app instalada), mostrar contenido.
    document.body.classList.add('show');
  </script>
</body>
</html>`;
  }

  // ─── Helpers ───────────────────────────────

  private lowercaseHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v == null) continue;
      out[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : String(v);
    }
    return out;
  }
}
