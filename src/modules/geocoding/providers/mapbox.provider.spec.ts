import { ServiceUnavailableException } from '@nestjs/common';
import { MapboxGeocodingProvider } from './mapbox.provider';

/**
 * Sprint C.6 — Unit tests del provider Mapbox (Geocoding v6).
 *
 * Mocks `global.fetch` para no llamar a la red.
 */
describe('MapboxGeocodingProvider', () => {
  const baseConfig = (token = 'tok-test') =>
    ({
      get: jest.fn((key: string, def: unknown) => {
        if (key === 'MAPBOX_TOKEN') return token;
        if (key === 'GEOCODING_DEFAULT_COUNTRY') return 'cl';
        return def;
      }),
    }) as any;

  function fetchOk(body: unknown) {
    return jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }

  function fakeGeoCollection(overrides: Partial<any> = {}) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          id: 'addr.123',
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-70.6044, -33.4172] },
          properties: {
            mapbox_id: 'addr.123',
            full_address: 'Av. Apoquindo 4501, Las Condes, Chile',
            feature_type: 'address',
            match_code: { confidence: 'exact' },
            context: {
              country: { country_code: 'CL', name: 'Chile' },
              region: { name: 'Región Metropolitana' },
              place: { name: 'Las Condes' },
              postcode: { name: '7550000' },
            },
            ...overrides,
          },
        },
      ],
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('search lanza ServiceUnavailableException si no hay token', async () => {
    const p = new MapboxGeocodingProvider(baseConfig(''));
    await expect(p.search('foo')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('search arma URL con q, country, limit, language y proximity', async () => {
    const fetchMock = fetchOk(fakeGeoCollection());
    (global as any).fetch = fetchMock;
    const p = new MapboxGeocodingProvider(baseConfig());
    await p.search('Av. Apoquindo', {
      country: 'cl',
      limit: 7,
      language: 'es',
      proximity: { lat: -33.4, lng: -70.6 },
      types: ['address', 'poi'],
    });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('https://api.mapbox.com/search/geocode/v6/forward?');
    expect(url).toContain('q=Av.+Apoquindo');
    expect(url).toContain('access_token=tok-test');
    expect(url).toContain('limit=7');
    expect(url).toContain('country=cl');
    expect(url).toContain('language=es');
    // proximity es lng,lat
    expect(url).toContain('proximity=-70.6%2C-33.4');
    expect(url).toContain('types=address%2Cpoi');
  });

  it('search mapea features incluyendo confidence label → 0..1', async () => {
    (global as any).fetch = fetchOk(fakeGeoCollection());
    const p = new MapboxGeocodingProvider(baseConfig());
    const features = await p.search('Av. Apoquindo');
    expect(features).toHaveLength(1);
    const f = features[0];
    expect(f.placeId).toBe('addr.123');
    expect(f.coordinates).toEqual({ lat: -33.4172, lng: -70.6044 });
    expect(f.confidence).toBe(1.0); // exact
    expect(f.country).toBe('cl');
    expect(f.region).toBe('Región Metropolitana');
    expect(f.locality).toBe('Las Condes');
    expect(f.postcode).toBe('7550000');
  });

  it.each([
    ['exact', 1.0],
    ['high', 0.85],
    ['medium', 0.65],
    ['low', 0.4],
    ['inaccurate', 0.2],
    ['unknown-label', 0.5],
    [undefined, 0.5],
  ])('mapConfidence "%s" → %s', async (label, expected) => {
    (global as any).fetch = fetchOk(
      fakeGeoCollection({ match_code: label ? { confidence: label } : {} }),
    );
    const p = new MapboxGeocodingProvider(baseConfig());
    const [f] = await p.search('x');
    expect(f.confidence).toBe(expected);
  });

  it('reverse arma URL con longitude/latitude y limit por defecto', async () => {
    const fetchMock = fetchOk(fakeGeoCollection());
    (global as any).fetch = fetchMock;
    const p = new MapboxGeocodingProvider(baseConfig());
    await p.reverse({ lat: -33.4172, lng: -70.6044 });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('https://api.mapbox.com/search/geocode/v6/reverse?');
    expect(url).toContain('longitude=-70.6044');
    expect(url).toContain('latitude=-33.4172');
    expect(url).toContain('limit=1');
  });

  it('reintenta una vez en HTTP 5xx y luego propaga ServiceUnavailableException', async () => {
    const fail500 = {
      ok: false,
      status: 502,
      json: async () => ({}),
      text: async () => 'bad gateway',
    };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(fail500)
      .mockResolvedValueOnce(fail500);
    (global as any).fetch = fetchMock;
    const p = new MapboxGeocodingProvider(baseConfig());
    await expect(p.search('foo')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('en HTTP 4xx NO reintenta y lanza ServiceUnavailableException directamente', async () => {
    const fail401 = {
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'unauthorized',
    };
    const fetchMock = jest.fn().mockResolvedValue(fail401);
    (global as any).fetch = fetchMock;
    const p = new MapboxGeocodingProvider(baseConfig());
    await expect(p.search('foo')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
