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
import {
  CreateTrackingPointDto,
  BulkTrackingPointsDto,
  QueryTrackingDto,
} from './dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { requireCompanyId } from '../../common/helpers/tenant.helpers';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(TrackingPoint)
    private readonly trackingRepository: Repository<TrackingPoint>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    dto: CreateTrackingPointDto,
    user: IUserPayload,
  ): Promise<TrackingPoint> {
    const companyId = requireCompanyId(user);

    if (!dto.shipmentId && !dto.truckId) {
      throw new BadRequestException(
        'At least one of shipmentId or truckId is required',
      );
    }

    const point = this.trackingRepository.create({
      ...dto,
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

    const points = dto.points.map((p) =>
      this.trackingRepository.create({
        ...p,
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
