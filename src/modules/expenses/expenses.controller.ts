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
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  QueryExpenseDto,
  RejectExpenseDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Crear gasto' })
  @ApiResponse({ status: 201, description: 'Gasto creado' })
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: IUserPayload) {
    return this.expensesService.create(dto, user);
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
  )
  @ApiOperation({ summary: 'Listar gastos' })
  findAll(@Query() query: QueryExpenseDto, @CurrentUser() user: IUserPayload) {
    return this.expensesService.findAll(query, user);
  }

  @Get('summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Resumen de gastos por categoría/status' })
  summary(@Query() query: QueryExpenseDto, @CurrentUser() user: IUserPayload) {
    return this.expensesService.getSummary(query, user);
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
  )
  @ApiOperation({ summary: 'Obtener gasto por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.expensesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Actualizar gasto (solo si está pending)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.expensesService.update(id, dto, user);
  }

  @Patch(':id/approve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Aprobar gasto' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.expensesService.approve(id, user);
  }

  @Patch(':id/reject')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Rechazar gasto' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.expensesService.reject(id, dto.reason, user);
  }

  @Patch(':id/reimburse')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Marcar gasto como reembolsado' })
  reimburse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.expensesService.reimburse(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Eliminar gasto (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.expensesService.remove(id, user);
  }
}
