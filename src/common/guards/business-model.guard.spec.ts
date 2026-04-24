import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessModelGuard } from './business-model.guard';
import { BusinessModel } from '../enums/business-model.enum';
import { UserRole } from '../enums/user-role.enum';

describe('BusinessModelGuard', () => {
  let guard: BusinessModelGuard;
  let reflector: Reflector;
  let companyRepo: any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    companyRepo = { findOne: jest.fn() };
    guard = new BusinessModelGuard(reflector, companyRepo);
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

  it('permite si no hay decorador', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).resolves.toBe(true);
    expect(companyRepo.findOne).not.toHaveBeenCalled();
  });

  it('permite a SUPER_ADMIN', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.ENTERPRISE,
    ]);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.SUPER_ADMIN })),
    ).resolves.toBe(true);
  });

  it('deniega si no hay usuario', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.INDEPENDENT,
    ]);
    await expect(guard.canActivate(mockContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deniega si el usuario no tiene companyId', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.INDEPENDENT,
    ]);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite si Company.businessModel coincide', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.SMALL_FLEET,
      BusinessModel.ENTERPRISE,
    ]);
    companyRepo.findOne.mockResolvedValue({
      id: 'c1',
      businessModel: BusinessModel.ENTERPRISE,
    });
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).resolves.toBe(true);
  });

  it('deniega si Company.businessModel no coincide', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.ENTERPRISE,
    ]);
    companyRepo.findOne.mockResolvedValue({
      id: 'c1',
      businessModel: BusinessModel.INDEPENDENT,
    });
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deniega si la empresa no existe', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.INDEPENDENT,
    ]);
    companyRepo.findOne.mockResolvedValue(null);
    await expect(
      guard.canActivate(mockContext({ role: UserRole.ADMIN, companyId: 'c1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('usa caché por request', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      BusinessModel.INDEPENDENT,
    ]);
    const ctx = mockContext(
      { role: UserRole.ADMIN, companyId: 'c1' },
      { __companyBusinessModel: BusinessModel.INDEPENDENT },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(companyRepo.findOne).not.toHaveBeenCalled();
  });
});
