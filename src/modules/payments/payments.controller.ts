import {
  Body,
  Controller,
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
