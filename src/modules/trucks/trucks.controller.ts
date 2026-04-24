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
import { TrucksService } from './trucks.service';
import {
  CreateTruckDto,
  UpdateTruckDto,
  QueryTruckDto,
  AssignDriverDto,
  UpdateTruckStatusDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Trucks')
@ApiBearerAuth()
@Controller('trucks')
export class TrucksController {
  constructor(private readonly trucksService: TrucksService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Crear camión en la flota' })
  @ApiResponse({ status: 201, description: 'Camión creado' })
  @ApiResponse({
    status: 409,
    description: 'Placa ya registrada en la empresa',
  })
  create(@Body() dto: CreateTruckDto, @CurrentUser() user: IUserPayload) {
    return this.trucksService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar camiones (paginado y filtrable)' })
  @ApiResponse({ status: 200, description: 'Listado de camiones' })
  findAll(@Query() query: QueryTruckDto, @CurrentUser() user: IUserPayload) {
    return this.trucksService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener camión por ID' })
  @ApiResponse({ status: 200, description: 'Camión encontrado' })
  @ApiResponse({ status: 404, description: 'Camión no encontrado' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.findOne(id, user);
  }

  @Get(':id/location')
  @ApiOperation({ summary: 'Obtener última ubicación conocida del camión' })
  @ApiResponse({ status: 200, description: 'Ubicación del camión' })
  getLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.getLocation(id, user);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Actualizar datos del camión' })
  @ApiResponse({ status: 200, description: 'Camión actualizado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTruckDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Cambiar estado del camión' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTruckStatusDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.updateStatus(id, dto.status, user);
  }

  @Patch(':id/assign-driver')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Asignar driver al camión' })
  @ApiResponse({ status: 200, description: 'Driver asignado' })
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDriverDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.assignDriver(id, dto.driverId, user);
  }

  @Patch(':id/unassign-driver')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Quitar driver del camión' })
  @ApiResponse({ status: 200, description: 'Driver removido' })
  unassignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.unassignDriver(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar camión (soft delete)' })
  @ApiResponse({ status: 204, description: 'Camión eliminado' })
  @ApiResponse({
    status: 400,
    description: 'Camión en tránsito, no se puede eliminar',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trucksService.remove(id, user);
  }
}
