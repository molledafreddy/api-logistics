import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';
import {
  BillingService,
  MyRenewalView,
  RetryRenewalResult,
} from './billing.service';

/**
 * Sprint F.1 + F.2 — BillingController.
 *
 * Endpoints:
 *   GET  /v1/billing/me/renewal — estado de renovación + initPoint pendiente.
 *   POST /v1/billing/me/retry   — fuerza un nuevo checkout (Sprint F.2).
 */
@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('me/renewal')
  @ApiOperation({
    summary: 'Estado de la próxima renovación de la suscripción del usuario',
    description:
      'Devuelve `initPoint` si el scheduler ya generó un checkout para que el frontend lo abra en una pestaña.',
  })
  @ApiResponse({ status: 200, description: 'Estado de renovación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Sin suscripción activa' })
  async getMyRenewal(
    @CurrentUser() user: IUserPayload,
  ): Promise<MyRenewalView> {
    if (!user?.companyId) {
      throw new UnauthorizedException('Usuario sin company');
    }
    return this.billingService.getMyRenewal(user.companyId);
  }

  @Post('me/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reintenta el cobro generando un nuevo checkout',
    description:
      'Solo aplicable a suscripciones en `pending_payment` o `suspended`. ' +
      'Throttle de 5 minutos entre intentos.',
  })
  @ApiResponse({ status: 200, description: 'Checkout generado' })
  @ApiResponse({
    status: 400,
    description: 'Retry too soon o plan no cobrable',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 404,
    description: 'Sin suscripción retriable',
  })
  async retry(@CurrentUser() user: IUserPayload): Promise<RetryRenewalResult> {
    if (!user?.companyId) {
      throw new UnauthorizedException('Usuario sin company');
    }
    return this.billingService.retry(user.companyId);
  }
}
