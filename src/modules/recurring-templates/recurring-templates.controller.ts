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
import { RecurringTemplatesService } from './recurring-templates.service';
import {
  CreateRecurringTemplateDto,
  UpdateRecurringTemplateDto,
  GenerateRecurringTemplateDto,
  QueryRecurringTemplateDto,
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

@ApiTags('RecurringTemplates')
@ApiBearerAuth()
@Controller('recurring-templates')
export class RecurringTemplatesController {
  constructor(private readonly service: RecurringTemplatesService) {}

  // 1
  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Crear plantilla de recurrencia' })
  @ApiResponse({ status: 201 })
  create(
    @Body() dto: CreateRecurringTemplateDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.create(dto, user);
  }

  // 2
  @Get()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Listar plantillas (filtros + paginación)' })
  findAll(
    @Query() query: QueryRecurringTemplateDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.findAll(query, user);
  }

  // 3
  @Get(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Detalle de plantilla' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.findOne(id, user);
  }

  // 4
  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Editar plantilla (RT-003: no afecta runs ya generados)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringTemplateDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  // 5
  @Post(':id/generate')
  @Roles(...MANAGER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Forzar generación manual para una fecha específica. RT-002: idempotente.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Devuelve `{ runId, shipmentIds, skipped, skipReason? }`. Si ya existía run no-cancelado para esa fecha, devuelve el existente con `skipped=true`.',
  })
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateRecurringTemplateDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.generateForDate(id, dto.date, user);
  }

  // 6
  @Post(':id/pause')
  @Roles(...MANAGER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pausar plantilla (RT-004) — active = false' })
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.pause(id, user);
  }

  // 7
  @Post(':id/resume')
  @Roles(...MANAGER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reanudar plantilla (RT-004) — active = true' })
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.resume(id, user);
  }

  // 8
  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete (RT-005: runs históricos se conservan)',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.remove(id, user);
  }
}
