import { MockGeocodingProvider } from './mock.provider';

describe('MockGeocodingProvider', () => {
  let provider: MockGeocodingProvider;

  beforeEach(() => {
    provider = new MockGeocodingProvider();
  });

  it('providerName === "mock"', () => {
    expect(provider.providerName).toBe('mock');
  });

  it('search es determinístico para la misma query', async () => {
    const a = await provider.search('Av. Apoquindo 4501');
    const b = await provider.search('Av. Apoquindo 4501');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('search respeta opts.limit (capado a 5)', async () => {
    const r3 = await provider.search('foo bar', { limit: 3 });
    const r10 = await provider.search('foo bar', { limit: 10 });
    expect(r3).toHaveLength(3);
    expect(r10).toHaveLength(5);
  });

  it('search devuelve coords plausibles (cerca de Santiago, Chile)', async () => {
    const features = await provider.search('Av. Bandera');
    for (const f of features) {
      expect(f.coordinates.lat).toBeGreaterThan(-34);
      expect(f.coordinates.lat).toBeLessThan(-33);
      expect(f.coordinates.lng).toBeGreaterThan(-71);
      expect(f.coordinates.lng).toBeLessThan(-70);
      expect(f.confidence).toBeGreaterThanOrEqual(0.5);
      expect(f.confidence).toBeLessThanOrEqual(0.95);
      expect(f.country).toBe('cl');
    }
  });

  it('reverse refleja las coords del pin', async () => {
    const features = await provider.reverse({ lat: -33.4172, lng: -70.6044 });
    expect(features).toHaveLength(1);
    expect(features[0].coordinates).toEqual({ lat: -33.4172, lng: -70.6044 });
    expect(features[0].placeId).toMatch(/^mock\./);
  });

  it('search respeta el country override', async () => {
    const [first] = await provider.search('Av. X', { country: 'ar', limit: 1 });
    expect(first.country).toBe('ar');
  });
});
