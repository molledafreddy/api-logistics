import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';

import { HaversineOptimizer } from './strategies/haversine.optimizer';
import { GoogleRoutesOptimizer } from './strategies/google-routes.optimizer';
import { MapboxOptimizationProvider } from './strategies/mapbox.optimizer';
import { NearestNeighborTwoOptOptimizer } from './strategies/nearest-neighbor-2opt.optimizer';
import {
  IRouteOptimizer,
  LatLng,
  OptimizationInput,
  OptimizationResult,
  OptimizationStop,
} from './optimization.types';
import { OptimizeRunDto } from './dto';

import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

/**
 * OptimizationService — orquesta la optimización de la secuencia de stops
 * de un DeliveryRun.
 *
 * Reglas de negocio (Sprint 7):
 *   OPT-001 Solo runs en estado `planned` o `ready` pueden ser optimizados.
 *   OPT-002 Requiere ≥ 2 stops con coordenadas (destination_lat, destination_lng).
 *   OPT-003 La empresa dueña del run (companyId) es la única autorizada (o SUPER_ADMIN).
 *   OPT-004 Provider por defecto = OPTIMIZATION_DEFAULT_PROVIDER (env, fallback 'haversine').
 *   OPT-005 Si el provider remoto falla, se hace fallback transparente a Haversine.
 *
 * El resultado se persiste en `delivery_runs`:
 *   optimizedSequence, estimatedDistanceKm, estimatedDurationMin,
 *   optimizedAt, optimizationProvider, etaPerStop.
 */
@Injectable()
export class OptimizationService {
  private readonly logger = new Logger(OptimizationService.name);

  constructor(
    @InjectRepository(DeliveryRun)
    private readonly runRepo: Repository<DeliveryRun>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    private readonly haversine: HaversineOptimizer,
    private readonly googleRoutes: GoogleRoutesOptimizer,
    private readonly mapbox: MapboxOptimizationProvider,
    private readonly nn2opt: NearestNeighborTwoOptOptimizer,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async optimizeRun(
    runId: string,
    dto: OptimizeRunDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException(`DeliveryRun ${runId} not found`);

    // OPT-003 — Authorization
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== run.companyId
    ) {
      throw new ForbiddenException('OPT-003: cannot optimize foreign runs');
    }

    // OPT-001 — Estado
    if (
      run.status !== DeliveryRunStatus.PLANNED &&
      run.status !== DeliveryRunStatus.READY
    ) {
      throw new BadRequestException(
        `OPT-001: cannot optimize run in status '${run.status}'`,
      );
    }

    // Carga shipments del run
    const shipments = await this.shipmentRepo.find({
      where: { deliveryRunId: runId },
    });
    if (shipments.length < 2) {
      throw new BadRequestException(
        'OPT-002: run requires at least 2 shipments to optimize',
      );
    }

    // Sprint C — validación blanda: si algún shipment del run no tiene
    // coordenadas, devolvemos 422 con la lista exacta para que el frontend
    // pueda guiar al operador a completarlas (autocomplete o drop-pin).
    const missingCoords = shipments.filter(
      (s) => !s.destinationLat || !s.destinationLng,
    );
    if (missingCoords.length > 0) {
      throw new UnprocessableEntityException({
        code: 'OPT-002',
        message:
          'Algunos shipments del run no tienen coordenadas de destino. ' +
          'Use /v1/geocoding/search o /v1/geocoding/reverse para completarlas.',
        missingShipments: missingCoords.map((s) => ({
          id: s.id,
          trackingCode: s.trackingCode,
          destinationAddress: s.destinationAddress,
        })),
      });
    }

    const stops = this.buildStops(shipments);
    if (stops.length < 2) {
      throw new BadRequestException(
        'OPT-002: at least 2 shipments must have destination coordinates',
      );
    }

    // OPT-004 — Provider
    const providerName =
      dto.provider ??
      (this.config.get<string>('OPTIMIZATION_DEFAULT_PROVIDER') as
        | 'haversine'
        | 'google_routes'
        | 'mapbox') ??
      'haversine';
    const optimizer = this.pickOptimizer(providerName);

    // Origin: usa el primer shipment con coordenadas como warehouse implícito.
    // En el futuro, leer del Truck o de Company.headquarters.
    const origin: LatLng =
      this.firstWithOrigin(shipments) ?? stops[0].destination;

    const input: OptimizationInput = {
      origin,
      stops,
      avgSpeedKmh: dto.avgSpeedKmh,
      serviceTimePerStopMin: dto.serviceTimePerStopMin,
    };

    const result = await optimizer.optimize(input);

    // Persistencia
    run.optimizedSequence = result.sequence.map((s) => s.shipmentId);
    run.estimatedDistanceKm = String(result.totalDistanceKm);
    run.estimatedDurationMin = Math.round(result.totalDurationMin);
    run.optimizedAt = new Date();
    run.optimizationProvider = result.provider;
    run.etaPerStop = result.sequence.map((s) => ({
      shipmentId: s.shipmentId,
      etaAt: null, // se computa on-the-fly cuando arranca el run (EtaService)
      distanceFromPrevKm: s.distanceFromPrevKm,
      durationFromPrevMin: s.durationFromPrevMin,
    }));
    const saved = await this.runRepo.save(run);

    // Sync runSequence on each shipment so stops are returned in the optimized order
    let pos = 1;
    for (const sid of run.optimizedSequence) {
      await this.shipmentRepo.update({ id: sid }, { runSequence: pos++ });
    }

    this.eventEmitter.emit(INTERNAL_EVENTS.DELIVERY_RUN_OPTIMIZED, {
      runId: saved.id,
      companyId: saved.companyId,
      provider: result.provider,
      totalStops: result.sequence.length,
      totalDistanceKm: result.totalDistanceKm,
      totalDurationMin: result.totalDurationMin,
      fellBackToHaversine: result.fellBackToHaversine ?? false,
      optimizedAt: saved.optimizedAt,
    });

    this.logger.log(
      `DeliveryRun ${saved.id} optimized via ${result.provider} ` +
        `(${result.sequence.length} stops, ${result.totalDistanceKm} km, ${Math.round(result.totalDurationMin)} min)` +
        (result.fellBackToHaversine ? ' [fallback]' : ''),
    );

    return saved;
  }

  // ─── Helpers ──────────────────────────
  private pickOptimizer(
    provider: OptimizationResult['provider'],
  ): IRouteOptimizer {
    switch (provider) {
      case 'google_routes':
        return this.googleRoutes;
      case 'mapbox':
        return this.mapbox;
      case 'nn_2opt':
        return this.nn2opt;
      case 'haversine':
      default:
        return this.haversine;
    }
  }

  private buildStops(shipments: Shipment[]): OptimizationStop[] {
    const out: OptimizationStop[] = [];
    for (const s of shipments) {
      if (s.destinationLat && s.destinationLng) {
        out.push({
          shipmentId: s.id,
          destination: {
            lat: Number(s.destinationLat),
            lng: Number(s.destinationLng),
          },
          desiredAt: s.deliveryAt,
        });
      }
    }
    return out;
  }

  private firstWithOrigin(shipments: Shipment[]): LatLng | null {
    for (const s of shipments) {
      if (s.originLat && s.originLng) {
        return { lat: Number(s.originLat), lng: Number(s.originLng) };
      }
    }
    return null;
  }
}
