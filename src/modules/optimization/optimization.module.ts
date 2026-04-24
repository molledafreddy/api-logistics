import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { TrackingPoint } from '../tracking/entities/tracking-point.entity';

import { OptimizationService } from './optimization.service';
import { EtaService } from './eta.service';
import { OptimizationController } from './optimization.controller';
import { HaversineOptimizer } from './strategies/haversine.optimizer';
import { GoogleRoutesOptimizer } from './strategies/google-routes.optimizer';

/**
 * OptimizationModule (PARTE 7 · Sprint 7).
 *
 * Expone:
 *   POST /v1/delivery-runs/:id/optimize  → OptimizationService.optimizeRun
 *   GET  /v1/delivery-runs/:id/etas      → EtaService.computeLive
 *
 * Strategy pattern: HaversineOptimizer (default) y GoogleRoutesOptimizer (stub
 * con fallback). Activar Google Routes con env var `OPTIMIZATION_DEFAULT_PROVIDER=google_routes`
 * y `GOOGLE_ROUTES_API_KEY=…`.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([DeliveryRun, Shipment, TrackingPoint]),
  ],
  controllers: [OptimizationController],
  providers: [
    HaversineOptimizer,
    GoogleRoutesOptimizer,
    OptimizationService,
    EtaService,
  ],
  exports: [OptimizationService, EtaService, HaversineOptimizer],
})
export class OptimizationModule {}
