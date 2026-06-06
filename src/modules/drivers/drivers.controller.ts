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
import { DriversService } from './drivers.service';
import {
  CreateDriverDto,
  UpdateDriverDto,
  QueryDriverDto,
  UpdateDriverStatusDto,
  InviteDriverDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Crear driver' })
  @ApiResponse({ status: 201, description: 'Driver creado' })
  @ApiResponse({ status: 409, description: 'Licencia ya registrada' })
  create(@Body() dto: CreateDriverDto, @CurrentUser() user: IUserPayload) {
    return this.driversService.create(dto, user);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Listar drivers' })
  findAll(@Query() query: QueryDriverDto, @CurrentUser() user: IUserPayload) {
    return this.driversService.findAll(query, user);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Obtener driver por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.findOne(id, user);
  }

  @Get(':id/current-trip')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Obtener viaje actual del driver' })
  getCurrentTrip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.getCurrentTrip(id, user);
  }

  @Get(':id/stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Estadísticas del driver' })
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.getStats(id, user);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Actualizar driver' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Cambiar estado del driver' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverStatusDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.updateStatus(id, dto.status, user);
  }

  @Post(':id/invite')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({
    summary: 'Invitar conductor a crear su cuenta de acceso',
    description:
      'Crea un usuario pendiente de verificación vinculado al driver y devuelve el token de activación. ' +
      'El conductor usa ese token en la pantalla de activación de la app para establecer su contraseña.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitación creada — devuelve token de activación',
  })
  @ApiResponse({
    status: 409,
    description: 'Driver ya tiene cuenta o email en uso',
  })
  inviteDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteDriverDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.inviteDriver(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar driver (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.driversService.remove(id, user);
  }
}
