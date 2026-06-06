import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TrucksService } from './trucks.service';
import { Truck } from './entities/truck.entity';
import { TruckStatus } from '../../common/enums/truck-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const qbMock = (data: unknown[] = [], total = 0) => {
  const q: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'skip', 'take'].forEach(
    (m) => (q[m] = jest.fn().mockReturnThis()),
  );
  q.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return q;
};

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 't1', ...x })),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const tenant = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;
const noCompany = (): IUserPayload =>
  ({ sub: 'u', role: UserRole.ADMIN, companyId: null }) as never;
const admin = (): IUserPayload =>
  ({ sub: 'a', role: UserRole.SUPER_ADMIN, companyId: null }) as never;
const otherTenant = (): IUserPayload =>
  ({ sub: 'u2', role: UserRole.ADMIN, companyId: 'cX' }) as never;

describe('TrucksService', () => {
  let service: TrucksService;
  let repo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    repo = repoMock();
    const module = await Test.createTestingModule({
      providers: [
        TrucksService,
        { provide: getRepositoryToken(Truck), useValue: repo },
        {
          provide: DataSource,
          useValue: {
            query: jest
              .fn()
              .mockResolvedValue([
                { limits: { global: { max_trucks: 99999 } } },
              ]),
          },
        },
      ],
    }).compile();
    service = module.get(TrucksService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('Forbidden when user has no companyId', async () => {
      await expect(
        service.create({ plate: 'AAA' } as never, noCompany()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Conflict when plate already exists', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'dup' });
      await expect(
        service.create({ plate: 'AAA' } as never, tenant()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('Conflict when driver already assigned to another truck', async () => {
      repo.findOne
        .mockResolvedValueOnce(null) // plate check
        .mockResolvedValueOnce({ id: 'tX', plate: 'OTHER' }); // driver conflict
      await expect(
        service.create(
          { plate: 'AAA', currentDriverId: 'd1' } as never,
          tenant(),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates truck with default AVAILABLE status', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create({ plate: 'AAA' } as never, tenant());
      expect(result).toMatchObject({
        plate: 'AAA',
        companyId: 'c1',
        status: TruckStatus.AVAILABLE,
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated for tenant filtering by companyId', async () => {
      const qb = qbMock([{ id: 't1' }], 1);
      repo.createQueryBuilder.mockReturnValue(qb);
      const res = await service.findAll(
        { skip: 0, limit: 10, page: 1 } as never,
        tenant(),
      );
      expect(res.meta.total).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith('truck.companyId = :companyId', {
        companyId: 'c1',
      });
    });

    it('SUPER_ADMIN with companyId filter applies it', async () => {
      const qb = qbMock([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        { skip: 0, limit: 10, page: 1, companyId: 'cZ' } as never,
        admin(),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('truck.companyId = :companyId', {
        companyId: 'cZ',
      });
    });

    it('applies search/status/type/driverId filters', async () => {
      const qb = qbMock([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        {
          skip: 0,
          limit: 10,
          page: 1,
          search: 'foo',
          status: TruckStatus.AVAILABLE,
          type: 'BOX',
          driverId: 'd1',
          sortBy: 'plate',
          sortOrder: 'ASC',
        } as never,
        tenant(),
      );
      expect(qb.orderBy).toHaveBeenCalledWith('truck.plate', 'ASC');
    });
  });

  describe('findOne', () => {
    it('NotFound when missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('x', tenant())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Forbidden cross-tenant', async () => {
      repo.findOne.mockResolvedValue({ id: 't1', companyId: 'c1' });
      await expect(service.findOne('t1', otherTenant())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('SUPER_ADMIN can read any truck', async () => {
      repo.findOne.mockResolvedValue({ id: 't1', companyId: 'c1' });
      const t = await service.findOne('t1', admin());
      expect(t.id).toBe('t1');
    });
  });

  describe('update', () => {
    it('Conflict when plate change collides', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 't1', companyId: 'c1', plate: 'OLD' }) // findOne
        .mockResolvedValueOnce({ id: 'dup' }); // dup check
      await expect(
        service.update('t1', { plate: 'NEW' } as never, tenant()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates same plate without dup check', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 't1',
        companyId: 'c1',
        plate: 'AAA',
      });
      const res = await service.update(
        't1',
        { plate: 'AAA', model: 'X' } as never,
        tenant(),
      );
      expect(res).toMatchObject({ plate: 'AAA', model: 'X' });
    });
  });

  describe('updateStatus', () => {
    it('changes status', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        plate: 'AAA',
        status: TruckStatus.AVAILABLE,
      });
      const res = await service.updateStatus(
        't1',
        TruckStatus.MAINTENANCE,
        tenant(),
      );
      expect(res.status).toBe(TruckStatus.MAINTENANCE);
    });
  });

  describe('assignDriver', () => {
    it('rejects when truck is OUT_OF_SERVICE', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 't1',
        companyId: 'c1',
        status: TruckStatus.OUT_OF_SERVICE,
      });
      await expect(
        service.assignDriver('t1', 'd1', tenant()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('idempotent if already assigned', async () => {
      const truck = {
        id: 't1',
        companyId: 'c1',
        status: TruckStatus.AVAILABLE,
        currentDriverId: 'd1',
      };
      repo.findOne.mockResolvedValueOnce(truck);
      const res = await service.assignDriver('t1', 'd1', tenant());
      expect(res).toBe(truck);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('Conflict when driver in another truck', async () => {
      repo.findOne
        .mockResolvedValueOnce({
          id: 't1',
          companyId: 'c1',
          status: TruckStatus.AVAILABLE,
          currentDriverId: null,
        })
        .mockResolvedValueOnce({ id: 'tX', plate: 'OTHER' });
      await expect(
        service.assignDriver('t1', 'd1', tenant()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('assigns driver successfully', async () => {
      repo.findOne
        .mockResolvedValueOnce({
          id: 't1',
          companyId: 'c1',
          status: TruckStatus.AVAILABLE,
          currentDriverId: null,
          plate: 'AAA',
        })
        .mockResolvedValueOnce(null);
      const res = await service.assignDriver('t1', 'd1', tenant());
      expect(res.currentDriverId).toBe('d1');
    });
  });

  describe('unassignDriver', () => {
    it('clears currentDriverId', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        plate: 'AAA',
        currentDriverId: 'd1',
      });
      const res = await service.unassignDriver('t1', tenant());
      expect(res.currentDriverId).toBeNull();
    });
  });

  describe('getLocation', () => {
    it('returns null coords when missing', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        plate: 'AAA',
        status: TruckStatus.AVAILABLE,
        lastLat: null,
        lastLng: null,
        lastLocationAt: null,
      });
      const loc = await service.getLocation('t1', tenant());
      expect(loc).toMatchObject({ lat: null, lng: null });
    });

    it('coerces lat/lng to numbers', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        plate: 'AAA',
        status: TruckStatus.AVAILABLE,
        lastLat: '10.5',
        lastLng: '-66.9',
        lastLocationAt: new Date(),
      });
      const loc = await service.getLocation('t1', tenant());
      expect(loc.lat).toBe(10.5);
      expect(loc.lng).toBe(-66.9);
    });
  });

  describe('remove', () => {
    it('blocks deletion when IN_TRANSIT', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        status: TruckStatus.IN_TRANSIT,
      });
      await expect(service.remove('t1', tenant())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('soft removes available truck', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        plate: 'AAA',
        status: TruckStatus.AVAILABLE,
      });
      await service.remove('t1', tenant());
      expect(repo.softRemove).toHaveBeenCalled();
    });
  });
});
