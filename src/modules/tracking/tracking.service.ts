import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { TrackingPoint } from './entities/tracking-point.entity';
import { Driver } from '../drivers/entities/driver.entity';
import {
  CreateTrackingPointDto,
  BulkTrackingPointsDto,
  QueryTrackingDto,
} from './dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { requireCompanyId } from '../../common/helpers/tenant.helpers';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

interface DriverContext {
  driverId: string;
  truckId: string | null;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(TrackingPoint)
    private readonly trackingRepository: Repository<TrackingPoint>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Resuelve driverId/truckId desde la cuenta autenticada (vía su perfil de
   * Driver) cuando el cliente no los envía explícitamente. El cliente móvil
   * solo conoce lat/lng — no tiene por qué saber su propio driverId/truckId.
   */
  private async resolveDriverContext(
    user: IUserPayload,
  ): Promise<DriverContext | null> {
    const driver = await this.driverRepository.findOne({
      where: { userId: user.sub },
    });
    return driver
      ? { driverId: driver.id, truckId: driver.currentTruckId }
      : null;
  }

  async create(
    dto: CreateTrackingPointDto,
    user: IUserPayload,
  ): Promise<TrackingPoint> {
    const companyId = requireCompanyId(user);

    let truckId = dto.truckId;
    let driverId = dto.driverId;
    if (!dto.shipmentId && !truckId) {
      const context = await this.resolveDriverContext(user);
      truckId ??= context?.truckId ?? undefined;
      driverId ??= context?.driverId;
    }

    if (!dto.shipmentId && !truckId) {
      throw new BadRequestException(
        'shipmentId o truckId son requeridos (o el usuario debe tener un conductor con vehículo asignado)',
      );
    }

    const point = this.trackingRepository.create({
      ...dto,
      truckId,
      driverId,
      companyId,
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
    });

    const saved = await this.trackingRepository.save(point);
    this.eventEmitter.emit(INTERNAL_EVENTS.TRACKING_POINT_CREATED, saved);
    return saved;
  }

  async createBulk(
    dto: BulkTrackingPointsDto,
    user: IUserPayload,
  ): Promise<{ inserted: number }> {
    const companyId = requireCompanyId(user);

    const needsFallback = dto.points.some((p) => !p.shipmentId && !p.truckId);
    const context = needsFallback
      ? await this.resolveDriverContext(user)
      : null;

    const points = dto.points.map((p) =>
      this.trackingRepository.create({
        ...p,
        truckId: p.truckId ?? context?.truckId ?? undefined,
        driverId: p.driverId ?? context?.driverId,
        companyId,
        capturedAt: p.capturedAt ? new Date(p.capturedAt) : new Date(),
      }),
    );

    const saved = await this.trackingRepository.save(points, { chunk: 100 });
    this.eventEmitter.emit(INTERNAL_EVENTS.TRACKING_BULK_CREATED, saved);
    this.logger.log(`Bulk inserted ${points.length} tracking points`);
    return { inserted: points.length };
  }

  async query(
    query: QueryTrackingDto,
    user: IUserPayload,
  ): Promise<TrackingPoint[]> {
    if (!query.shipmentId && !query.truckId && !query.driverId) {
      throw new BadRequestException(
        'At least one of shipmentId, truckId, or driverId is required',
      );
    }

    const qb = this.trackingRepository.createQueryBuilder('tp');

    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyId = requireCompanyId(user);
      qb.andWhere('tp.companyId = :companyId', { companyId });
    }

    if (query.shipmentId)
      qb.andWhere('tp.shipmentId = :sid', { sid: query.shipmentId });
    if (query.truckId) qb.andWhere('tp.truckId = :tid', { tid: query.truckId });
    if (query.driverId)
      qb.andWhere('tp.driverId = :did', { did: query.driverId });
    if (query.from) qb.andWhere('tp.capturedAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('tp.capturedAt <= :to', { to: query.to });

    qb.orderBy('tp.capturedAt', 'ASC').take(query.limit);

    return qb.getMany();
  }

  async getLatestForShipment(
    shipmentId: string,
    user: IUserPayload,
  ): Promise<TrackingPoint | null> {
    const qb = this.trackingRepository
      .createQueryBuilder('tp')
      .where('tp.shipmentId = :sid', { sid: shipmentId });

    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyId = requireCompanyId(user);
      qb.andWhere('tp.companyId = :companyId', { companyId });
    }

    return qb.orderBy('tp.capturedAt', 'DESC').getOne();
  }

  async getLatestForTruck(
    truckId: string,
    user: IUserPayload,
  ): Promise<TrackingPoint | null> {
    const qb = this.trackingRepository
      .createQueryBuilder('tp')
      .where('tp.truckId = :tid', { tid: truckId });

    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyId = requireCompanyId(user);
      qb.andWhere('tp.companyId = :companyId', { companyId });
    }

    return qb.orderBy('tp.capturedAt', 'DESC').getOne();
  }

  async getStats(query: QueryTrackingDto, user: IUserPayload) {
    const points = await this.query(query, user);
    if (points.length === 0) {
      return { totalPoints: 0, distanceKm: 0, avgSpeed: 0, maxSpeed: 0 };
    }

    const speeds = points.map((p) => Number(p.speed || 0));
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeed = Math.max(...speeds);

    let distanceKm = 0;
    for (let i = 1; i < points.length; i++) {
      distanceKm += this.haversine(
        Number(points[i - 1].lat),
        Number(points[i - 1].lng),
        Number(points[i].lat),
        Number(points[i].lng),
      );
    }

    return {
      totalPoints: points.length,
      distanceKm: Number(distanceKm.toFixed(2)),
      avgSpeed: Number(avgSpeed.toFixed(2)),
      maxSpeed: Number(maxSpeed.toFixed(2)),
      from: points[0].capturedAt,
      to: points[points.length - 1].capturedAt,
    };
  }

  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
