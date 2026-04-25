import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../enums/user-role.enum';

describe('RolesGuard', () => {
  const mkCtx = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as never;

  it('allows when no roles required', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue(undefined);
    expect(new RolesGuard(refl).canActivate(mkCtx(null))).toBe(true);
  });
  it('allows when required roles is empty array', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue([]);
    expect(new RolesGuard(refl).canActivate(mkCtx({}))).toBe(true);
  });
  it('throws when no user in request', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(() => new RolesGuard(refl).canActivate(mkCtx(undefined))).toThrow(
      ForbiddenException,
    );
  });
  it('always allows super_admin', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue([UserRole.MANAGER]);
    expect(
      new RolesGuard(refl).canActivate(mkCtx({ role: UserRole.SUPER_ADMIN })),
    ).toBe(true);
  });
  it('throws when role not in required', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(() =>
      new RolesGuard(refl).canActivate(mkCtx({ role: UserRole.DRIVER })),
    ).toThrow(ForbiddenException);
  });
  it('allows when role matches', () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(
      new RolesGuard(refl).canActivate(mkCtx({ role: UserRole.ADMIN })),
    ).toBe(true);
  });
});
