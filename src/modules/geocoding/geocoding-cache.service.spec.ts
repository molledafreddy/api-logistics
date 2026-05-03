import { GeocodingCacheService } from './geocoding-cache.service';
import type { GeocodeFeature } from './geocoding.types';

/**
 * Sprint C.6 — Unit tests del cache de geocoding.
 *
 * Cubre:
 *   - normalización de query (case + diacríticos + whitespace)
 *   - cuantización de coords reverse (5 decimales ≈ ~1 m)
 *   - hit/miss básicos
 *   - tolerancia a fallos (cache desconectado, errores de Redis)
 */
describe('GeocodingCacheService', () => {
  const feature = (id: string): GeocodeFeature => ({
    placeId: id,
    formatted: `Addr ${id}`,
    coordinates: { lat: -33.4, lng: -70.6 },
    confidence: 0.9,
  });

  function makeCacheStub() {
    const store = new Map<string, unknown>();
    return {
      store,
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: unknown) => {
        store.set(k, v);
      }),
    };
  }

  function makeService(cache: any = makeCacheStub()) {
    const config = {
      get: jest.fn((key: string, def: unknown) =>
        key === 'GEOCODING_CACHE_TTL_SEC' ? 3600 : def,
      ),
    } as any;
    const svc = new GeocodingCacheService(cache, config);
    return { svc, cache, config };
  }

  it('getSearch devuelve null en miss', async () => {
    const { svc } = makeService();
    await expect(
      svc.getSearch('mock', 'Av. Bandera', undefined),
    ).resolves.toBeNull();
  });

  it('setSearch + getSearch devuelven el mismo array (hit)', async () => {
    const { svc, cache } = makeService();
    const features = [feature('a'), feature('b')];
    await svc.setSearch('mock', 'Av. Bandera', { country: 'cl' }, features);
    const hit = await svc.getSearch('mock', 'Av. Bandera', { country: 'cl' });
    expect(hit).toEqual(features);
    expect(cache.set).toHaveBeenCalledTimes(1);
    // TTL en ms (3600 s * 1000)
    expect(cache.set.mock.calls[0][2]).toBe(3600 * 1000);
  });

  it('normaliza query: mayúsculas, espacios y diacríticos comparten clave', async () => {
    const { svc, cache } = makeService();
    await svc.setSearch('mock', 'Av. Apoquindo  4501', undefined, [
      feature('x'),
    ]);
    const hit = await svc.getSearch('mock', '  AV. APOQUÍNDO 4501 ', undefined);
    expect(hit).toEqual([feature('x')]);
    // Solo una entrada en el store, prueba la dedupe
    expect(cache.store.size).toBe(1);
  });

  it('reverse: lat/lng diferentes en el 6º decimal comparten clave', async () => {
    const { svc, cache } = makeService();
    await svc.setReverse(
      'mock',
      { lat: -33.41723, lng: -70.60441 },
      undefined,
      [feature('r')],
    );
    const hit = await svc.getReverse(
      'mock',
      { lat: -33.417234, lng: -70.604414 },
      undefined,
    );
    expect(hit).toEqual([feature('r')]);
    expect(cache.store.size).toBe(1);
  });

  it('reverse: cambio en el 5º decimal genera clave distinta (miss)', async () => {
    const { svc } = makeService();
    await svc.setReverse(
      'mock',
      { lat: -33.41723, lng: -70.60441 },
      undefined,
      [feature('r1')],
    );
    const hit = await svc.getReverse(
      'mock',
      { lat: -33.41799, lng: -70.60441 },
      undefined,
    );
    expect(hit).toBeNull();
  });

  it('cache desconectado (null) → no-op silencioso', async () => {
    const { svc } = makeService(null);
    await expect(
      svc.setSearch('mock', 'foo bar', undefined, [feature('z')]),
    ).resolves.toBeUndefined();
    await expect(
      svc.getSearch('mock', 'foo bar', undefined),
    ).resolves.toBeNull();
  });

  it('error de Redis en read no propaga (logueado, devuelve null)', async () => {
    const cache = {
      get: jest.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
      set: jest.fn(),
    };
    const { svc } = makeService(cache);
    await expect(
      svc.getSearch('mock', 'av providencia', undefined),
    ).resolves.toBeNull();
  });

  it('error de Redis en write no propaga', async () => {
    const cache = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => {
        throw new Error('OOM');
      }),
    };
    const { svc } = makeService(cache);
    await expect(
      svc.setSearch('mock', 'av providencia', undefined, [feature('q')]),
    ).resolves.toBeUndefined();
  });
});
