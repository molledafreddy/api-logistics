import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentsService } from './payments.service';
import { IPaymentProvider, PAYMENT_PROVIDER_TOKEN } from './payments.types';
import { Inject } from '@nestjs/common';

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
  async createCheckout(@Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckout({
      subscriptionId: dto.subscriptionId,
      companyId: '', // resuelto desde sub interna en service (cubierto en futura iteración)
      amount: dto.amount,
      currency: dto.currency ?? 'CLP',
      itemTitle: dto.itemTitle,
      payerEmail: dto.payerEmail,
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
      'Idempotente: eventos duplicados devuelven 200 sin efectos secundarios.',
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
