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
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';
import {
  BillingService,
  LastPaymentEventView,
  MyRenewalView,
  PaymentHistoryItem,
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER, UserRole.ADMIN)
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

  @Get('me/history')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({
    summary: 'Historial de eventos de pago de la suscripción activa',
  })
  @ApiResponse({ status: 200, description: 'Lista de eventos de pago' })
  async getMyHistory(
    @CurrentUser() user: IUserPayload,
  ): Promise<PaymentHistoryItem[]> {
    if (!user?.companyId)
      throw new UnauthorizedException('Usuario sin company');
    return this.billingService.getMyHistory(user.companyId);
  }

  @Post('me/retry')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER)
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

  @Get('me/last-payment-event')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Último evento de pago verificado (fuente de verdad post-checkout)',
    description:
      'El cliente móvil debe llamar a este endpoint tras volver del checkout ' +
      '(deep link `logistics://payment/*`) para conocer el estado REAL del pago. ' +
      'Nunca confiar en el query string del deep link: es spoofeable. ' +
      'Devuelve `null` si no hay eventos en las últimas 24h.',
  })
  @ApiResponse({ status: 200, description: 'Último evento o null' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMyLastPaymentEvent(
    @CurrentUser() user: IUserPayload,
  ): Promise<LastPaymentEventView | null> {
    if (!user?.companyId)
      throw new UnauthorizedException('Usuario sin company');
    return this.billingService.getMyLastPaymentEvent(user.companyId);
  }
}
