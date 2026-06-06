import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { Plan } from './decorators/plan.decorator';
import { PlanGuard } from './guards/plan.guard';
import {
  CreateFreeSubscriptionDto,
  ChangePlanDto,
  AddAddonDto,
  UpdateAddonQuantityDto,
} from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

const { SUPER_ADMIN, COMPANY_OWNER, ADMIN } = UserRole;

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Log para depuración
  private logRequest(method: string, extra?: any) {
    console.log(`[SUBSCRIPTIONS_CONTROLLER] ${method} llamada`, extra || '');
  }

  @Post('free')
  @Roles(SUPER_ADMIN, COMPANY_OWNER)
  @ApiOperation({ summary: 'Crear suscripción gratuita' })
  @ApiResponse({ status: 201, description: 'Suscripción gratuita creada' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 409, description: 'Ya tiene suscripción activa' })
  async createFree(@Body() body: CreateFreeSubscriptionDto) {
    this.logRequest('POST /subscriptions/free', body);
    return this.subscriptionsService.createFreeSubscription(
      body.companyId,
      body.planId,
    );
  }

  @Get('company/:companyId')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN)
  @ApiOperation({ summary: 'Listar suscripciones por empresa' })
  @ApiResponse({ status: 200, description: 'Lista de suscripciones' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  @ApiParam({ name: 'companyId', type: 'string' })
  async findByCompany(@Param('companyId') companyId: string) {
    this.logRequest('GET /subscriptions/company/:companyId', companyId);
    return this.subscriptionsService.findByCompany(companyId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción cancelada' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  @ApiResponse({ status: 409, description: 'Suscripción ya cancelada' })
  @ApiParam({ name: 'id', type: 'string' })
  @Plan('premium') // Ejemplo: solo usuarios con plan 'premium' pueden cancelar
  @UseGuards(PlanGuard)
  async cancel(@Param('id') id: string) {
    this.logRequest('PATCH /subscriptions/:id/cancel', id);
    return this.subscriptionsService.cancelSubscription(id);
  }

  @Patch(':id/upgrade')
  @Roles(SUPER_ADMIN, COMPANY_OWNER)
  @ApiOperation({ summary: 'Upgrade de suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción actualizada' })
  @ApiResponse({ status: 400, description: 'Plan inválido o no compatible' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  @ApiParam({ name: 'id', type: 'string' })
  async upgrade(@Param('id') id: string, @Body() body: ChangePlanDto) {
    this.logRequest('PATCH /subscriptions/:id/upgrade', { id, ...body });
    return this.subscriptionsService.upgradeSubscription(id, body.newPlanId);
  }

  @Patch(':id/downgrade')
  @Roles(SUPER_ADMIN, COMPANY_OWNER)
  @ApiOperation({ summary: 'Downgrade de suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción actualizada' })
  @ApiResponse({ status: 400, description: 'Plan inválido o no compatible' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  @ApiParam({ name: 'id', type: 'string' })
  async downgrade(@Param('id') id: string, @Body() body: ChangePlanDto) {
    this.logRequest('PATCH /subscriptions/:id/downgrade', { id, ...body });
    return this.subscriptionsService.downgradeSubscription(id, body.newPlanId);
  }

  @Patch(':id/suspend')
  @Roles(SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspender suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción suspendida' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  @ApiResponse({ status: 409, description: 'Suscripción ya suspendida' })
  @ApiParam({ name: 'id', type: 'string' })
  async suspend(@Param('id') id: string) {
    this.logRequest('PATCH /subscriptions/:id/suspend', id);
    return this.subscriptionsService.suspendSubscription(id);
  }

  // --- Endpoints para Addons ---
  @Post(':id/addons')
  @Roles(SUPER_ADMIN, COMPANY_OWNER)
  @ApiOperation({ summary: 'Agregar addon a suscripción' })
  @ApiResponse({ status: 201, description: 'Addon agregado' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  @ApiParam({ name: 'id', type: 'string' })
  async addAddon(
    @Param('id') subscriptionId: string,
    @Body() body: AddAddonDto,
  ) {
    this.logRequest('POST /subscriptions/:id/addons', {
      subscriptionId,
      ...body,
    });
    return this.subscriptionsService.addAddon(
      subscriptionId,
      body.addon_type,
      body.quantity,
    );
  }

  @Patch('addons/:addonId')
  @Roles(SUPER_ADMIN, COMPANY_OWNER)
  @ApiOperation({ summary: 'Actualizar cantidad de un addon' })
  @ApiResponse({ status: 200, description: 'Addon actualizado' })
  @ApiResponse({ status: 404, description: 'Addon no encontrado' })
  @ApiResponse({ status: 400, description: 'Cantidad inválida' })
  @ApiParam({ name: 'addonId', type: 'string' })
  async updateAddon(
    @Param('addonId') addonId: string,
    @Body() body: UpdateAddonQuantityDto,
  ) {
    this.logRequest('PATCH /subscriptions/addons/:addonId', {
      addonId,
      ...body,
    });
    return this.subscriptionsService.updateAddon(addonId, body.quantity);
  }

  @Get(':id/addons')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN)
  @ApiOperation({ summary: 'Listar addons de una suscripción' })
  @ApiResponse({ status: 200, description: 'Lista de addons' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  @ApiParam({ name: 'id', type: 'string' })
  async getAddons(@Param('id') subscriptionId: string) {
    this.logRequest('GET /subscriptions/:id/addons', subscriptionId);
    return this.subscriptionsService.getAddonsBySubscription(subscriptionId);
  }

  @Get('addons/:addonId')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN)
  @ApiOperation({ summary: 'Obtener addon por ID' })
  @ApiResponse({ status: 200, description: 'Addon encontrado' })
  @ApiResponse({ status: 404, description: 'Addon no encontrado' })
  @ApiParam({ name: 'addonId', type: 'string' })
  async getAddon(@Param('addonId') addonId: string) {
    this.logRequest('GET /subscriptions/addons/:addonId', addonId);
    return this.subscriptionsService.getAddonById(addonId);
  }

  @Patch('addons/:addonId/delete')
  @Roles(SUPER_ADMIN, COMPANY_OWNER)
  @ApiOperation({ summary: 'Eliminar addon de una suscripción' })
  @ApiResponse({ status: 200, description: 'Addon eliminado' })
  @ApiResponse({ status: 404, description: 'Addon no encontrado' })
  @ApiParam({ name: 'addonId', type: 'string' })
  async removeAddon(@Param('addonId') addonId: string) {
    this.logRequest('PATCH /subscriptions/addons/:addonId/delete', addonId);
    return this.subscriptionsService.removeAddon(addonId);
  }
}
