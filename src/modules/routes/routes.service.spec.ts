import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { Route } from './entities/route.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const qbMock = (data: unknown[] = [], total = 0) => {
  const qb: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'skip', 'take'].forEach(
    (m) => (qb[m] = jest.fn().mockReturnThis()),
  );
  qb.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return qb;
};

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'r1', ...x })),
  findOne: jest.fn(),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const adminUser = (): IUserPayload =>
  ({
    sub: 'u-admin',
    email: 'a@a',
    role: UserRole.SUPER_ADMIN,
    companyId: null,
  }) as never;

const tenantUser = (companyId = 'c1'): IUserPayload =>
  ({
    sub: 'u1',
    email: 'u@u',
    role: UserRole.ADMIN,
    companyId,
  }) as never;

describe('RoutesService', () => {
  let service: RoutesService;
  let repo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    repo = repoMock();
    const module = await Test.createTestingModule({
      providers: [
        RoutesService,
        { provide: getRepositoryToken(Route), useValue: repo },
      ],
    }).compile();
    service = module.get(RoutesService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('throws Forbidden when user has no companyId', async () => {
      await expect(
        service.create(
          { name: 'x' } as never,
          { ...tenantUser(), companyId: null } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('persists with companyId, defaults status=draft and currency=USD', async () => {
      const res = await service.create({ name: 'r' } as never, tenantUser());
      expect(res).toMatchObject({
        companyId: 'c1',
        status: 'draft',
        currency: 'USD',
      });
    });
  });

  describe('findAll', () => {
    it('SUPER_ADMIN with companyId filter', async () => {
      repo.createQueryBuilder.mockReturnValue(qbMock([], 0));
      const res = await service.findAll(
        { companyId: 'c9', skip: 0, take: 10, page: 1, limit: 10 } as never,
        adminUser(),
      );
      expect(res.meta.total).toBe(0);
    });

    it('tenant scoped to its companyId', async () => {
      repo.createQueryBuilder.mockReturnValue(qbMock([{ id: 'r1' }], 1));
      const res = await service.findAll(
        {
          skip: 0,
          take: 10,
          page: 1,
          limit: 10,
          search: 'x',
          status: 'active',
          sortBy: 'name',
          sortOrder: 'ASC',
        } as never,
        tenantUser(),
      );
      expect(res.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('NotFound when missing', async () => {
      repo.findOne.mockResolvedValueOnce(undefined);
      await expect(service.findOne('x', tenantUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Forbidden when other tenant', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'r1', companyId: 'other' });
      await expect(service.findOne('r1', tenantUser())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns when same company', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'r1', companyId: 'c1' });
      const res = await service.findOne('r1', tenantUser());
      expect(res.id).toBe('r1');
    });
  });

  describe('update / setStatus / duplicate / remove', () => {
    beforeEach(() =>
      repo.findOne.mockResolvedValue({
        id: 'r1',
        companyId: 'c1',
        name: 'orig',
        status: 'draft',
      }),
    );

    it('update assigns and saves', async () => {
      const res = await service.update(
        'r1',
        { name: 'new' } as never,
        tenantUser(),
      );
      expect(res.name).toBe('new');
    });

    it('setStatus persists new status', async () => {
      const res = await service.setStatus('r1', 'active', tenantUser());
      expect(res.status).toBe('active');
    });

    it('duplicate creates copy with name suffix and status=draft', async () => {
      const res = await service.duplicate('r1', tenantUser());
      expect(res.name).toBe('orig (copy)');
      expect(res.status).toBe('draft');
    });

    it('remove soft-removes', async () => {
      await service.remove('r1', tenantUser());
      expect(repo.softRemove).toHaveBeenCalled();
    });
  });
});
