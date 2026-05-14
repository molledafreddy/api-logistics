import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const adminUser = (): IUserPayload =>
  ({
    sub: 'u1',
    role: UserRole.ADMIN,
    companyId: 'c1',
    email: 'a@test.com',
  }) as IUserPayload;

const superAdmin = (): IUserPayload =>
  ({
    sub: 'u2',
    role: UserRole.SUPER_ADMIN,
    companyId: undefined,
    email: 's@test.com',
  }) as unknown as IUserPayload;

const makeQb = (
  rawManyResult?: unknown[],
  rawOneResult?: unknown,
  manyResult?: unknown[],
) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getRawMany: jest.fn().mockResolvedValue(rawManyResult ?? []),
  getRawOne: jest.fn().mockResolvedValue(rawOneResult ?? {}),
  getMany: jest.fn().mockResolvedValue(manyResult ?? []),
});

const makeRepo = () => ({
  createQueryBuilder: jest.fn(() => makeQb()),
});

describe('DashboardService', () => {
  let service: DashboardService;
  let shipmentRepo: ReturnType<typeof makeRepo>;
  let truckRepo: ReturnType<typeof makeRepo>;
  let driverRepo: ReturnType<typeof makeRepo>;
  let expenseRepo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    shipmentRepo = makeRepo();
    truckRepo = makeRepo();
    driverRepo = makeRepo();
    expenseRepo = makeRepo();
    service = new DashboardService(
      shipmentRepo as never,
      truckRepo as never,
      driverRepo as never,
      expenseRepo as never,
    );
  });

  const q = {} as never;

  // ─── Authorization ────────────────────────

  describe('resolveCompanyId', () => {
    it('throws ForbiddenException when non-super-admin user has no companyId', async () => {
      const user = { sub: 'u1', role: UserRole.ADMIN } as IUserPayload;
      await expect(service.overview(q, user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('does not throw when SUPER_ADMIN has no companyId', async () => {
      await expect(service.overview(q, superAdmin())).resolves.toBeDefined();
    });
  });

  // ─── overview ─────────────────────────────

  describe('overview', () => {
    it('returns the expected KPI shape', async () => {
      const result = await service.overview(q, adminUser());
      expect(result).toMatchObject({
        shipments: expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          completed: expect.any(Number),
        }),
        trucks: expect.objectContaining({
          total: expect.any(Number),
          available: expect.any(Number),
          inTransit: expect.any(Number),
          utilization: expect.any(Number),
        }),
        drivers: expect.objectContaining({
          total: expect.any(Number),
          onTrip: expect.any(Number),
        }),
        expenses: expect.objectContaining({
          pendingApproval: expect.any(Number),
        }),
      });
    });

    it('computes utilization = 0 when no trucks', async () => {
      const result = await service.overview(q, adminUser());
      expect(result.trucks.utilization).toBe(0);
    });

    it('computes truck utilization ratio correctly', async () => {
      // overview calls createQueryBuilder 3 times on truckRepo: total, available, inTransit
      truckRepo.createQueryBuilder
        .mockImplementationOnce(() => {
          const qb = makeQb();
          qb.getCount.mockResolvedValue(10);
          return qb;
        })
        .mockImplementationOnce(() => {
          const qb = makeQb();
          qb.getCount.mockResolvedValue(6);
          return qb;
        })
        .mockImplementationOnce(() => {
          const qb = makeQb();
          qb.getCount.mockResolvedValue(3);
          return qb;
        });

      const result = await service.overview(q, adminUser());
      expect(result.trucks.total).toBe(10);
      expect(result.trucks.utilization).toBeCloseTo(3 / 10, 5);
    });
  });

  // ─── shipmentsByStatus ────────────────────

  describe('shipmentsByStatus', () => {
    it('maps raw DB rows to {status, count} objects', async () => {
      shipmentRepo.createQueryBuilder.mockImplementation(() =>
        makeQb([
          { status: 'pending', count: '5' },
          { status: 'in_transit', count: '3' },
        ]),
      );

      const result = await service.shipmentsByStatus(q, adminUser());
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ status: 'pending', count: 5 });
      expect(result[1]).toEqual({ status: 'in_transit', count: 3 });
    });

    it('returns empty array when no shipments', async () => {
      const result = await service.shipmentsByStatus(q, adminUser());
      expect(result).toEqual([]);
    });
  });

  // ─── revenue ──────────────────────────────

  describe('revenue', () => {
    it('returns numeric revenue values from DB strings', async () => {
      shipmentRepo.createQueryBuilder.mockImplementation(() =>
        makeQb(undefined, {
          totalRevenue: '150000',
          shipments: '30',
          avgPerShipment: '5000',
        }),
      );

      const result = await service.revenue(q, adminUser());
      expect(result).toEqual({
        totalRevenue: 150000,
        shipments: 30,
        avgPerShipment: 5000,
      });
    });

    it('returns zeros when DB result is null', async () => {
      shipmentRepo.createQueryBuilder.mockImplementation(() =>
        makeQb(undefined, null),
      );

      const result = await service.revenue(q, adminUser());
      expect(result).toEqual({
        totalRevenue: 0,
        shipments: 0,
        avgPerShipment: 0,
      });
    });
  });

  // ─── expensesByCategory ───────────────────

  describe('expensesByCategory', () => {
    it('maps raw DB rows to {category, total, count} objects', async () => {
      expenseRepo.createQueryBuilder.mockImplementation(() =>
        makeQb([
          { category: 'fuel', total: '50000', count: '10' },
          { category: 'maintenance', total: '20000', count: '4' },
        ]),
      );

      const result = await service.expensesByCategory(q, adminUser());
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ category: 'fuel', total: 50000, count: 10 });
      expect(result[1]).toEqual({
        category: 'maintenance',
        total: 20000,
        count: 4,
      });
    });

    it('returns empty array when no expenses', async () => {
      const result = await service.expensesByCategory(q, adminUser());
      expect(result).toEqual([]);
    });
  });

  // ─── fleetUtilization ─────────────────────

  describe('fleetUtilization', () => {
    it('computes total and byStatus with correct percentages', async () => {
      truckRepo.createQueryBuilder.mockImplementation(() =>
        makeQb([
          { status: 'available', count: '6' },
          { status: 'in_transit', count: '4' },
        ]),
      );

      const result = await service.fleetUtilization(q, adminUser());
      expect(result.total).toBe(10);
      expect(result.byStatus).toHaveLength(2);
      const available = result.byStatus.find((r) => r.status === 'available')!;
      expect(available.percentage).toBeCloseTo(0.6, 5);
    });

    it('returns total=0 and empty byStatus when fleet is empty', async () => {
      const result = await service.fleetUtilization(q, adminUser());
      expect(result.total).toBe(0);
      expect(result.byStatus).toHaveLength(0);
    });
  });

  // ─── topDrivers ───────────────────────────

  describe('topDrivers', () => {
    it('maps driver entities to the expected shape', async () => {
      const fakeDriver = {
        id: 'd1',
        fullName: 'Juan Pérez',
        totalTrips: 50,
        ratingAvg: '4.75',
        status: 'active',
      };
      driverRepo.createQueryBuilder.mockImplementation(() =>
        makeQb(undefined, undefined, [fakeDriver]),
      );

      const result = await service.topDrivers(q, adminUser());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'd1',
        name: 'Juan Pérez',
        totalTrips: 50,
        rating: 4.75,
        status: 'active',
      });
    });

    it('returns empty array when no drivers', async () => {
      const result = await service.topDrivers(q, adminUser());
      expect(result).toEqual([]);
    });
  });

  // ─── SUPER_ADMIN passes null companyId ────

  describe('SUPER_ADMIN', () => {
    it('resolves all methods without companyId constraint', async () => {
      await expect(service.overview(q, superAdmin())).resolves.toBeDefined();
      await expect(
        service.shipmentsByStatus(q, superAdmin()),
      ).resolves.toBeDefined();
      await expect(service.revenue(q, superAdmin())).resolves.toBeDefined();
      await expect(
        service.expensesByCategory(q, superAdmin()),
      ).resolves.toBeDefined();
      await expect(
        service.fleetUtilization(q, superAdmin()),
      ).resolves.toBeDefined();
      await expect(service.topDrivers(q, superAdmin())).resolves.toBeDefined();
    });
  });
});
