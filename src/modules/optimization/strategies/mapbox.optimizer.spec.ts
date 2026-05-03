import { ConfigService } from '@nestjs/config';
import { MapboxOptimizationProvider } from './mapbox.optimizer';
import { HaversineOptimizer } from './haversine.optimizer';
import type { OptimizationInput } from '../optimization.types';

/**
 * Sprint C.6 — Unit tests del MapboxOptimizationProvider.
 *
 * Mocks `global.fetch` y reusa Haversine real para verificar el fallback.
 */
describe('MapboxOptimizationProvider', () => {
  const haversine = new HaversineOptimizer();

  function makeConfig(overrides: Record<string, unknown> = {}) {
    return {
      get: jest.fn((key: string, def: unknown) => {
        if (key in overrides) return (overrides as any)[key];
        if (key === 'MAPBOX_TOKEN') return 'tok-test';
        if (key === 'MAPBOX_OPTIMIZATION_PROFILE')
          return 'mapbox/driving-traffic';
        if (key === 'MAPBOX_OPTIMIZATION_TIMEOUT_MS') return 1000;
        return def;
      }),
    } as unknown as ConfigService;
  }

  function input3stops(): OptimizationInput {
    return {
      origin: { lat: -33.4378, lng: -70.6504 }, // Bandera
      stops: [
        // s1 → Apoquindo
        {
          shipmentId: 's1',
          destination: { lat: -33.4172, lng: -70.6044 },
        },
        // s2 → Providencia
        {
          shipmentId: 's2',
          destination: { lat: -33.4264, lng: -70.6112 },
        },
        // s3 → Estación Central
        {
          shipmentId: 's3',
          destination: { lat: -33.4569, lng: -70.6794 },
        },
      ],
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('OPT-MB-001: sin MAPBOX_TOKEN → fallback a Haversine', async () => {
    const provider = new MapboxOptimizationProvider(
      makeConfig({ MAPBOX_TOKEN: '' }),
      haversine,
    );
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const out = await provider.optimize(input3stops());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.provider).toBe('mapbox');
    expect(out.fellBackToHaversine).toBe(true);
    expect(out.sequence).toHaveLength(3);
  });

  it('OPT-MB-003: > 12 coords (origen + 12 stops) → fallback', async () => {
    const provider = new MapboxOptimizationProvider(makeConfig(), haversine);
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const big = input3stops();
    big.stops = Array.from({ length: 12 }).map((_, i) => ({
      shipmentId: `s${i}`,
      destination: { lat: -33.4 + i * 0.001, lng: -70.6 + i * 0.001 },
    }));

    const out = await provider.optimize(big);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.fellBackToHaversine).toBe(true);
    expect(out.provider).toBe('mapbox');
  });

  it('OPT-MB-002: HTTP no-OK → fallback a Haversine', async () => {
    const provider = new MapboxOptimizationProvider(makeConfig(), haversine);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
    expect(out.provider).toBe('mapbox');
  });

  it('OPT-MB-002: timeout (AbortError) → fallback a Haversine', async () => {
    const provider = new MapboxOptimizationProvider(makeConfig(), haversine);
    (global as any).fetch = jest.fn().mockImplementation(() => {
      const e = new Error('aborted');
      (e as any).name = 'AbortError';
      return Promise.reject(e);
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
  });

  it('OPT-MB-002: code !== "Ok" → fallback', async () => {
    const provider = new MapboxOptimizationProvider(makeConfig(), haversine);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 'NoRoute', trips: [], waypoints: [] }),
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
  });

  it('happy path: parsea sequence reordenada por waypoint_index y suma distancias', async () => {
    const provider = new MapboxOptimizationProvider(makeConfig(), haversine);

    // Mapbox response: reordena (origen, s2, s1, s3) → s2 primero, luego s1, luego s3.
    // waypoints[i] corresponde al input i (origen, s1, s2, s3).
    // waypoint_index = posición dentro del trip optimizado.
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        trips: [
          {
            distance: 18000, // 18 km
            duration: 1800, // 30 min
            legs: [
              { distance: 5000, duration: 600 }, // origen → trip pos 1 (s2)
              { distance: 6000, duration: 600 }, // s2 → s1
              { distance: 7000, duration: 600 }, // s1 → s3
            ],
          },
        ],
        waypoints: [
          { waypoint_index: 0, trips_index: 0, location: [-70.6504, -33.4378] }, // origen
          { waypoint_index: 2, trips_index: 0, location: [-70.6044, -33.4172] }, // s1 → 3ra parada
          { waypoint_index: 1, trips_index: 0, location: [-70.6112, -33.4264] }, // s2 → 2da parada
          { waypoint_index: 3, trips_index: 0, location: [-70.6794, -33.4569] }, // s3 → 4ta parada
        ],
      }),
    });

    const out = await provider.optimize(input3stops());

    expect(out.fellBackToHaversine).toBeUndefined();
    expect(out.provider).toBe('mapbox');
    expect(out.totalDistanceKm).toBe(18);
    expect(out.totalDurationMin).toBe(30);

    // Trip optimizado: origen → s2 → s1 → s3
    expect(out.sequence.map((s) => s.shipmentId)).toEqual(['s2', 's1', 's3']);
    expect(out.sequence.map((s) => s.order)).toEqual([1, 2, 3]);

    // Por leg: 5/6/7 km, 10/10/10 min
    expect(out.sequence[0].distanceFromPrevKm).toBe(5);
    expect(out.sequence[0].durationFromPrevMin).toBe(10);
    expect(out.sequence[1].distanceFromPrevKm).toBe(6);
    expect(out.sequence[2].distanceFromPrevKm).toBe(7);
  });

  it('arma URL con profile, source/destination/roundtrip y access_token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        trips: [{ distance: 1000, duration: 60, legs: [] }],
        waypoints: [
          { waypoint_index: 0, trips_index: 0, location: [-70.6504, -33.4378] },
          { waypoint_index: 1, trips_index: 0, location: [-70.6044, -33.4172] },
        ],
      }),
    });
    (global as any).fetch = fetchMock;
    const provider = new MapboxOptimizationProvider(makeConfig(), haversine);
    await provider.optimize({
      origin: { lat: -33.4378, lng: -70.6504 },
      stops: [
        { shipmentId: 's1', destination: { lat: -33.4172, lng: -70.6044 } },
      ],
    });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain(
      'https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/',
    );
    expect(url).toContain('-70.6504,-33.4378;-70.6044,-33.4172');
    expect(url).toContain('source=first');
    expect(url).toContain('destination=last');
    expect(url).toContain('roundtrip=false');
    expect(url).toContain('annotations=distance%2Cduration');
    expect(url).toContain('access_token=tok-test');
  });
});
