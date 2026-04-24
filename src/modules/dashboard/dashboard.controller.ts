import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.DISPATCHER,
)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'KPIs generales del negocio' })
  overview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.dashboardService.overview(query, user);
  }

  @Get('shipments/by-status')
  @ApiOperation({ summary: 'Distribución de shipments por status' })
  shipmentsByStatus(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.dashboardService.shipmentsByStatus(query, user);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Ingresos (sumatoria de shipments completados)' })
  revenue(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.dashboardService.revenue(query, user);
  }

  @Get('expenses/by-category')
  @ApiOperation({ summary: 'Gastos agrupados por categoría' })
  expensesByCategory(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.dashboardService.expensesByCategory(query, user);
  }

  @Get('fleet/utilization')
  @ApiOperation({ summary: 'Utilización de la flota por status' })
  fleetUtilization(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.dashboardService.fleetUtilization(query, user);
  }

  @Get('drivers/top')
  @ApiOperation({ summary: 'Top 10 drivers por viajes y rating' })
  topDrivers(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.dashboardService.topDrivers(query, user);
  }
}
