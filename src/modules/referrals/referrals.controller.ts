import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  // ─── Config ────────────────────────────────────────────────────────

  @Get('config')
  @ApiOperation({
    summary: 'Obtener configuración actual de porcentajes y TTL',
  })
  getConfig() {
    return this.referralsService.getConfig();
  }

  @Patch('config')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Actualizar porcentajes y TTL del sistema de referidos (solo SUPER_ADMIN)',
  })
  updateConfig(
    @Body() dto: UpdateReferralConfigDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.referralsService.updateConfig(dto, user);
  }

  // ─── Links ─────────────────────────────────────────────────────────

  @Post('links')
  @Permissions('referrals.generate')
  @ApiOperation({ summary: 'Generar nuevo link de referido' })
  @ApiResponse({
    status: 201,
    description: 'Link generado con URL y fecha de expiración',
  })
  generateLink(@CurrentUser() user: IUserPayload) {
    return this.referralsService.generateLink(user);
  }

  @Get('links')
  @Permissions('referrals.generate')
  @ApiOperation({ summary: 'Listar mis links de referido activos' })
  getMyLinks(@CurrentUser() user: IUserPayload) {
    return this.referralsService.getMyLinks(user);
  }

  @Delete('links/:id')
  @Permissions('referrals.generate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar un link de referido' })
  deactivateLink(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.referralsService.deactivateLink(id, user);
  }

  // ─── Validación pública ────────────────────────────────────────────

  @Get('links/validate')
  @Public()
  @ApiOperation({
    summary:
      'Validar token de referido (público — usado en pantalla de registro)',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Token del link de referido',
  })
  @ApiResponse({ status: 200, description: 'Estado de validez del token' })
  validateToken(@Query('token') token: string) {
    return this.referralsService.validateToken(token);
  }

  // ─── Estadísticas ──────────────────────────────────────────────────

  @Get('me')
  @Permissions('referrals.generate')
  @ApiOperation({ summary: 'Mis estadísticas de referidos' })
  getMyStats(@CurrentUser() user: IUserPayload) {
    return this.referralsService.getMyStats(user);
  }
}
