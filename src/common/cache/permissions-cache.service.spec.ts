import { PermissionsCacheService } from './permissions-cache.service';

describe('PermissionsCacheService', () => {
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let service: PermissionsCacheService;

  beforeEach(() => {
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    service = new PermissionsCacheService(cache as any);
  });

  describe('get', () => {
    it('devuelve el valor cacheado', async () => {
      cache.get.mockResolvedValue(['p1', 'p2']);
      await expect(service.get('c1')).resolves.toEqual(['p1', 'p2']);
      expect(cache.get).toHaveBeenCalledWith('company:c1:permissions');
    });

    it('devuelve null si no hay valor', async () => {
      cache.get.mockResolvedValue(undefined);
      await expect(service.get('c1')).resolves.toBeNull();
    });

    it('no rompe si el cache tira (degrada a null)', async () => {
      cache.get.mockRejectedValue(new Error('redis down'));
      await expect(service.get('c1')).resolves.toBeNull();
    });
  });

  describe('set / invalidate', () => {
    it('escribe con TTL por defecto en ms', async () => {
      await service.set('c1', ['p1']);
      expect(cache.set).toHaveBeenCalledWith(
        'company:c1:permissions',
        ['p1'],
        5 * 60 * 1000,
      );
    });

    it('respeta TTL personalizado', async () => {
      await service.set('c1', ['p1'], 1000);
      expect(cache.set).toHaveBeenCalledWith(
        'company:c1:permissions',
        ['p1'],
        1000,
      );
    });

    it('invalida la clave', async () => {
      await service.invalidate('c1');
      expect(cache.del).toHaveBeenCalledWith('company:c1:permissions');
    });
  });

  describe('getOrLoad', () => {
    it('devuelve cache hit sin invocar el loader', async () => {
      cache.get.mockResolvedValue(['cached']);
      const loader = jest.fn();
      await expect(service.getOrLoad('c1', loader)).resolves.toEqual([
        'cached',
      ]);
      expect(loader).not.toHaveBeenCalled();
    });

    it('en miss: invoca el loader y guarda', async () => {
      cache.get.mockResolvedValue(undefined);
      const loader = jest.fn().mockResolvedValue(['fresh']);
      await expect(service.getOrLoad('c1', loader)).resolves.toEqual(['fresh']);
      expect(loader).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith(
        'company:c1:permissions',
        ['fresh'],
        5 * 60 * 1000,
      );
    });
  });

  describe('compat API antigua', () => {
    it('setPermissionsCache convierte ttl en segundos a ms', async () => {
      await service.setPermissionsCache('c1', ['p1'], 60);
      expect(cache.set).toHaveBeenCalledWith(
        'company:c1:permissions',
        ['p1'],
        60_000,
      );
    });
  });
});
