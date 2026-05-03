import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreatePermissionDefinitionDto } from './dto/create-permission-definition.dto';
import { UpdatePermissionDefinitionDto } from './dto/update-permission-definition.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { CreatePlanLimitDto } from './dto/create-plan-limit.dto';
import { UpdatePlanLimitDto } from './dto/update-plan-limit.dto';
import { PlanLimitResponseDto } from './dto/plan-limit-response.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import type { PlanLimitsMap } from './interfaces/plan-limits-map.interface';

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // --- Permission Definitions ---
  @Post('permissions')
  @UseGuards(PermissionGuard)
  @Permissions('permissions.write')
  @ApiOperation({ summary: 'Crear un nuevo permiso' })
  @ApiResponse({ status: 201, description: 'Permiso creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiBody({
    type: CreatePermissionDefinitionDto,
    examples: {
      shipments: {
        summary: 'Permiso de gestión de envíos',
        value: {
          code: 'shipments.manage',
          description: 'Permite crear, editar y eliminar envíos',
          feature: 'shipments',
        },
      },
      drivers: {
        summary: 'Permiso de gestión de conductores',
        value: {
          code: 'drivers.manage',
          description: 'Permite gestionar conductores',
          feature: 'drivers',
        },
      },
    },
  })
  createPermission(@Body() dto: CreatePermissionDefinitionDto) {
    return this.plansService.createPermission(dto);
  }

  @Get('permissions')
  @UseGuards(PermissionGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Listar todos los permisos' })
  @ApiResponse({ status: 200, description: 'Lista de permisos' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  findAllPermissions() {
    return this.plansService.findAllPermissions();
  }

  @Get('permissions/:id')
  @UseGuards(PermissionGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Obtener un permiso por ID' })
  @ApiResponse({ status: 200, description: 'Permiso encontrado' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiParam({ name: 'id', type: String })
  findOnePermission(@Param('id') id: string) {
    return this.plansService.findOnePermission(id);
  }

  @Patch('permissions/:id')
  @UseGuards(PermissionGuard)
  @Permissions('permissions.write')
  @ApiOperation({ summary: 'Actualizar un permiso por ID' })
  @ApiResponse({ status: 200, description: 'Permiso actualizado' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({
    type: UpdatePermissionDefinitionDto,
    examples: {
      update: {
        summary: 'Actualizar descripción',
        value: {
          description: 'Permite gestionar todos los envíos de la empresa',
        },
      },
    },
  })
  updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDefinitionDto,
  ) {
    return this.plansService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  @UseGuards(PermissionGuard)
  @Permissions('permissions.write')
  @ApiOperation({ summary: 'Eliminar un permiso por ID' })
  @ApiResponse({ status: 200, description: 'Permiso eliminado' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String })
  removePermission(@Param('id') id: string) {
    return this.plansService.removePermission(id);
  }

  // --- Asignar Permiso a Plan ---
  @Post('assign-permission')
  @UseGuards(PermissionGuard)
  @Permissions('permissions.write')
  @ApiOperation({ summary: 'Asignar un permiso a un plan' })
  @ApiResponse({ status: 201, description: 'Permiso asignado al plan' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiResponse({ status: 404, description: 'Plan o permiso no encontrado' })
  @ApiBody({
    type: AssignPermissionDto,
    examples: {
      assign: {
        summary: 'Asignar permiso de envíos al plan Starter',
        value: {
          planId: 'uuid-del-plan',
          permissionId: 'uuid-del-permiso',
        },
      },
    },
  })
  assignPermission(@Body() dto: AssignPermissionDto) {
    return this.plansService.assignPermissionToPlan(dto);
  }

  // ────────────────────────────────────────────────────────────────
  // Sprint A — Catálogo público + límites efectivos + admin de precios
  // (DEBE declararse antes de las rutas dinámicas `:id` para que NestJS
  //  resuelva primero estos paths estáticos.)
  // ────────────────────────────────────────────────────────────────

  @Get('catalog')
  @Public()
  @ApiOperation({
    summary: 'Catálogo público de planes activos (verticales)',
    description:
      'Devuelve los planes con `code` definido (es decir, los planes Sprint A: ' +
      '`free_courier`, `pro_courier`, `free_passenger`, `pro_passenger`, `enterprise_fleet`). ' +
      'Los planes legacy quedan ocultos. No requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de planes publicables',
    type: [PlanResponseDto],
  })
  getCatalog() {
    return this.plansService.getCatalog();
  }

  @Get('me/limits')
  @ApiOperation({
    summary: 'Límites efectivos del plan activo del usuario actual',
    description:
      'Resuelve la suscripción `active` de la empresa del usuario y devuelve ' +
      'el jsonb `plans.limits` materializado. Devuelve `{}` si no hay suscripción.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mapa de límites por vertical',
    schema: {
      example: {
        global: { maxShipmentsPerDay: 200, maxStopsPerOptimization: 50 },
        trucking: { max_trucks: 10 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMyLimits(@CurrentUser() user: IUserPayload) {
    if (!user?.companyId) {
      return {};
    }
    return this.plansService.getEffectiveLimits(user.companyId);
  }

  @Patch(':id/price')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({
    summary: 'Actualizar el precio de un plan (admin)',
    description:
      'Endpoint dedicado para cambios de pricing sin tocar otros campos.',
  })
  @ApiParam({ name: 'id', type: String, description: 'UUID del plan' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['price'],
      properties: { price: { type: 'number', minimum: 0, example: 14990 } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Precio actualizado',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Precio inválido (debe ser ≥ 0)' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  updatePlanPrice(@Param('id') id: string, @Body('price') price: number) {
    return this.plansService.updatePrice(id, price);
  }

  @Patch(':id/limits')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({
    summary: 'Reemplazar el jsonb `limits` completo de un plan (admin)',
    description:
      'Sobrescribe `plans.limits`. Recordá que la fuente de verdad es la tabla ' +
      '`plan_limits`; este endpoint es útil para inicializar o sincronizar manualmente.',
  })
  @ApiParam({ name: 'id', type: String, description: 'UUID del plan' })
  @ApiBody({
    schema: {
      type: 'object',
      example: {
        global: { maxShipmentsPerDay: 200, maxStopsPerOptimization: 50 },
        trucking: { max_trucks: 10 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Límites actualizados',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 400, description: 'limits inválido' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  updatePlanLimitsJsonb(
    @Param('id') id: string,
    @Body() limits: PlanLimitsMap,
  ) {
    return this.plansService.updatePlanLimits(id, limits);
  }

  // --- Planes ---
  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({ summary: 'Crear un nuevo plan' })
  @ApiResponse({ status: 201, description: 'Plan creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiBody({
    type: CreatePlanDto,
    examples: {
      basic: {
        summary: 'Plan Básico',
        value: {
          name: 'Starter',
          description: 'Plan para pequeñas empresas de transporte',
          price: 19.99,
          interval: 'month',
          is_active: true,
        },
      },
      premium: {
        summary: 'Plan Premium',
        value: {
          name: 'Business',
          description: 'Plan para empresas con flota mediana',
          price: 49.99,
          interval: 'month',
          is_active: true,
        },
      },
    },
  })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.plansService.createPlan(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('plans.read')
  @ApiOperation({ summary: 'Listar todos los planes' })
  @ApiResponse({ status: 200, description: 'Lista de planes' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  findAllPlans() {
    return this.plansService.findAllPlans();
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('plans.read')
  @ApiOperation({ summary: 'Obtener un plan por ID' })
  @ApiResponse({ status: 200, description: 'Plan encontrado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String })
  findOnePlan(@Param('id') id: string) {
    return this.plansService.findOnePlan(id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({ summary: 'Actualizar un plan por ID' })
  @ApiResponse({ status: 200, description: 'Plan actualizado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({
    type: UpdatePlanDto,
    examples: {
      update: {
        summary: 'Actualizar nombre y precio',
        value: {
          name: 'Starter Plus',
          price: 24.99,
        },
      },
    },
  })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.updatePlan(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({ summary: 'Eliminar un plan por ID' })
  @ApiResponse({ status: 200, description: 'Plan eliminado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String })
  removePlan(@Param('id') id: string) {
    return this.plansService.removePlan(id);
  }

  // --- Plan Limits ---
  @Post(':planId/limits')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({ summary: 'Crear un límite para un plan' })
  @ApiResponse({
    status: 201,
    description: 'Límite creado exitosamente',
    type: PlanLimitResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (vertical/code vacío, value < 0)',
  })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un límite con ese vertical+code para este plan',
  })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'planId', type: String, description: 'UUID del plan' })
  @ApiBody({
    type: CreatePlanLimitDto,
    examples: {
      trucking: {
        summary: 'Límite de camiones',
        value: { vertical: 'trucking', code: 'max_trucks', value: 10 },
      },
      delivery: {
        summary: 'Límite de conductores',
        value: { vertical: 'delivery', code: 'max_drivers', value: 5 },
      },
    },
  })
  createPlanLimit(
    @Param('planId') planId: string,
    @Body() dto: CreatePlanLimitDto,
  ) {
    return this.plansService.createPlanLimit(planId, dto);
  }

  @Get(':planId/limits')
  @UseGuards(PermissionGuard)
  @Permissions('plans.read')
  @ApiOperation({ summary: 'Listar límites de un plan' })
  @ApiResponse({
    status: 200,
    description: 'Lista de límites del plan',
    type: [PlanLimitResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'planId', type: String, description: 'UUID del plan' })
  findPlanLimits(@Param('planId') planId: string) {
    return this.plansService.findPlanLimits(planId);
  }

  @Patch('limits/:id')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({ summary: 'Actualizar un límite de plan' })
  @ApiResponse({
    status: 200,
    description: 'Límite actualizado exitosamente',
    type: PlanLimitResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Límite no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe otro límite con ese vertical+code para este plan',
  })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String, description: 'UUID del límite' })
  @ApiBody({
    type: UpdatePlanLimitDto,
    examples: {
      updateValue: {
        summary: 'Actualizar sólo el valor',
        value: { value: 50 },
      },
      updateAll: {
        summary: 'Actualizar vertical, code y value',
        value: { vertical: 'trucking', code: 'max_routes', value: 100 },
      },
    },
  })
  updatePlanLimit(@Param('id') id: string, @Body() dto: UpdatePlanLimitDto) {
    return this.plansService.updatePlanLimit(id, dto);
  }

  @Delete('limits/:id')
  @UseGuards(PermissionGuard)
  @Permissions('plans.write')
  @ApiOperation({ summary: 'Eliminar un límite de plan' })
  @ApiResponse({
    status: 200,
    description: 'Límite eliminado',
    schema: { example: { deleted: true } },
  })
  @ApiResponse({ status: 404, description: 'Límite no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiParam({ name: 'id', type: String, description: 'UUID del límite' })
  removePlanLimit(@Param('id') id: string) {
    return this.plansService.removePlanLimit(id);
  }
}
