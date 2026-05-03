import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { OptimizationLimitsGuard } from './optimization-limits.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { OptimizationService } from './optimization.service';
import { EtaService } from './eta.service';
import { OptimizeRunDto, EtaResponseDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Optimization')
@ApiBearerAuth()
@Controller('delivery-runs')
export class OptimizationController {
  constructor(
    private readonly optimization: OptimizationService,
    private readonly eta: EtaService,
  ) {}

  @Post(':id/optimize')
  @UseGuards(OptimizationLimitsGuard)
  @ApiOperation({
    summary: 'Optimiza la secuencia de stops del run (Sprint 7)',
    description:
      'Reordena `optimizedSequence`, calcula `estimatedDistanceKm`/`estimatedDurationMin`, ' +
      'y persiste el detalle por stop en `etaPerStop`. Provider configurable (haversine | google_routes | mapbox). ' +
      'Reglas: OPT-001 (estado planned/ready), OPT-002 (≥2 stops con coords), OPT-003 (carrier dueño).',
  })
  @ApiResponse({
    status: 200,
    description: 'DeliveryRun actualizado con la nueva secuencia',
  })
  @ApiResponse({
    status: 400,
    description: 'Estado inválido o sin coordenadas suficientes',
  })
  @ApiResponse({ status: 403, description: 'OPT-003 — run de otra empresa' })
  @ApiResponse({ status: 404, description: 'DeliveryRun no encontrado' })
  optimize(
    @Param('id') id: string,
    @Body() dto: OptimizeRunDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.optimization.optimizeRun(id, dto, user);
  }

  @Get(':id/etas')
  @ApiOperation({
    summary: 'ETAs en vivo por stop (último GPS conocido del truck)',
    description:
      'Calcula ETA pendientes restantes para los stops del run. Si el run está IN_PROGRESS, ' +
      'usa el último TrackingPoint del truck como origen; de lo contrario el primer stop pendiente. ' +
      'Stops ya entregados aparecen con `state=completed` y `etaAt=null`.',
  })
  @ApiResponse({ status: 200, type: EtaResponseDto })
  @ApiResponse({ status: 403, description: 'Run de otra empresa' })
  @ApiResponse({ status: 404, description: 'DeliveryRun no encontrado' })
  etas(@Param('id') id: string, @CurrentUser() user: IUserPayload) {
    return this.eta.computeLive(id, user);
  }
}
