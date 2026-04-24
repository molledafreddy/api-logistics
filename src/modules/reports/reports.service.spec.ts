import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

// QB minimalista: cada llamada a clone() devuelve uno nuevo con misma API.
const buildQb = (overrides: Partial<Record<string, unknown>> = {}) => {
  const q: Record<string, jest.Mock> = {};
  [
    'where',
    'andWhere',
    'orderBy',
    'take',
    'select',
    'addSelect',
    'groupBy',
    'addGroupBy',
  ].forEach((m) => (q[m] = jest.fn().mockReturnThis()));
  q.clone = jest.fn(() => buildQb(overrides));
  q.getMany = jest.fn().mockResolvedValue(overrides.getMany ?? []);
  q.getCount = jest.fn().mockResolvedValue(overrides.getCount ?? 0);
  q.getRawOne = jest
    .fn()
    .mockResolvedValue(overrides.getRawOne ?? { total: 0, count: 0 });
  q.getRawMany = jest.fn().mockResolvedValue(overrides.getRawMany ?? []);
  return q;
};

const repoMock = () => ({ createQueryBuilder: jest.fn(() => buildQb()) });

const tenant = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;
const admin = (): IUserPayload =>
  ({ sub: 'a', role: UserRole.SUPER_ADMIN, companyId: null }) as never;

describe('ReportsService', () => {
  let service: ReportsService;
  let shipRepo: ReturnType<typeof repoMock>;
  let expRepo: ReturnType<typeof repoMock>;
  let drvRepo: ReturnType<typeof repoMock>;
  let truckRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    shipRepo = repoMock();
    expRepo = repoMock();
    drvRepo = repoMock();
    truckRepo = repoMock();
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Shipment), useValue: shipRepo },
        { provide: getRepositoryToken(Expense), useValue: expRepo },
        { provide: getRepositoryToken(Driver), useValue: drvRepo },
        { provide: getRepositoryToken(Truck), useValue: truckRepo },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('shipments report', () => {
    it('returns mapped rows', async () => {
      shipRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({
          getMany: [
            {
              id: 's1',
              trackingCode: 'T1',
              status: 'completed',
              originAddress: 'A',
              destinationAddress: 'B',
              price: '100',
              createdAt: new Date(),
            },
          ],
        }),
      );
      const res = await service.shipments(
        {
          companyId: 'c1',
          from: '2020-01-01',
          to: '2030-01-01',
          status: 'completed',
        } as never,
        tenant(),
      );
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ id: 's1', price: 100 });
    });

    it('Forbidden when tenant without companyId', async () => {
      await expect(
        service.shipments(
          {} as never,
          { ...tenant(), companyId: null } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('expenses report', () => {
    it('admin without companyId still returns', async () => {
      expRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({
          getMany: [
            { id: 'e1', category: 'fuel', amount: '50', currency: 'USD' },
          ],
        }),
      );
      const res = await service.expenses({} as never, admin());
      expect(res[0].amount).toBe(50);
    });
  });

  describe('driversPerformance', () => {
    it('aggregates per driver', async () => {
      drvRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({
          getMany: [
            {
              id: 'd1',
              fullName: 'John',
              status: 'available',
              totalTrips: 10,
              ratingAvg: '4.5',
            },
          ],
        }),
      );
      shipRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({ getRawOne: { total: '500' } }),
      );
      const res = await service.driversPerformance(
        { from: '2020-01-01' } as never,
        tenant(),
      );
      expect(res[0]).toMatchObject({ driverId: 'd1', revenueGenerated: 500 });
    });
  });

  describe('financialSummary', () => {
    it('computes net profit and margin', async () => {
      shipRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({ getRawOne: { total: '1000', count: '5' } }),
      );
      expRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({
          getRawOne: { total: '300', count: '3' },
          getRawMany: [{ category: 'fuel', total: '200' }],
        }),
      );
      const res = await service.financialSummary({} as never, tenant());
      expect(res.netProfit).toBe(700);
      expect(res.profitMargin).toBeCloseTo(0.7);
      expect(res.expenses.byCategory[0]).toMatchObject({
        category: 'fuel',
        total: 200,
      });
    });

    it('profitMargin=0 when no revenue', async () => {
      shipRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({ getRawOne: { total: '0', count: '0' } }),
      );
      expRepo.createQueryBuilder.mockReturnValueOnce(
        buildQb({ getRawOne: { total: '50', count: '1' }, getRawMany: [] }),
      );
      const res = await service.financialSummary({} as never, tenant());
      expect(res.profitMargin).toBe(0);
      expect(res.netProfit).toBe(-50);
    });
  });

  describe('toCsv', () => {
    it('returns empty for no rows', () => {
      expect(service.toCsv([])).toBe('');
    });

    it('escapes commas, quotes and newlines', () => {
      const out = service.toCsv([
        { a: 'x,y', b: 'he said "hi"', c: 'line1\nline2' },
      ]);
      expect(out.split('\n')).toHaveLength(3);
      expect(out).toContain('"x,y"');
      expect(out).toContain('"he said ""hi"""');
    });

    it('handles null/undefined and objects', () => {
      const out = service.toCsv([{ a: null, b: undefined, c: { x: 1 } }]);
      // El objeto se serializa como JSON y luego se escapan comillas
      expect(out).toContain('""x""');
      expect(out.split('\n')[1].startsWith(',,')).toBe(true);
    });
  });
});
