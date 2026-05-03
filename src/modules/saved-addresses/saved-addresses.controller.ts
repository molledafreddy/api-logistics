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

import { SavedAddressesService } from './saved-addresses.service';
import {
  CreateSavedAddressDto,
  UpdateSavedAddressDto,
  QuerySavedAddressDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

/**
 * Sprint C.5 — Endpoints CRUD de favoritos por compañía.
 *
 * Mismo guard JWT que el resto de la API; además gating por roles para
 * mutaciones (lectura abierta a cualquier usuario con compañía).
 */
@ApiTags('Saved Addresses')
@ApiBearerAuth()
@Controller('saved-addresses')
export class SavedAddressesController {
  constructor(private readonly service: SavedAddressesService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Crear dirección favorita' })
  @ApiResponse({ status: 201, description: 'Favorito creado' })
  @ApiResponse({ status: 409, description: 'SAV-002: label duplicado' })
  create(
    @Body() dto: CreateSavedAddressDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar favoritos (paginado)' })
  findAll(
    @Query() query: QuerySavedAddressDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener favorito por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Actualizar favorito' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedAddressDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
  )
  @ApiOperation({ summary: 'Eliminar favorito (soft delete)' })
  @ApiResponse({ status: 204, description: 'Favorito eliminado' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.remove(id, user);
  }
}
