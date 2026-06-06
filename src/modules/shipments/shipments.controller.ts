import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { ShipmentsService } from './shipments.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  QueryShipmentDto,
  UpdateShipmentStatusDto,
  AssignShipmentDto,
  CancelShipmentDto,
  UploadPodDto,
  AcceptShipmentDto,
  RejectShipmentDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Shipments')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Crear shipment' })
  @ApiResponse({ status: 201, description: 'Shipment creado' })
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: IUserPayload) {
    return this.shipmentsService.create(dto, user);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Listar shipments' })
  findAll(@Query() query: QueryShipmentDto, @CurrentUser() user: IUserPayload) {
    return this.shipmentsService.findAll(query, user);
  }

  @Get('tracking/:code')
  @Public()
  @ApiOperation({ summary: 'Buscar shipment por tracking code (público)' })
  @ApiResponse({ status: 200, description: 'Shipment encontrado' })
  findByTrackingCode(@Param('code') code: string) {
    return this.shipmentsService.findByTrackingCode(code);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Obtener shipment por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.findOne(id, user);
  }

  @Get(':id/timeline')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Obtener línea de tiempo del shipment' })
  getTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.getTimeline(id, user);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Actualizar shipment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Cambiar estado del shipment (workflow validado)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.updateStatus(id, dto.status, user);
  }

  @Patch(':id/assign')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Asignar truck/driver/route al shipment' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignShipmentDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.assign(id, dto, user);
  }

  @Patch(':id/cancel')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Cancelar shipment' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelShipmentDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.cancel(id, dto.reason, user);
  }

  @Post(':id/accept')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({
    summary: 'Aceptar un envío en pending_acceptance (solo carrier)',
    description:
      'El carrier acepta una propuesta de envío del cliente. ' +
      'Cambia status a CONFIRMED y notifica al cliente. ' +
      'Solo válido cuando el envío está en pending_acceptance.',
  })
  @ApiResponse({ status: 200, description: 'Envío aceptado y confirmado' })
  @ApiResponse({ status: 400, description: 'No está en pending_acceptance' })
  @ApiResponse({ status: 403, description: 'No eres el carrier del envío' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptShipmentDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.accept(id, dto, user);
  }

  @Post(':id/reject')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({
    summary: 'Rechazar un envío en pending_acceptance (solo carrier)',
    description:
      'El carrier rechaza una propuesta. Cambia status a CANCELLED, ' +
      'guarda razón en rejection_reason y notifica al cliente.',
  })
  @ApiResponse({ status: 200, description: 'Envío rechazado y cancelado' })
  @ApiResponse({ status: 400, description: 'No está en pending_acceptance' })
  @ApiResponse({ status: 403, description: 'No eres el carrier del envío' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectShipmentDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.reject(id, dto, user);
  }

  @Post(':id/pod')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Subir POD (Proof of Delivery)' })
  uploadPod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadPodDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.uploadPod(id, dto, user);
  }

  @Patch(':id/complete')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({ summary: 'Marcar shipment como completado' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.complete(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar shipment (solo draft o cancelled)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.shipmentsService.remove(id, user);
  }
}
