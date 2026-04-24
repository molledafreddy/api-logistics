import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './plans.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';
import { Repository } from 'typeorm';
import { PermissionsCacheService } from './permissions-cache.service';

const mockCacheService = () => ({
  getPermissionsCache: jest.fn(),
  setPermissionsCache: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
});

describe('PlansService', () => {
  let service: PlansService;
  let planRepo: Repository<Plan>;
  let permDefRepo: Repository<PermissionDefinition>;
  let planPermRepo: Repository<PlanPermission>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: getRepositoryToken(Plan),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PermissionDefinition),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PlanPermission),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
            invalidatePermissionsCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    planRepo = module.get(getRepositoryToken(Plan));
    permDefRepo = module.get(getRepositoryToken(PermissionDefinition));
    planPermRepo = module.get(getRepositoryToken(PlanPermission));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a plan', async () => {
    const dto = { name: 'Test', price: 10, interval: 'month', is_active: true };
    await service.createPlan(dto as any);
    expect(planRepo.save).toHaveBeenCalledWith(dto);
  });

  it('should find all plans', async () => {
    await service.findAllPlans();
    expect(planRepo.find).toHaveBeenCalled();
  });

  it('should find one plan', async () => {
    (planRepo.findOne as jest.Mock).mockResolvedValue({ id: 'id' });
    const result = await service.findOnePlan('id');
    expect(planRepo.findOne).toHaveBeenCalledWith({ where: { id: 'id' } });
    expect(result).toEqual({ id: 'id' });
  });

  it('should throw if plan not found', async () => {
    (planRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.findOnePlan('id')).rejects.toThrow('Plan not found');
  });

  it('should update a plan', async () => {
    (planRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'id',
      name: 'Updated',
    });
    await service.updatePlan('id', { name: 'Updated' } as any);
    expect(planRepo.update).toHaveBeenCalledWith('id', { name: 'Updated' });
  });

  it('should remove a plan', async () => {
    (planRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
    const result = await service.removePlan('id');
    expect(planRepo.delete).toHaveBeenCalledWith('id');
    expect(result).toEqual({ deleted: true });
  });

  it('should throw if plan not found on remove', async () => {
    (planRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
    await expect(service.removePlan('id')).rejects.toThrow('Plan not found');
  });

  it('should create a permission', async () => {
    await service.createPermission({
      code: 'perm',
      description: 'desc',
    } as any);
    expect(permDefRepo.save).toHaveBeenCalledWith({
      code: 'perm',
      description: 'desc',
    });
  });

  it('should find all permissions', async () => {
    await service.findAllPermissions();
    expect(permDefRepo.find).toHaveBeenCalled();
  });

  it('should find one permission', async () => {
    (permDefRepo.findOne as jest.Mock).mockResolvedValue({ id: 'id' });
    const result = await service.findOnePermission('id');
    expect(permDefRepo.findOne).toHaveBeenCalledWith({ where: { id: 'id' } });
    expect(result).toEqual({ id: 'id' });
  });

  it('should throw if permission not found', async () => {
    (permDefRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.findOnePermission('id')).rejects.toThrow(
      'Permission not found',
    );
  });

  it('should update a permission', async () => {
    (permDefRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'id',
      code: 'perm',
    });
    await service.updatePermission('id', { description: 'new' } as any);
    expect(permDefRepo.update).toHaveBeenCalledWith('id', {
      description: 'new',
    });
  });

  it('should remove a permission', async () => {
    (permDefRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
    const result = await service.removePermission('id');
    expect(permDefRepo.delete).toHaveBeenCalledWith('id');
    expect(result).toEqual({ deleted: true });
  });

  it('should throw if permission not found on remove', async () => {
    (permDefRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
    await expect(service.removePermission('id')).rejects.toThrow(
      'Permission not found',
    );
  });

  it('should assign permission to plan', async () => {
    (planRepo.findOne as jest.Mock).mockResolvedValue({ id: 'pid' });
    (permDefRepo.findOne as jest.Mock).mockResolvedValue({ id: 'permid' });
    (planPermRepo.create as jest.Mock).mockReturnValue({
      plan: { id: 'pid' },
      permission: { id: 'permid' },
    });
    await service.assignPermissionToPlan({
      planId: 'pid',
      permissionId: 'permid',
    } as any);
    expect(planPermRepo.create).toHaveBeenCalledWith({
      plan: { id: 'pid' },
      permission: { id: 'permid' },
    });
    expect(planPermRepo.save).toHaveBeenCalled();
  });

  it('should throw if plan or permission not found on assign', async () => {
    (planRepo.findOne as jest.Mock).mockResolvedValue(null);
    (permDefRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      service.assignPermissionToPlan({
        planId: 'pid',
        permissionId: 'permid',
      } as any),
    ).rejects.toThrow('Plan or Permission not found');
  });
});

describe('PlansService (cache flow)', () => {
  let service: PlansService;
  let planRepo: any;
  let permDefRepo: any;
  let planPermRepo: any;
  let cacheService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: getRepositoryToken(Plan), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(PermissionDefinition),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(PlanPermission),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        { provide: PermissionsCacheService, useFactory: mockCacheService },
      ],
    }).compile();
    service = module.get(PlansService);
    planRepo = module.get(getRepositoryToken(Plan));
    permDefRepo = module.get(getRepositoryToken(PermissionDefinition));
    planPermRepo = module.get(getRepositoryToken(PlanPermission));
    cacheService = module.get(PermissionsCacheService);
  });

  it('debe invalidar el cache al asignar un permiso', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 'plan1',
      planPermissions: [],
      name: 'Basic',
    });
    permDefRepo.findOne.mockResolvedValue({ id: 'perm1', code: 'perm.code' });
    planPermRepo.create.mockReturnValue({ id: 'pp1' });
    planPermRepo.save.mockResolvedValue({ id: 'pp1' });
    cacheService.invalidatePermissionsCache.mockResolvedValue(undefined);

    const dto = { planId: 'plan1', permissionId: 'perm1' };
    await service.assignPermissionToPlan(dto);
    expect(cacheService.invalidatePermissionsCache).toHaveBeenCalledWith(
      'plan1',
    );
  });

  it('debe usar el cache si existe', async () => {
    cacheService.getPermissionsCache.mockResolvedValue(['perm.code']);
    const perms = await service.getEffectivePermissions('plan1');
    expect(perms).toEqual(['perm.code']);
  });

  it('debe calcular y cachear si no hay cache', async () => {
    cacheService.getPermissionsCache.mockResolvedValue(null);
    planRepo.findOne.mockResolvedValue({
      id: 'plan1',
      planPermissions: [{ permission: { code: 'perm.code' } }],
    });
    cacheService.setPermissionsCache.mockResolvedValue(undefined);
    const perms = await service.getEffectivePermissions('plan1');
    expect(perms).toEqual(['perm.code']);
    expect(cacheService.setPermissionsCache).toHaveBeenCalledWith('plan1', [
      'perm.code',
    ]);
  });
});
