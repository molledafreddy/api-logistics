import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServiceTypeGuard } from './service-type.guard';
import { ServiceType } from '../enums/service-type.enum';
import { UserRole } from '../enums/user-role.enum';

describe('ServiceTypeGuard', () => {
  let guard: ServiceTypeGuard;
  let reflector: Reflector;
  let companyRepo: any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    companyRepo = { findOne: jest.fn() };
    guard = new ServiceTypeGuard(reflector, companyRepo);
  });

  function mockContext(
    userData: any,
    requestOverrides: any = {},
  ): ExecutionContext {
    const request = { user: userData, ...requestOverrides };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('permite si no hay decorador (metadata vacío)', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).resolves.toBe(true);
    expect(companyRepo.findOne).not.toHaveBeenCalled();
  });

  it('permite a SUPER_ADMIN aunque no cumpla el tipo', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.PASSENGER,
    ]);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.SUPER_ADMIN })),
    ).resolves.toBe(true);
    expect(companyRepo.findOne).not.toHaveBeenCalled();
  });

  it('deniega si no hay usuario', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.FREIGHT,
    ]);
    await expect(guard.canActivate(mockContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deniega si el usuario no tiene companyId', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.FREIGHT,
    ]);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite si Company.serviceType coincide con el requerido', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.FREIGHT,
    ]);
    companyRepo.findOne.mockResolvedValue({
      id: 'c1',
      serviceType: ServiceType.FREIGHT,
    });
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).resolves.toBe(true);
  });

  it('permite si Company.serviceType === MIXED para cualquier requerido', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.PASSENGER,
    ]);
    companyRepo.findOne.mockResolvedValue({
      id: 'c1',
      serviceType: ServiceType.MIXED,
    });
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).resolves.toBe(true);
  });

  it('deniega si Company.serviceType no coincide', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.PASSENGER,
    ]);
    companyRepo.findOne.mockResolvedValue({
      id: 'c1',
      serviceType: ServiceType.FREIGHT,
    });
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deniega si la empresa no existe', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.FREIGHT,
    ]);
    companyRepo.findOne.mockResolvedValue(null);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('usa caché por request y no vuelve a consultar DB', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      ServiceType.FREIGHT,
    ]);
    const ctx = mockContext(
      { role: UserRole.ADMIN, companyId: 'c1' },
      { __companyServiceType: ServiceType.FREIGHT },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(companyRepo.findOne).not.toHaveBeenCalled();
  });
});
