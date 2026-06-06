import { ConfigService } from '@nestjs/config';
import { GoogleRoutesOptimizer } from './google-routes.optimizer';
import { HaversineOptimizer } from './haversine.optimizer';
import type { OptimizationInput } from '../optimization.types';

/**
 * Sprint C.6 — Unit tests del GoogleRoutesOptimizer.
 *
 * Mocks `global.fetch` y reusa Haversine real para verificar el fallback.
 * Patrón espejo de mapbox.optimizer.spec.ts para consistencia.
 */
describe('GoogleRoutesOptimizer', () => {
  const haversine = new HaversineOptimizer();

  function makeConfig(overrides: Record<string, unknown> = {}) {
    return {
      get: jest.fn((key: string, def: unknown) => {
        if (key in overrides) return (overrides as any)[key];
        if (key === 'GOOGLE_ROUTES_API_KEY') return 'key-test';
        if (key === 'GOOGLE_ROUTES_TIMEOUT_MS') return 1000;
        if (key === 'GOOGLE_ROUTES_TRAVEL_MODE') return 'DRIVE';
        if (key === 'GOOGLE_ROUTES_PREFERENCE') return 'TRAFFIC_AWARE';
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
        // s3 → Estación Central (destination fija - último)
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

  it('OPT-GR-001: sin GOOGLE_ROUTES_API_KEY → fallback a Haversine', async () => {
    const provider = new GoogleRoutesOptimizer(
      makeConfig({ GOOGLE_ROUTES_API_KEY: '' }),
      haversine,
    );
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const out = await provider.optimize(input3stops());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.provider).toBe('google_routes');
    expect(out.fellBackToHaversine).toBe(true);
    expect(out.sequence).toHaveLength(3);
  });

  it('OPT-GR-003: > 25 intermediates → fallback', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const big = input3stops();
    // 27 stops → 26 intermediates (> MAX 25) → debe hacer fallback.
    big.stops = Array.from({ length: 27 }).map((_, i) => ({
      shipmentId: `s${i}`,
      destination: { lat: -33.4 + i * 0.001, lng: -70.6 + i * 0.001 },
    }));

    const out = await provider.optimize(big);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.fellBackToHaversine).toBe(true);
    expect(out.provider).toBe('google_routes');
  });

  it('OPT-GR-002: HTTP no-OK → fallback a Haversine', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
    expect(out.provider).toBe('google_routes');
  });

  it('OPT-GR-002: timeout (AbortError) → fallback a Haversine', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);
    (global as any).fetch = jest.fn().mockImplementation(() => {
      const e = new Error('aborted');
      (e as any).name = 'AbortError';
      return Promise.reject(e);
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
  });

  it('OPT-GR-002: response sin routes → fallback', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ routes: [] }),
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
  });

  it('OPT-GR-002: optimizedIntermediateWaypointIndex length inválido → fallback', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);
    // input3stops tiene 3 stops → 2 intermediates → optimizedIdx debería ser length 2.
    // Devolvemos length 3 para provocar la validación defensiva.
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [
          {
            distanceMeters: 18000,
            duration: '1800s',
            legs: [
              { distanceMeters: 5000, duration: '600s' },
              { distanceMeters: 6000, duration: '600s' },
              { distanceMeters: 7000, duration: '600s' },
            ],
            optimizedIntermediateWaypointIndex: [0, 1, 2], // length 3, pero solo hay 2 intermediates
          },
        ],
      }),
    });
    const out = await provider.optimize(input3stops());
    expect(out.fellBackToHaversine).toBe(true);
  });

  it('happy path: parsea sequence reordenada por optimizedIntermediateWaypointIndex', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);

    // input3stops: stops = [s1, s2, s3]
    // → destination = s3 (último, FIJO)
    // → intermediates = [s1, s2] (orden de envío)
    // Google decide: visitar primero intermediates[1]=s2, luego intermediates[0]=s1
    // → optimizedIntermediateWaypointIndex = [1, 0]
    // → ruta final: origen → s2 → s1 → s3
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [
          {
            distanceMeters: 18000, // 18 km
            duration: '1800s', // 30 min
            legs: [
              { distanceMeters: 5000, duration: '600s' }, // origen → s2
              { distanceMeters: 6000, duration: '600s' }, // s2 → s1
              { distanceMeters: 7000, duration: '600s' }, // s1 → s3
            ],
            optimizedIntermediateWaypointIndex: [1, 0],
          },
        ],
      }),
    });

    const out = await provider.optimize(input3stops());

    expect(out.fellBackToHaversine).toBeUndefined();
    expect(out.provider).toBe('google_routes');
    expect(out.totalDistanceKm).toBe(18);
    expect(out.totalDurationMin).toBe(30);

    expect(out.sequence.map((s) => s.shipmentId)).toEqual(['s2', 's1', 's3']);
    expect(out.sequence.map((s) => s.order)).toEqual([1, 2, 3]);

    // Por leg: 5/6/7 km, 10/10/10 min
    expect(out.sequence[0].distanceFromPrevKm).toBe(5);
    expect(out.sequence[0].durationFromPrevMin).toBe(10);
    expect(out.sequence[1].distanceFromPrevKm).toBe(6);
    expect(out.sequence[2].distanceFromPrevKm).toBe(7);
  });

  it('arma POST con FieldMask correcto, API key header y body bien formado', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [
          {
            distanceMeters: 1000,
            duration: '60s',
            legs: [
              { distanceMeters: 500, duration: '30s' },
              { distanceMeters: 500, duration: '30s' },
            ],
            optimizedIntermediateWaypointIndex: [0],
          },
        ],
      }),
    });
    (global as any).fetch = fetchMock;
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);

    await provider.optimize({
      origin: { lat: -33.4378, lng: -70.6504 },
      stops: [
        { shipmentId: 's1', destination: { lat: -33.4172, lng: -70.6044 } },
        { shipmentId: 's2', destination: { lat: -33.4264, lng: -70.6112 } },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
    );
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-Goog-Api-Key']).toBe('key-test');
    expect(init.headers['X-Goog-FieldMask']).toContain('routes.distanceMeters');
    expect(init.headers['X-Goog-FieldMask']).toContain('routes.duration');
    expect(init.headers['X-Goog-FieldMask']).toContain(
      'routes.optimizedIntermediateWaypointIndex',
    );

    const body = JSON.parse(init.body);
    expect(body.optimizeWaypointOrder).toBe(true);
    expect(body.travelMode).toBe('DRIVE');
    expect(body.routingPreference).toBe('TRAFFIC_AWARE');
    expect(body.units).toBe('METRIC');
    expect(body.origin.location.latLng.latitude).toBe(-33.4378);
    expect(body.origin.location.latLng.longitude).toBe(-70.6504);
    // s2 es el último → destination
    expect(body.destination.location.latLng.latitude).toBe(-33.4264);
    expect(body.destination.location.latLng.longitude).toBe(-70.6112);
    // s1 es el único intermediate (todos menos el último)
    expect(body.intermediates).toHaveLength(1);
    expect(body.intermediates[0].location.latLng.latitude).toBe(-33.4172);
  });

  it('caso degenerado: 0 stops → resultado vacío sin llamar a Google', async () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);

    const out = await provider.optimize({
      origin: { lat: -33.45, lng: -70.65 },
      stops: [],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.provider).toBe('google_routes');
    expect(out.sequence).toHaveLength(0);
    expect(out.totalDistanceKm).toBe(0);
    expect(out.totalDurationMin).toBe(0);
    expect(out.fellBackToHaversine).toBeUndefined();
  });

  it('caso degenerado: 1 stop → cálculo directo sin llamar a Google', async () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);

    const out = await provider.optimize({
      origin: { lat: -33.45, lng: -70.65 },
      stops: [
        { shipmentId: 'only', destination: { lat: -33.46, lng: -70.65 } },
      ],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.provider).toBe('google_routes');
    expect(out.sequence).toHaveLength(1);
    expect(out.sequence[0].shipmentId).toBe('only');
    expect(out.sequence[0].order).toBe(1);
    expect(out.totalDistanceKm).toBeGreaterThan(1.0);
    expect(out.totalDistanceKm).toBeLessThan(1.2);
    expect(out.fellBackToHaversine).toBeUndefined();
  });

  it('providerName es "google_routes" (no hace fallback en el name)', async () => {
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);
    expect(provider.providerName).toBe('google_routes');
  });

  it('si Google omite optimizedIntermediateWaypointIndex con 1 intermediate, mantiene orden de envío', async () => {
    // Con 1 intermediate Google a veces omite el field (no hay nada que reordenar).
    // Verifica el fallback interno: usa el orden de envío.
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [
          {
            distanceMeters: 2000,
            duration: '120s',
            legs: [
              { distanceMeters: 1000, duration: '60s' },
              { distanceMeters: 1000, duration: '60s' },
            ],
            // optimizedIntermediateWaypointIndex: undefined (omitido)
          },
        ],
      }),
    });
    const provider = new GoogleRoutesOptimizer(makeConfig(), haversine);

    const out = await provider.optimize({
      origin: { lat: -33.45, lng: -70.65 },
      stops: [
        { shipmentId: 'mid', destination: { lat: -33.46, lng: -70.66 } },
        { shipmentId: 'end', destination: { lat: -33.47, lng: -70.67 } },
      ],
    });

    expect(out.fellBackToHaversine).toBeUndefined();
    expect(out.sequence.map((s) => s.shipmentId)).toEqual(['mid', 'end']);
  });
});
