import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

describe('PlansController', () => {
  let controller: PlansController;
  let service: PlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        {
          provide: PlansService,
          useValue: {
            createPlan: jest.fn(),
            findAllPlans: jest.fn(),
            findOnePlan: jest.fn(),
            updatePlan: jest.fn(),
            removePlan: jest.fn(),
            createPermission: jest.fn(),
            findAllPermissions: jest.fn(),
            findOnePermission: jest.fn(),
            updatePermission: jest.fn(),
            removePermission: jest.fn(),
            assignPermissionToPlan: jest.fn(),
            createPlanLimit: jest.fn(),
            findPlanLimits: jest.fn(),
            updatePlanLimit: jest.fn(),
            removePlanLimit: jest.fn(),
          },
        },
        {
          provide: PermissionGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
      ],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PlansController>(PlansController);
    service = module.get<PlansService>(PlansService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createPlan', async () => {
    const dto = { name: 'Test', price: 10, interval: 'month', is_active: true };
    await controller.createPlan(dto as any);
    expect(service.createPlan).toHaveBeenCalledWith(dto);
  });

  it('should call findAllPlans', async () => {
    await controller.findAllPlans();
    expect(service.findAllPlans).toHaveBeenCalled();
  });

  it('should call findOnePlan', async () => {
    await controller.findOnePlan('id');
    expect(service.findOnePlan).toHaveBeenCalledWith('id');
  });

  it('should call updatePlan', async () => {
    await controller.updatePlan('id', { name: 'Updated' } as any);
    expect(service.updatePlan).toHaveBeenCalledWith('id', { name: 'Updated' });
  });

  it('should call removePlan', async () => {
    await controller.removePlan('id');
    expect(service.removePlan).toHaveBeenCalledWith('id');
  });

  it('should call createPermission', async () => {
    await controller.createPermission({
      code: 'perm',
      description: 'desc',
    } as any);
    expect(service.createPermission).toHaveBeenCalledWith({
      code: 'perm',
      description: 'desc',
    });
  });

  it('should call findAllPermissions', async () => {
    await controller.findAllPermissions();
    expect(service.findAllPermissions).toHaveBeenCalled();
  });

  it('should call findOnePermission', async () => {
    await controller.findOnePermission('id');
    expect(service.findOnePermission).toHaveBeenCalledWith('id');
  });

  it('should call updatePermission', async () => {
    await controller.updatePermission('id', { description: 'new' } as any);
    expect(service.updatePermission).toHaveBeenCalledWith('id', {
      description: 'new',
    });
  });

  it('should call removePermission', async () => {
    await controller.removePermission('id');
    expect(service.removePermission).toHaveBeenCalledWith('id');
  });

  it('should call assignPermission', async () => {
    await controller.assignPermission({
      planId: 'pid',
      permissionId: 'permid',
    } as any);
    expect(service.assignPermissionToPlan).toHaveBeenCalledWith({
      planId: 'pid',
      permissionId: 'permid',
    });
  });

  // --- Plan Limits ---
  describe('PlanLimit endpoints', () => {
    const planId = 'plan-uuid';
    const limitId = 'limit-uuid';
    const mockLimit = {
      id: limitId,
      planId,
      vertical: 'trucking',
      code: 'max_trucks',
      value: 5,
    };
    const createDto = { vertical: 'trucking', code: 'max_trucks', value: 5 };

    it('createPlanLimit — delega al servicio con planId y dto', async () => {
      (service.createPlanLimit as jest.Mock).mockResolvedValue(mockLimit);
      const result = await controller.createPlanLimit(planId, createDto as any);
      expect(service.createPlanLimit).toHaveBeenCalledWith(planId, createDto);
      expect(result).toEqual(mockLimit);
    });

    it('findPlanLimits — delega al servicio con planId', async () => {
      (service.findPlanLimits as jest.Mock).mockResolvedValue([mockLimit]);
      const result = await controller.findPlanLimits(planId);
      expect(service.findPlanLimits).toHaveBeenCalledWith(planId);
      expect(result).toEqual([mockLimit]);
    });

    it('updatePlanLimit — delega al servicio con id y dto', async () => {
      const updated = { ...mockLimit, value: 20 };
      (service.updatePlanLimit as jest.Mock).mockResolvedValue(updated);
      const result = await controller.updatePlanLimit(limitId, {
        value: 20,
      } as any);
      expect(service.updatePlanLimit).toHaveBeenCalledWith(limitId, {
        value: 20,
      });
      expect(result).toEqual(updated);
    });

    it('removePlanLimit — delega al servicio con id', async () => {
      (service.removePlanLimit as jest.Mock).mockResolvedValue({
        deleted: true,
      });
      const result = await controller.removePlanLimit(limitId);
      expect(service.removePlanLimit).toHaveBeenCalledWith(limitId);
      expect(result).toEqual({ deleted: true });
    });
  });
});
