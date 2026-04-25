import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SuperAdminGuard } from './super-admin.guard';
import { UserRole } from '../enums/user-role.enum';

describe('SuperAdminGuard', () => {
  const mkCtx = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as never;

  it('allows when @SuperAdmin not set', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue(false);
    expect(new SuperAdminGuard(refl).canActivate(mkCtx(null))).toBe(true);
  });
  it('throws when no user', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue(true);
    expect(() =>
      new SuperAdminGuard(refl).canActivate(mkCtx(undefined)),
    ).toThrow(ForbiddenException);
  });
  it('throws when role is not super_admin', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue(true);
    expect(() =>
      new SuperAdminGuard(refl).canActivate(mkCtx({ role: UserRole.ADMIN })),
    ).toThrow(ForbiddenException);
  });
  it('allows super_admin', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue(true);
    expect(
      new SuperAdminGuard(refl).canActivate(
        mkCtx({ role: UserRole.SUPER_ADMIN }),
      ),
    ).toBe(true);
  });
});
