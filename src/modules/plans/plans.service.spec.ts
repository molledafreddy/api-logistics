import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './plans.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';
import { PlanLimit } from './entities/plan-limit.entity';
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
  let planLimitRepo: Repository<PlanLimit>;

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
          provide: getRepositoryToken(PlanLimit),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
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
    planLimitRepo = module.get(getRepositoryToken(PlanLimit));
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

  // --- PlanLimit CRUD ---
  describe('PlanLimit CRUD', () => {
    const planId = 'plan-uuid';
    const limitId = 'limit-uuid';
    const mockPlan = { id: planId, name: 'Free' };
    const mockLimit = {
      id: limitId,
      planId,
      vertical: 'trucking',
      code: 'max_trucks',
      value: 5,
    };
    const dto = { vertical: 'trucking', code: 'max_trucks', value: 5 };

    it('createPlanLimit — crea el límite correctamente', async () => {
      (planRepo.findOne as jest.Mock).mockResolvedValue(mockPlan);
      (planLimitRepo.create as jest.Mock).mockReturnValue(mockLimit);
      (planLimitRepo.save as jest.Mock).mockResolvedValue(mockLimit);
      // sync hook: lee la tabla y materializa jsonb
      (planLimitRepo.find as jest.Mock).mockResolvedValue([mockLimit]);
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.createPlanLimit(planId, dto as any);

      expect(planRepo.findOne).toHaveBeenCalledWith({ where: { id: planId } });
      expect(planLimitRepo.create).toHaveBeenCalledWith({
        plan: mockPlan,
        planId,
        vertical: dto.vertical,
        code: dto.code,
        value: dto.value,
      });
      expect(planLimitRepo.save).toHaveBeenCalledWith(mockLimit);
      // sync hook materializa el jsonb agrupado por vertical
      expect(planRepo.update).toHaveBeenCalledWith(planId, {
        limits: { trucking: { max_trucks: 5 } },
      });
      expect(result).toEqual(mockLimit);
    });

    it('createPlanLimit — lanza NotFoundException si el plan no existe', async () => {
      (planRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.createPlanLimit(planId, dto as any)).rejects.toThrow(
        'Plan not found',
      );
    });

    it('findPlanLimits — retorna los límites del plan', async () => {
      (planLimitRepo.find as jest.Mock).mockResolvedValue([mockLimit]);

      const result = await service.findPlanLimits(planId);

      expect(planLimitRepo.find).toHaveBeenCalledWith({ where: { planId } });
      expect(result).toEqual([mockLimit]);
    });

    it('findPlanLimits — retorna array vacío si no hay límites', async () => {
      (planLimitRepo.find as jest.Mock).mockResolvedValue([]);
      const result = await service.findPlanLimits(planId);
      expect(result).toEqual([]);
    });

    it('updatePlanLimit — actualiza el límite correctamente', async () => {
      const updated = { ...mockLimit, value: 10 };
      (planLimitRepo.findOne as jest.Mock).mockResolvedValue({ ...mockLimit });
      (planLimitRepo.save as jest.Mock).mockResolvedValue(updated);
      // sync hook
      (planLimitRepo.find as jest.Mock).mockResolvedValue([updated]);
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.updatePlanLimit(limitId, {
        value: 10,
      } as any);

      expect(planLimitRepo.findOne).toHaveBeenCalledWith({
        where: { id: limitId },
      });
      expect(planLimitRepo.save).toHaveBeenCalled();
      expect(planRepo.update).toHaveBeenCalledWith(planId, {
        limits: { trucking: { max_trucks: 10 } },
      });
      expect(result).toEqual(updated);
    });

    it('updatePlanLimit — lanza NotFoundException si el límite no existe', async () => {
      (planLimitRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updatePlanLimit(limitId, { value: 10 } as any),
      ).rejects.toThrow('PlanLimit not found');
    });

    it('removePlanLimit — elimina el límite correctamente', async () => {
      (planLimitRepo.findOne as jest.Mock).mockResolvedValue({ ...mockLimit });
      (planLimitRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      // sync hook después del delete: tabla queda vacía
      (planLimitRepo.find as jest.Mock).mockResolvedValue([]);
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.removePlanLimit(limitId);
      expect(planLimitRepo.delete).toHaveBeenCalledWith(limitId);
      expect(planRepo.update).toHaveBeenCalledWith(planId, { limits: {} });
      expect(result).toEqual({ deleted: true });
    });

    it('removePlanLimit — lanza NotFoundException si el límite no existe', async () => {
      (planLimitRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.removePlanLimit(limitId)).rejects.toThrow(
        'PlanLimit not found',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Sprint A — Catálogo verticalizado + jsonb materializado
  // ─────────────────────────────────────────────────────────────
  describe('Sprint A: catálogo y límites efectivos', () => {
    it('syncPlanLimitsJsonb — agrupa filas por vertical y materializa jsonb', async () => {
      (planLimitRepo.find as jest.Mock).mockResolvedValue([
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 200 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 50 },
        { vertical: 'trucking', code: 'max_trucks', value: 10 },
      ]);
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const map = await service.syncPlanLimitsJsonb('plan-x');

      expect(map).toEqual({
        global: { maxShipmentsPerDay: 200, maxStopsPerOptimization: 50 },
        trucking: { max_trucks: 10 },
      });
      expect(planRepo.update).toHaveBeenCalledWith('plan-x', { limits: map });
    });

    it('syncPlanLimitsJsonb — devuelve {} si no hay filas', async () => {
      (planLimitRepo.find as jest.Mock).mockResolvedValue([]);
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const map = await service.syncPlanLimitsJsonb('plan-y');
      expect(map).toEqual({});
      expect(planRepo.update).toHaveBeenCalledWith('plan-y', { limits: {} });
    });

    it('getCatalog — usa createQueryBuilder filtrando is_active y code IS NOT NULL', async () => {
      const fakePlan = { id: 'p1', code: 'pro_courier' };
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([fakePlan]),
      };
      (planRepo as any).createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getCatalog();
      expect(result).toEqual([fakePlan]);
      expect(qb.where).toHaveBeenCalledWith('p.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('p.code IS NOT NULL');
    });

    it('updatePrice — actualiza price y devuelve el plan', async () => {
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (planRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'p1',
        price: 12345,
      });
      const result = await service.updatePrice('p1', 12345);
      expect(planRepo.update).toHaveBeenCalledWith('p1', { price: 12345 });
      expect(result).toEqual({ id: 'p1', price: 12345 });
    });

    it('updatePrice — rechaza price negativo', async () => {
      await expect(service.updatePrice('p1', -1)).rejects.toThrow(
        'price debe ser ≥ 0',
      );
    });

    it('updatePlanLimits — sobrescribe el jsonb completo', async () => {
      const limits = { global: { maxShipmentsPerDay: 500 } };
      (planRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (planRepo.findOne as jest.Mock).mockResolvedValue({ id: 'p1', limits });

      const result = await service.updatePlanLimits('p1', limits);
      expect(planRepo.update).toHaveBeenCalledWith('p1', { limits });
      expect(result).toEqual({ id: 'p1', limits });
    });

    it('updatePlanLimits — rechaza valores no-objeto', async () => {
      await expect(service.updatePlanLimits('p1', null as any)).rejects.toThrow(
        'limits debe ser un objeto PlanLimitsMap',
      );
      await expect(service.updatePlanLimits('p1', [] as any)).rejects.toThrow(
        'limits debe ser un objeto PlanLimitsMap',
      );
    });

    it('getEffectiveLimits — devuelve los limits del plan activo', async () => {
      const limits = { global: { maxShipmentsPerDay: 200 } };
      const mgrQuery = jest.fn().mockResolvedValue([{ limits }]);
      Object.defineProperty(planRepo, 'manager', {
        configurable: true,
        value: { query: mgrQuery },
      });
      const result = await service.getEffectiveLimits('company-1');
      expect(result).toEqual(limits);
      expect(mgrQuery).toHaveBeenCalled();
    });

    it('getEffectiveLimits — devuelve {} si no hay suscripción activa', async () => {
      const mgrQuery = jest.fn().mockResolvedValue([]);
      Object.defineProperty(planRepo, 'manager', {
        configurable: true,
        value: { query: mgrQuery },
      });
      const result = await service.getEffectiveLimits('company-2');
      expect(result).toEqual({});
    });
  });
});

describe('PlansService (cache flow)', () => {
  let service: PlansService;
  let planRepo: any;
  let permDefRepo: any;
  let planPermRepo: any;
  let cacheService: any;

  beforeEach(async () => {
    // Mock manager.query para soportar la consulta directa
    const mockManager = { query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: getRepositoryToken(Plan),
          useValue: { findOne: jest.fn(), manager: mockManager },
        },
        {
          provide: getRepositoryToken(PermissionDefinition),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(PlanPermission),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(PlanLimit),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        { provide: PermissionsCacheService, useFactory: mockCacheService },
      ],
    }).compile();
    service = module.get(PlansService);
    planRepo = module.get(getRepositoryToken(Plan));
    permDefRepo = module.get(getRepositoryToken(PermissionDefinition));
    planPermRepo = module.get(getRepositoryToken(PlanPermission));
    cacheService = module.get(PermissionsCacheService);
    // Inyectar el mock de manager aunque sea readonly
    Object.defineProperty(planRepo, 'manager', { value: mockManager });
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
    // Simular respuesta de la query directa
    planRepo.manager.query.mockResolvedValue([{ code: 'perm.code' }]);
    cacheService.setPermissionsCache.mockResolvedValue(undefined);
    const perms = await service.getEffectivePermissions('plan1');
    expect(perms).toEqual(['perm.code']);
    expect(cacheService.setPermissionsCache).toHaveBeenCalledWith('plan1', [
      'perm.code',
    ]);
  });
});
