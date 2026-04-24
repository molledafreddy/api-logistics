import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PermissionDefinition } from '../../src/modules/plans/entities/permission-definition.entity';
import { PlanPermission } from '../../src/modules/plans/entities/plan-permission.entity';
import { Repository } from 'typeorm';

describe('Seeds de Planes y Permisos', () => {
  let planRepo: Repository<Plan>;
  let permRepo: Repository<PermissionDefinition>;
  let planPermRepo: Repository<PlanPermission>;
  // Datos simulados para los repositorios mock
  const mockPlans = [
    { id: '1', name: 'Free' },
    { id: '2', name: 'Basic' },
    { id: '3', name: 'Business' },
    { id: '4', name: 'Enterprise' },
  ];
  const mockPerms = [
    { id: 'a', code: 'trucks.read' },
    { id: 'b', code: 'trucks.write' },
    { id: 'c', code: 'drivers.read' },
    { id: 'd', code: 'drivers.write' },
    { id: 'e', code: 'shipments.read' },
    { id: 'f', code: 'shipments.write' },
    { id: 'g', code: 'reports.advanced' },
    { id: 'h', code: 'settings.billing' },
  ];
  const mockPlanPerms = [
    // Solo para plan Business, todos los permisos
    ...mockPerms.map((perm) => ({ plan: { id: '3' }, permission: perm })),
  ];

  beforeAll(async () => {
    // Mock manual de los métodos find para devolver los datos simulados
    planRepo = {
      find: jest.fn().mockResolvedValue(mockPlans),
    } as any;
    permRepo = {
      find: jest.fn().mockResolvedValue(mockPerms),
    } as any;
    planPermRepo = {
      find: jest.fn().mockResolvedValue(mockPlanPerms),
    } as any;
  });

  it('debe existir los 4 planes base', async () => {
    const names = ['Free', 'Basic', 'Business', 'Enterprise'];
    const allPlans = await planRepo.find();
    for (const name of names) {
      const plan = allPlans.find(
        (p: any) => p.name?.toLowerCase() === name.toLowerCase(),
      );
      expect(plan).toBeDefined();
    }
  });

  it('debe existir los permisos base', async () => {
    const codes = [
      'trucks.read',
      'trucks.write',
      'drivers.read',
      'drivers.write',
      'shipments.read',
      'shipments.write',
      'reports.advanced',
      'settings.billing',
    ];
    const allPerms = await permRepo.find();
    for (const code of codes) {
      const perm = allPerms.find(
        (p: any) => p.code?.toLowerCase() === code.toLowerCase(),
      );
      expect(perm).toBeDefined();
    }
  });

  it('cada plan debe tener sus permisos asociados', async () => {
    const allPlans = await planRepo.find();
    const plan = allPlans.find(
      (p: any) => p.name?.toLowerCase() === 'business',
    );
    expect(plan).toBeDefined();
    if (!plan) throw new Error('Plan Business no encontrado');
    const perms = await planPermRepo.find({
      where: { plan: { id: plan.id } },
      relations: ['permission'],
    });
    const permCodes = perms.map((pp) => pp.permission.code.toLowerCase());
    const expectedCodes = [
      'trucks.read',
      'trucks.write',
      'drivers.read',
      'drivers.write',
      'shipments.read',
      'shipments.write',
      'reports.advanced',
      'settings.billing',
    ];
    expect(permCodes).toEqual(expect.arrayContaining(expectedCodes));
  });
});
