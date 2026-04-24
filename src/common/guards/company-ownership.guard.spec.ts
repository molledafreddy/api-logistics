import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyOwnershipGuard } from './company-ownership.guard';
import { UserRole } from '../enums/user-role.enum';

const ctxFor = (
  user: any,
  source: { params?: any; body?: any; query?: any } = {},
  publicMeta = false,
): ExecutionContext => {
  const handler = () => undefined;
  if (publicMeta) Reflect.defineMetadata('isPublic', true, handler);
  return {
    getHandler: () => handler,
    getClass: () => class Dummy {},
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: source.params ?? {},
        body: source.body ?? {},
        query: source.query ?? {},
      }),
    }),
  } as unknown as ExecutionContext;
};

describe('CompanyOwnershipGuard', () => {
  let guard: CompanyOwnershipGuard;

  beforeEach(() => {
    guard = new CompanyOwnershipGuard(new Reflector());
  });

  it('permite endpoints @Public()', () => {
    expect(guard.canActivate(ctxFor(null, {}, true))).toBe(true);
  });

  it('permite si no hay user en la request (lo maneja JwtAuthGuard)', () => {
    expect(guard.canActivate(ctxFor(undefined))).toBe(true);
  });

  it('super_admin pasa siempre aunque companyId no coincida', () => {
    const ctx = ctxFor(
      { sub: 'u1', role: UserRole.SUPER_ADMIN, companyId: 'c1' },
      { params: { companyId: 'OTRA' } },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite si la request no trae companyId explícito', () => {
    const ctx = ctxFor({
      sub: 'u1',
      role: UserRole.ADMIN,
      companyId: 'c1',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite si companyId del param coincide con el del user', () => {
    const ctx = ctxFor(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { params: { companyId: 'c1' } },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bloquea si user.companyId !== params.companyId', () => {
    const ctx = ctxFor(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { params: { companyId: 'c2' } },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('bloquea si user.companyId !== body.companyId', () => {
    const ctx = ctxFor(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { body: { companyId: 'c2' } },
    );
    expect(() => guard.canActivate(ctx)).toThrow(/No tienes acceso/);
  });

  it('bloquea si user.companyId !== query.companyId', () => {
    const ctx = ctxFor(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { query: { companyId: 'c2' } },
    );
    expect(() => guard.canActivate(ctx)).toThrow(/No tienes acceso/);
  });

  it('bloquea si user no tiene companyId pero la request lo exige', () => {
    const ctx = ctxFor(
      { sub: 'u1', role: UserRole.ADMIN, companyId: null },
      { params: { companyId: 'c1' } },
    );
    expect(() => guard.canActivate(ctx)).toThrow(/No perteneces/);
  });
});
