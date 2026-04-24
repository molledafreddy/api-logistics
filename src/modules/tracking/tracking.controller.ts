import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import {
  CreateTrackingPointDto,
  BulkTrackingPointsDto,
  QueryTrackingDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('points')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Registrar un punto de tracking' })
  @ApiResponse({ status: 201, description: 'Punto registrado' })
  create(
    @Body() dto: CreateTrackingPointDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trackingService.create(dto, user);
  }

  @Post('points/bulk')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Registrar puntos en lote (hasta 500)' })
  bulk(@Body() dto: BulkTrackingPointsDto, @CurrentUser() user: IUserPayload) {
    return this.trackingService.createBulk(dto, user);
  }

  @Get('points')
  @ApiOperation({ summary: 'Consultar puntos de tracking (filtrable)' })
  query(@Query() query: QueryTrackingDto, @CurrentUser() user: IUserPayload) {
    return this.trackingService.query(query, user);
  }

  @Get('shipments/:id/latest')
  @ApiOperation({ summary: 'Obtener último punto de un shipment' })
  latestShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trackingService.getLatestForShipment(id, user);
  }

  @Get('trucks/:id/latest')
  @ApiOperation({ summary: 'Obtener último punto de un truck' })
  latestTruck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.trackingService.getLatestForTruck(id, user);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Estadísticas (distancia, vel. promedio, vel. máx) de un rango',
  })
  stats(@Query() query: QueryTrackingDto, @CurrentUser() user: IUserPayload) {
    return this.trackingService.getStats(query, user);
  }
}
