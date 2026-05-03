import { BadRequestException } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import type { GeocodeFeature, IGeocodingProvider } from './geocoding.types';

describe('GeocodingService', () => {
  const mockFeature = (id: string): GeocodeFeature => ({
    placeId: id,
    formatted: `Addr ${id}`,
    coordinates: { lat: -33.4, lng: -70.6 },
    confidence: 0.9,
  });

  function makeProvider(): jest.Mocked<IGeocodingProvider> {
    return {
      providerName: 'mock',
      search: jest.fn().mockResolvedValue([mockFeature('a')]),
      reverse: jest.fn().mockResolvedValue([mockFeature('b')]),
    } as any;
  }

  function makeCache() {
    return {
      getSearch: jest.fn().mockResolvedValue(null),
      setSearch: jest.fn().mockResolvedValue(undefined),
      getReverse: jest.fn().mockResolvedValue(null),
      setReverse: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  function makeConfig() {
    return {
      get: jest.fn((_k: string, def: unknown) => def),
    } as any;
  }

  it('GEO-001 — rechaza queries < 3 chars', async () => {
    const svc = new GeocodingService(makeProvider(), makeCache(), makeConfig());
    await expect(svc.search('ab')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('search miss → llama al provider y persiste en cache', async () => {
    const provider = makeProvider();
    const cache = makeCache();
    const svc = new GeocodingService(provider, cache, makeConfig());
    const out = await svc.search('Av. Bandera');
    expect(out.cached).toBe(false);
    expect(out.features).toHaveLength(1);
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(cache.setSearch).toHaveBeenCalledTimes(1);
  });

  it('search hit → devuelve cache, no llama al provider', async () => {
    const provider = makeProvider();
    const cache = makeCache();
    cache.getSearch.mockResolvedValue([mockFeature('cached')]);
    const svc = new GeocodingService(provider, cache, makeConfig());
    const out = await svc.search('Av. Bandera');
    expect(out.cached).toBe(true);
    expect(out.features[0].placeId).toBe('cached');
    expect(provider.search).not.toHaveBeenCalled();
    expect(cache.setSearch).not.toHaveBeenCalled();
  });

  it('search aplica defaultCountry si no viene', async () => {
    const provider = makeProvider();
    const config = {
      get: jest.fn((k: string, def: unknown) =>
        k === 'GEOCODING_DEFAULT_COUNTRY' ? 'cl' : def,
      ),
    } as any;
    const svc = new GeocodingService(provider, makeCache(), config);
    await svc.search('Av. Bandera');
    expect(provider.search).toHaveBeenCalledWith(
      'Av. Bandera',
      expect.objectContaining({ country: 'cl' }),
    );
  });

  it('reverse: GEO-003 si lat/lng fuera de rango', async () => {
    const svc = new GeocodingService(makeProvider(), makeCache(), makeConfig());
    await expect(svc.reverse({ lat: 999, lng: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.reverse({ lat: 0, lng: -999 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.reverse({ lat: NaN, lng: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reverse: hit usa cache', async () => {
    const provider = makeProvider();
    const cache = makeCache();
    cache.getReverse.mockResolvedValue([mockFeature('rcached')]);
    const svc = new GeocodingService(provider, cache, makeConfig());
    const out = await svc.reverse({ lat: -33.4, lng: -70.6 });
    expect(out.cached).toBe(true);
    expect(provider.reverse).not.toHaveBeenCalled();
  });

  it('validate devuelve null si no hay matches (GEO-002)', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValue([]);
    const svc = new GeocodingService(provider, makeCache(), makeConfig());
    const out = await svc.validate('Calle inexistente 9999');
    expect(out).toBeNull();
  });

  it('validate devuelve el primer match', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValue([
      mockFeature('best'),
      mockFeature('alt'),
    ]);
    const svc = new GeocodingService(provider, makeCache(), makeConfig());
    const out = await svc.validate('Av. Bandera 84');
    expect(out?.placeId).toBe('best');
  });
});
