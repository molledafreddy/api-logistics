import {
  Controller,
  Get,
  Post,
  Put,
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
import { UsersService } from './users.service';
import {
  InviteUserDto,
  AcceptInviteDto,
  UpdateUserDto,
  UpdateUserRoleDto,
  QueryUserDto,
} from './dto/index';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Users (Team)')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios de la empresa' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async findAll(
    @Query() query: QueryUserDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.usersService.findAll(query, user);
  }

  @Post('invite')
  @Roles(UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Invitar usuario al equipo' })
  @ApiResponse({ status: 201, description: 'Invitación enviada' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async invite(@Body() dto: InviteUserDto, @CurrentUser() user: IUserPayload) {
    return this.usersService.invite(dto, user);
  }

  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar invitación (público, con token)' })
  @ApiResponse({ status: 200, description: 'Invitación aceptada' })
  @ApiResponse({ status: 400, description: 'Invitación expirada' })
  @ApiResponse({ status: 404, description: 'Invitación no encontrada' })
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de usuario' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.usersService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Put(':id/role')
  @Roles(UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cambiar rol de usuario' })
  @ApiResponse({ status: 200, description: 'Rol actualizado' })
  @ApiResponse({ status: 403, description: 'Sin permisos' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.usersService.updateRole(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar usuario' })
  @ApiResponse({ status: 200, description: 'Usuario desactivado' })
  @ApiResponse({ status: 403, description: 'Sin permisos o es el owner' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.usersService.deactivate(id, user);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.COMPANY_OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivar usuario' })
  @ApiResponse({ status: 200, description: 'Usuario reactivado' })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.usersService.reactivate(id, user);
  }
}
