import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DriversService } from './drivers.service';
import { Driver } from './entities/driver.entity';
import { User } from '../auth/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { DriverStatus } from '../../common/enums/driver-status.enum';
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
  save: jest.fn(async (x) => ({ id: 'd1', ...x })),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const tenant = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;
const admin = (): IUserPayload =>
  ({ sub: 'a', role: UserRole.SUPER_ADMIN, companyId: null }) as never;

describe('DriversService', () => {
  let service: DriversService;
  let repo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    repo = repoMock();
    const module = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: getRepositoryToken(Driver), useValue: repo },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => ({ id: 'u1', ...x })),
            count: jest.fn().mockResolvedValue(0),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest
              .fn()
              .mockResolvedValue([
                { limits: { global: { max_drivers: 99999 } } },
              ]),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendDriverInvitation: jest.fn().mockResolvedValue(undefined),
            sendDriverWelcomeWithCredentials: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(DriversService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('Conflict if license duplicated', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'dup' });
      await expect(
        service.create({ licenseNumber: 'L1' } as never, tenant()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('persists with default status AVAILABLE', async () => {
      repo.findOne.mockResolvedValueOnce(undefined);
      const res = await service.create(
        { licenseNumber: 'L1' } as never,
        tenant(),
      );
      expect(res).toMatchObject({ status: DriverStatus.AVAILABLE });
    });
  });

  describe('findAll', () => {
    it('admin without companyId param', async () => {
      repo.createQueryBuilder.mockReturnValue(qbMock([], 0));
      const res = await service.findAll(
        { skip: 0, take: 10, page: 1, limit: 10 } as never,
        admin(),
      );
      expect(res.meta.total).toBe(0);
    });

    it('tenant with full filters', async () => {
      repo.createQueryBuilder.mockReturnValue(qbMock([{ id: 'd1' }], 1));
      const res = await service.findAll(
        {
          skip: 0,
          take: 10,
          page: 1,
          limit: 10,
          search: 'jo',
          status: DriverStatus.AVAILABLE,
          truckId: 't1',
          sortBy: 'firstName',
          sortOrder: 'ASC',
        } as never,
        tenant(),
      );
      expect(res.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('NotFound', async () => {
      repo.findOne.mockResolvedValueOnce(undefined);
      await expect(service.findOne('x', tenant())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Forbidden cross-tenant', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'd1', companyId: 'other' });
      await expect(service.findOne('d1', tenant())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('Conflict when changing license to existing', async () => {
      repo.findOne
        .mockResolvedValueOnce({
          id: 'd1',
          companyId: 'c1',
          licenseNumber: 'A',
        })
        .mockResolvedValueOnce({ id: 'dup' });
      await expect(
        service.update('d1', { licenseNumber: 'B' } as never, tenant()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates when license unchanged', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'd1',
        companyId: 'c1',
        licenseNumber: 'A',
      });
      const res = await service.update(
        'd1',
        { firstName: 'New' } as never,
        tenant(),
      );
      expect(res).toMatchObject({ firstName: 'New' });
    });
  });

  describe('updateStatus / getCurrentTrip / getStats', () => {
    beforeEach(() =>
      repo.findOne.mockResolvedValue({
        id: 'd1',
        companyId: 'c1',
        fullName: 'John',
        status: DriverStatus.AVAILABLE,
        currentTruckId: null,
        totalTrips: 5,
        ratingAvg: '4.5',
      }),
    );

    it('updateStatus persists', async () => {
      const res = await service.updateStatus(
        'd1',
        DriverStatus.ON_TRIP,
        tenant(),
      );
      expect(res.status).toBe(DriverStatus.ON_TRIP);
    });

    it('getCurrentTrip returns onTrip flag', async () => {
      const res = await service.getCurrentTrip('d1', tenant());
      expect(res.onTrip).toBe(false);
    });

    it('getStats returns aggregates', async () => {
      const res = await service.getStats('d1', tenant());
      expect(res).toMatchObject({ totalTrips: 5, ratingAvg: 4.5 });
    });
  });

  describe('remove', () => {
    it('rejects when driver ON_TRIP', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'd1',
        companyId: 'c1',
        status: DriverStatus.ON_TRIP,
      });
      await expect(service.remove('d1', tenant())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('soft-removes when AVAILABLE', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'd1',
        companyId: 'c1',
        status: DriverStatus.AVAILABLE,
      });
      await service.remove('d1', tenant());
      expect(repo.softRemove).toHaveBeenCalled();
    });
  });
});
