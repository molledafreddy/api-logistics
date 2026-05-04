import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { BillingService, MyRenewalView } from './billing.service';

/**
 * Sprint F.1 — BillingController.
 *
 * Endpoints:
 *   GET /v1/billing/me/renewal — estado de renovación + initPoint pendiente.
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
}
