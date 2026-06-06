import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DeliveryRunsService } from './delivery-runs.service';
import {
  CreateDeliveryRunDto,
  UpdateDeliveryRunDto,
  AssignRunDriverDto,
  ShipmentIdsDto,
  ReorderDto,
  CancelDeliveryRunDto,
  StopDoneDto,
  StopIncidentDto,
  QueryDeliveryRunDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

const MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.DISPATCHER,
] as const;

const MANAGER_OR_DRIVER = [...MANAGER_ROLES, UserRole.DRIVER] as const;

@ApiTags('DeliveryRuns')
@ApiBearerAuth()
@Controller('delivery-runs')
export class DeliveryRunsController {
  constructor(private readonly service: DeliveryRunsService) {}

  // 1
  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Crear un DeliveryRun (opcionalmente con shipmentIds)',
  })
  @ApiResponse({ status: 201, description: 'Run creado' })
  create(@Body() dto: CreateDeliveryRunDto, @CurrentUser() user: IUserPayload) {
    return this.service.create(dto, user);
  }

  // 2
  @Get()
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Listar runs (filtros + paginación)' })
  findAll(
    @Query() query: QueryDeliveryRunDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.findAll(query, user);
  }

  // 3
  @Get(':id')
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Detalle del run con shipments expandidos' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.findOne(id, user);
  }

  @Get(':id/assignable-drivers')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Drivers asignables al run (propios + empresas partner activas)',
    description:
      'Devuelve conductores de la empresa carrier del run más los de empresas con ' +
      'relación covered_carrier o associated_company en estado accepted. ' +
      'Solo accesible con plan de empresa (roles MANAGER o superior).',
  })
  getAssignableDrivers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.getAssignableDrivers(id, user);
  }

  // 4
  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Editar nombre / fecha / turno' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryRunDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  // 5
  @Patch(':id/assign-driver')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Asignar / cambiar driver y/o truck (DR-005, DR-006)',
  })
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRunDriverDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.assignDriver(id, dto, user);
  }

  // 6
  @Post(':id/add-shipments')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Agregar shipments al run (DR-001)' })
  addShipments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipmentIdsDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.addShipments(id, dto, user);
  }

  // 7
  @Post(':id/remove-shipments')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Quitar shipments del run' })
  removeShipments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipmentIdsDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.removeShipments(id, dto, user);
  }

  // 8
  @Patch(':id/reorder')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Reordenar la secuencia de stops (DR-007, DR-008)' })
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.reorder(id, dto, user);
  }

  // 9
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Iniciar el run → in_progress (DR-003)' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.start(id, user);
  }

  // 10
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({
    summary:
      'Cerrar el run (manual, también es automático al completar todos los stops)',
  })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.complete(id, user);
  }

  // 11
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Cancelar el run (libera shipments no entregados)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDeliveryRunDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.cancel(id, dto, user);
  }

  // 12-A
  @Post(':id/stops/:shipmentId/done')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Cerrar un stop como entregado (DR-004)' })
  stopDone(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: StopDoneDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.stopDone(id, shipmentId, dto, user);
  }

  // 12-B
  @Post(':id/stops/:shipmentId/start-transit')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Marcar stop en tránsito → in_transit' })
  stopStartTransit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.stopStartTransit(id, shipmentId, user);
  }

  // 12-B2
  @Post(':id/stops/:shipmentId/arrive')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Confirmar llegada al stop → at_stop' })
  stopArrive(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.stopArrive(id, shipmentId, user);
  }

  // 12-C
  @Post(':id/stops/:shipmentId/incident')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGER_OR_DRIVER)
  @ApiOperation({ summary: 'Reportar incidente en un stop' })
  stopIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: StopIncidentDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.stopIncident(id, shipmentId, dto, user);
  }
}
