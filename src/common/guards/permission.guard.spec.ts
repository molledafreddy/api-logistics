import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionsCacheService } from '../cache/permissions-cache.service';
import { UserRole } from '../enums/user-role.enum';

const buildContext = (user: any, handlerMeta: Record<string, unknown> = {}) => {
  const handler = () => undefined;
  Object.entries(handlerMeta).forEach(([k, v]) =>
    Reflect.defineMetadata(k, v, handler),
  );
  const ctx = {
    getHandler: () => handler,
    getClass: () => class Dummy {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return ctx;
};

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let dataSource: { query: jest.Mock };
  let cache: jest.Mocked<PermissionsCacheService>;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      getOrLoad: jest.fn(),
    } as any;
    guard = new PermissionGuard(new Reflector(), dataSource as any, cache);
  });

  it('permite endpoints @Public()', async () => {
    const ctx = buildContext(null, { isPublic: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(cache.getOrLoad).not.toHaveBeenCalled();
  });

  it('permite handlers sin @Permissions() (no enforcement)', async () => {
    const ctx = buildContext({ sub: 'u1', role: UserRole.ADMIN });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(cache.getOrLoad).not.toHaveBeenCalled();
  });

  it('falla 403 si no hay user en la request', async () => {
    const ctx = buildContext(undefined, {
      permissions: ['trucks.create'],
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('super_admin pasa siempre', async () => {
    const ctx = buildContext(
      { sub: 'u1', role: UserRole.SUPER_ADMIN, companyId: 'c1' },
      { permissions: ['trucks.create'] },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(cache.getOrLoad).not.toHaveBeenCalled();
  });

  it('falla 403 si user no tiene companyId', async () => {
    const ctx = buildContext(
      { sub: 'u1', role: UserRole.ADMIN, companyId: null },
      { permissions: ['trucks.create'] },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Usuario sin empresa asignada',
    );
  });

  it('usa cache.getOrLoad y permite si tiene todos los permisos', async () => {
    cache.getOrLoad.mockResolvedValue(['trucks.create', 'trucks.read']);
    const ctx = buildContext(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { permissions: ['trucks.create'] },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(cache.getOrLoad).toHaveBeenCalledWith('c1', expect.any(Function));
  });

  it('falla 403 si falta algún permiso (lista los faltantes)', async () => {
    cache.getOrLoad.mockResolvedValue(['trucks.read']);
    const ctx = buildContext(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { permissions: ['trucks.create', 'trucks.delete'] },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /trucks\.create.*trucks\.delete/,
    );
  });

  it('loader carga permisos desde DB y los normaliza (set único)', async () => {
    cache.getOrLoad.mockImplementation(async (_id, loader) => loader());
    dataSource.query.mockResolvedValue([
      { code: 'a' },
      { code: 'b' },
      { code: 'a' },
    ]);
    const ctx = buildContext(
      { sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
      { permissions: ['a'] },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM subscriptions'),
      ['c1'],
    );
  });
});
