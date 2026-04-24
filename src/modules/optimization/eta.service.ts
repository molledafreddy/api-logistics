import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { TrackingPoint } from '../tracking/entities/tracking-point.entity';

import { HaversineOptimizer } from './strategies/haversine.optimizer';
import { EtaResponseDto, EtaStopDto } from './dto';

import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

/**
 * EtaService — calcula ETA en vivo por stop de un DeliveryRun.
 *
 * Estrategia:
 *   1. Localizar el último GPS del run (vía truckId del run → último TrackingPoint).
 *   2. Tomar la `optimizedSequence` y filtrar los stops aún pendientes
 *      (status no DELIVERED). Los completados se marcan `state='completed'` con eta=null.
 *   3. Para cada stop pendiente, sumar distancias haversine acumuladas desde
 *      el origen vivo y calcular ETA = now + Σ(dur).
 *
 * Si no hay GPS reciente (< 30 min), se usa el primer stop pendiente como ancla.
 * Si el run no está IN_PROGRESS, se devuelven los ETAs precalculados de
 * `etaPerStop` con `etaAt=null` (planificación, no ejecución).
 */
@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);

  /** Velocidad asumida (km/h) cuando no se puede inferir del GPS. */
  private static readonly DEFAULT_AVG_SPEED_KMH = 35;
  private static readonly DEFAULT_SERVICE_MIN = 5;
  private static readonly GPS_FRESHNESS_MIN = 30;

  constructor(
    @InjectRepository(DeliveryRun)
    private readonly runRepo: Repository<DeliveryRun>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(TrackingPoint)
    private readonly trackingRepo: Repository<TrackingPoint>,
  ) {}

  async computeLive(
    runId: string,
    user: IUserPayload,
  ): Promise<EtaResponseDto> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException(`DeliveryRun ${runId} not found`);

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== run.companyId
    ) {
      throw new ForbiddenException('Cannot read ETAs of foreign runs');
    }

    const sequence = run.optimizedSequence ?? [];
    if (sequence.length === 0) {
      return {
        runId: run.id,
        origin: { lat: 0, lng: 0, source: 'unknown' },
        computedAt: null,
        stops: [],
      };
    }

    const shipments = await this.shipmentRepo.find({
      where: { deliveryRunId: runId },
    });
    const byId = new Map(shipments.map((s) => [s.id, s]));

    // Origen
    let originLat = 0;
    let originLng = 0;
    let originSource: 'gps' | 'first_stop' | 'unknown' = 'unknown';

    if (run.truckId && run.status === DeliveryRunStatus.IN_PROGRESS) {
      const lastGps = await this.trackingRepo
        .createQueryBuilder('tp')
        .where('tp.truck_id = :tid', { tid: run.truckId })
        .orderBy('tp.captured_at', 'DESC')
        .limit(1)
        .getOne();
      const fresh =
        lastGps &&
        Date.now() - new Date(lastGps.capturedAt).getTime() <
          EtaService.GPS_FRESHNESS_MIN * 60_000;
      if (fresh) {
        originLat = Number(lastGps.lat);
        originLng = Number(lastGps.lng);
        originSource = 'gps';
      }
    }

    if (originSource === 'unknown') {
      // Fallback: primer stop con coord (anclaje)
      for (const sid of sequence) {
        const s = byId.get(sid);
        if (s?.destinationLat && s?.destinationLng) {
          originLat = Number(s.destinationLat);
          originLng = Number(s.destinationLng);
          originSource = 'first_stop';
          break;
        }
      }
    }

    const computedAt = new Date();
    const stops: EtaStopDto[] = [];
    let cursorLat = originLat;
    let cursorLng = originLng;
    let cumulativeMinutes = 0;
    let cumulativeKm = 0;

    let order = 1;
    for (const sid of sequence) {
      const s = byId.get(sid);
      if (!s) {
        order++;
        continue;
      }
      const isCompleted =
        s.status === ShipmentStatus.DELIVERED ||
        s.status === ShipmentStatus.INCIDENT;

      if (isCompleted) {
        stops.push({
          shipmentId: sid,
          order,
          etaAt: null,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          state: 'completed',
        });
        order++;
        continue;
      }

      if (!s.destinationLat || !s.destinationLng) {
        stops.push({
          shipmentId: sid,
          order,
          etaAt: null,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          state: 'pending',
        });
        order++;
        continue;
      }

      const destLat = Number(s.destinationLat);
      const destLng = Number(s.destinationLng);
      const segKm = HaversineOptimizer.distanceKm(
        { lat: cursorLat, lng: cursorLng },
        { lat: destLat, lng: destLng },
      );
      const segMin =
        (segKm / EtaService.DEFAULT_AVG_SPEED_KMH) * 60 +
        EtaService.DEFAULT_SERVICE_MIN;

      cumulativeKm += segKm;
      cumulativeMinutes += segMin;

      const etaAt =
        originSource === 'gps'
          ? new Date(computedAt.getTime() + cumulativeMinutes * 60_000)
          : null;

      stops.push({
        shipmentId: sid,
        order,
        etaAt,
        remainingDistanceKm: round2(cumulativeKm),
        remainingDurationMin: round2(cumulativeMinutes),
        state: 'pending',
      });

      cursorLat = destLat;
      cursorLng = destLng;
      order++;
    }

    return {
      runId: run.id,
      origin: { lat: originLat, lng: originLng, source: originSource },
      computedAt,
      stops,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
