import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { Expense } from './entities/expense.entity';
import { ExpenseStatus } from '../../common/enums/expense-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const qbList = (data: unknown[] = [], total = 0) => {
  const q: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'skip', 'take'].forEach(
    (m) => (q[m] = jest.fn().mockReturnThis()),
  );
  q.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return q;
};

const qbAgg = (rows: unknown[] = []) => {
  const q: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'select', 'addSelect', 'groupBy', 'addGroupBy'].forEach(
    (m) => (q[m] = jest.fn().mockReturnThis()),
  );
  q.getRawMany = jest.fn().mockResolvedValue(rows);
  return q;
};

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'e1', ...x })),
  findOne: jest.fn(),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const tenant = (role = UserRole.ADMIN, sub = 'u1'): IUserPayload =>
  ({ sub, role, companyId: 'c1' }) as never;
const admin = (): IUserPayload =>
  ({ sub: 'a', role: UserRole.SUPER_ADMIN, companyId: null }) as never;

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    repo = repoMock();
    const module = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useValue: repo },
      ],
    }).compile();
    service = module.get(ExpensesService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('Forbidden if no companyId', async () => {
      await expect(
        service.create(
          { amount: 10 } as never,
          { ...tenant(), companyId: null } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('persists with PENDING status and currency default USD', async () => {
      const res = await service.create({ amount: 10 } as never, tenant());
      expect(res).toMatchObject({
        status: ExpenseStatus.PENDING,
        currency: 'USD',
        createdBy: 'u1',
      });
    });
  });

  describe('findAll', () => {
    it('SUPER_ADMIN with companyId filter', async () => {
      repo.createQueryBuilder.mockReturnValue(qbList([], 0));
      const res = await service.findAll(
        { companyId: 'c2', skip: 0, take: 10, page: 1, limit: 10 } as never,
        admin(),
      );
      expect(res.meta.total).toBe(0);
    });

    it('DRIVER scoped to own expenses with all filters', async () => {
      repo.createQueryBuilder.mockReturnValue(qbList([{ id: 'e1' }], 1));
      const res = await service.findAll(
        {
          search: 'fuel',
          status: ExpenseStatus.PENDING,
          category: 'fuel',
          shipmentId: 's1',
          truckId: 't1',
          driverId: 'd1',
          dateFrom: '2020-01-01',
          dateTo: '2030-01-01',
          sortBy: 'amount',
          sortOrder: 'ASC',
          skip: 0,
          take: 10,
          page: 1,
          limit: 10,
        } as never,
        tenant(UserRole.DRIVER),
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
      repo.findOne.mockResolvedValueOnce({ id: 'e1', companyId: 'other' });
      await expect(service.findOne('e1', tenant())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('DRIVER cannot read others expense', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'e1',
        companyId: 'c1',
        createdBy: 'other',
      });
      await expect(
        service.findOne('e1', tenant(UserRole.DRIVER)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('lifecycle: update / approve / reject / reimburse / remove', () => {
    const pending = () => ({
      id: 'e1',
      companyId: 'c1',
      createdBy: 'u1',
      status: ExpenseStatus.PENDING,
    });
    const approved = () => ({ ...pending(), status: ExpenseStatus.APPROVED });
    const reimbursed = () => ({
      ...pending(),
      status: ExpenseStatus.REIMBURSED,
    });

    it('update: only PENDING editable', async () => {
      repo.findOne.mockResolvedValueOnce(approved());
      await expect(
        service.update('e1', { amount: 99 } as never, tenant()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('update: applies dto when PENDING', async () => {
      repo.findOne.mockResolvedValueOnce(pending());
      const res = await service.update('e1', { amount: 50 } as never, tenant());
      expect(res).toMatchObject({ amount: 50 });
    });

    it('approve: transitions PENDING -> APPROVED', async () => {
      repo.findOne.mockResolvedValueOnce(pending());
      const res = await service.approve('e1', tenant());
      expect(res.status).toBe(ExpenseStatus.APPROVED);
      expect(res.approvedBy).toBe('u1');
    });

    it('approve: rejects if not PENDING', async () => {
      repo.findOne.mockResolvedValueOnce(approved());
      await expect(service.approve('e1', tenant())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('reject: stamps reason', async () => {
      repo.findOne.mockResolvedValueOnce(pending());
      const res = await service.reject('e1', 'no receipt', tenant());
      expect(res.status).toBe(ExpenseStatus.REJECTED);
      expect(res.rejectionReason).toBe('no receipt');
    });

    it('reimburse: only APPROVED transitions', async () => {
      repo.findOne.mockResolvedValueOnce(pending());
      await expect(service.reimburse('e1', tenant())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      repo.findOne.mockResolvedValueOnce(approved());
      const res = await service.reimburse('e1', tenant());
      expect(res.status).toBe(ExpenseStatus.REIMBURSED);
    });

    it('remove: blocks REIMBURSED', async () => {
      repo.findOne.mockResolvedValueOnce(reimbursed());
      await expect(service.remove('e1', tenant())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('remove: soft-removes when not REIMBURSED', async () => {
      repo.findOne.mockResolvedValueOnce(pending());
      await service.remove('e1', tenant());
      expect(repo.softRemove).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('aggregates totals across category/status', async () => {
      repo.createQueryBuilder.mockReturnValueOnce(
        qbAgg([
          { category: 'fuel', status: 'pending', total: '100', count: '2' },
          { category: 'tolls', status: 'approved', total: '50', count: '1' },
        ]),
      );
      const res = await service.getSummary({} as never, tenant());
      expect(res.totalAmount).toBe(150);
      expect(res.totalCount).toBe(3);
      expect(res.byCategoryStatus).toHaveLength(2);
    });
  });
});
