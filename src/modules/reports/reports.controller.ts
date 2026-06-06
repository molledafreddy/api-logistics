import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto, ShipmentReportQueryDto, ReportFormat } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ACCOUNTANT,
)
@Permissions('reports.advanced')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('shipments')
  @ApiOperation({ summary: 'Reporte de shipments (JSON o CSV)' })
  async shipments(
    @Query() query: ShipmentReportQueryDto,
    @CurrentUser() user: IUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reportsService.shipments(query, user);
    return this.respond(res, data, query.format, 'shipments');
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Reporte de gastos (JSON o CSV)' })
  async expenses(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: IUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reportsService.expenses(query, user);
    return this.respond(res, data, query.format, 'expenses');
  }

  @Get('drivers/performance')
  @ApiOperation({ summary: 'Reporte de performance de drivers' })
  async driversPerformance(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: IUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reportsService.driversPerformance(query, user);
    return this.respond(res, data, query.format, 'drivers-performance');
  }

  @Get('financial-summary')
  @ApiOperation({ summary: 'Resumen financiero (revenue vs expenses)' })
  financialSummary(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.reportsService.financialSummary(query, user);
  }

  // ─── helper ─────────────────
  private respond(
    res: Response,
    data: Array<Record<string, unknown>>,
    format: ReportFormat | undefined,
    filename: string,
  ) {
    if (format === ReportFormat.CSV) {
      const csv = this.reportsService.toCsv(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}-${Date.now()}.csv"`,
      );
      res.send(csv);
      return;
    }
    return data;
  }
}
