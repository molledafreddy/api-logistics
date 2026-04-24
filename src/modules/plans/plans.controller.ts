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
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreatePermissionDefinitionDto } from './dto/create-permission-definition.dto';
import { UpdatePermissionDefinitionDto } from './dto/update-permission-definition.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // LOG para saber si la petición llega al controlador
  private logRequest(method: string, extra?: any) {
    console.log(`[PLANS_CONTROLLER] ${method} llamada`, extra || '');
  }

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
    this.logRequest('POST /plans', dto);
    console.log('[PLANS_CONTROLLER] Antes de llamar a plansService.createPlan');
    const result = this.plansService.createPlan(dto);
    console.log(
      '[PLANS_CONTROLLER] Resultado de plansService.createPlan',
      result,
    );
    return result;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('plans.read')
  @ApiOperation({ summary: 'Listar todos los planes' })
  @ApiResponse({ status: 200, description: 'Lista de planes' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  findAllPlans() {
    this.logRequest('GET /plans');
    console.log(
      '[PLANS_CONTROLLER] Antes de llamar a plansService.findAllPlans',
    );
    const result = this.plansService.findAllPlans();
    console.log(
      '[PLANS_CONTROLLER] Resultado de plansService.findAllPlans',
      result,
    );
    return result;
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
    this.logRequest('GET /plans/:id', id);
    console.log(
      '[PLANS_CONTROLLER] Antes de llamar a plansService.findOnePlan',
    );
    const result = this.plansService.findOnePlan(id);
    console.log(
      '[PLANS_CONTROLLER] Resultado de plansService.findOnePlan',
      result,
    );
    return result;
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
}
