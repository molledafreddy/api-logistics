import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingPoint } from './entities/tracking-point.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const qb = () => {
  const q: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'take'].forEach(
    (m) => (q[m] = jest.fn().mockReturnThis()),
  );
  q.getMany = jest.fn().mockResolvedValue([]);
  q.getOne = jest.fn().mockResolvedValue(null);
  return q;
};

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => (Array.isArray(x) ? x : { id: 'tp1', ...x })),
  createQueryBuilder: jest.fn(),
});

const tenant = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;
const admin = (): IUserPayload =>
  ({ sub: 'a', role: UserRole.SUPER_ADMIN, companyId: null }) as never;

describe('TrackingService', () => {
  let service: TrackingService;
  let repo: ReturnType<typeof repoMock>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    repo = repoMock();
    emitter = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        TrackingService,
        { provide: getRepositoryToken(TrackingPoint), useValue: repo },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(TrackingService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('Forbidden if no companyId', async () => {
      await expect(
        service.create(
          { shipmentId: 's1', lat: 0, lng: 0 } as never,
          {
            ...tenant(),
            companyId: null,
          } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest when neither shipmentId nor truckId', async () => {
      await expect(
        service.create({ lat: 0, lng: 0 } as never, tenant()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('saves and emits event', async () => {
      const res = await service.create(
        { shipmentId: 's1', lat: 1, lng: 2 } as never,
        tenant(),
      );
      expect(emitter.emit).toHaveBeenCalled();
      expect(res).toMatchObject({ companyId: 'c1', shipmentId: 's1' });
    });
  });

  describe('createBulk', () => {
    it('inserts in chunks and emits event', async () => {
      const res = await service.createBulk(
        {
          points: [
            { lat: 1, lng: 1 },
            { lat: 2, lng: 2 },
          ],
        } as never,
        tenant(),
      );
      expect(res).toEqual({ inserted: 2 });
      expect(emitter.emit).toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('BadRequest when no filters', async () => {
      await expect(service.query({} as never, tenant())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('runs QB for tenant with shipmentId', async () => {
      repo.createQueryBuilder.mockReturnValue(qb());
      const res = await service.query(
        {
          shipmentId: 's1',
          truckId: 't1',
          driverId: 'd1',
          from: '2020-01-01',
          to: '2030-01-01',
          limit: 100,
        } as never,
        tenant(),
      );
      expect(res).toEqual([]);
    });

    it('skips company filter when SUPER_ADMIN', async () => {
      repo.createQueryBuilder.mockReturnValue(qb());
      await service.query({ shipmentId: 's1', limit: 10 } as never, admin());
    });
  });

  describe('getLatestForShipment / getLatestForTruck', () => {
    it('returns latest point or null', async () => {
      repo.createQueryBuilder.mockReturnValue(qb());
      expect(await service.getLatestForShipment('s1', tenant())).toBeNull();
      expect(await service.getLatestForTruck('t1', tenant())).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns zeroes when no points', async () => {
      const q = qb();
      q.getMany.mockResolvedValue([]);
      repo.createQueryBuilder.mockReturnValue(q);
      const res = await service.getStats(
        { shipmentId: 's1', limit: 10 } as never,
        tenant(),
      );
      expect(res).toMatchObject({ totalPoints: 0, distanceKm: 0 });
    });

    it('computes distance/avgSpeed/maxSpeed for >1 point', async () => {
      const q = qb();
      q.getMany.mockResolvedValue([
        { lat: 0, lng: 0, speed: 10, capturedAt: new Date('2020-01-01') },
        { lat: 0.01, lng: 0.01, speed: 20, capturedAt: new Date('2020-01-02') },
      ]);
      repo.createQueryBuilder.mockReturnValue(q);
      const res = await service.getStats(
        { shipmentId: 's1', limit: 10 } as never,
        tenant(),
      );
      expect(res.totalPoints).toBe(2);
      expect(res.maxSpeed).toBe(20);
      expect(res.avgSpeed).toBe(15);
      expect(res.distanceKm).toBeGreaterThan(0);
    });
  });
});
