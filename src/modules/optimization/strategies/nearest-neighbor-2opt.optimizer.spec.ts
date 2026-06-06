import { NearestNeighborTwoOptOptimizer } from './nearest-neighbor-2opt.optimizer';
import type { OptimizationInput } from '../optimization.types';

/**
 * Sprint C.6 — Unit tests del NearestNeighborTwoOptOptimizer.
 *
 * Cubre los bugs que tenía la implementación previa:
 *   - shipmentId mapeado por índice original, no por orden de salida.
 *   - distancia en km reales (haversine), no euclídea sobre lat/lng.
 *   - duration calculada con avgSpeedKmh + serviceTimePerStopMin.
 */
describe('NearestNeighborTwoOptOptimizer', () => {
  const optimizer = new NearestNeighborTwoOptOptimizer();

  it('respeta el orden óptimo desde el origen (el más cercano primero)', async () => {
    // Origen en Bandera (Santiago centro).
    // s1 está muy lejos (Apoquindo), s2 está muy cerca (a 2 cuadras),
    // s3 está en Estación Central (medio).
    const input: OptimizationInput = {
      origin: { lat: -33.4378, lng: -70.6504 },
      stops: [
        { shipmentId: 's1', destination: { lat: -33.4172, lng: -70.6044 } }, // lejos
        { shipmentId: 's2', destination: { lat: -33.439, lng: -70.652 } }, // muy cerca
        { shipmentId: 's3', destination: { lat: -33.4569, lng: -70.6794 } }, // medio
      ],
    };

    const result = await optimizer.optimize(input);

    expect(result.sequence).toHaveLength(3);
    // Greedy desde Bandera → s2 (muy cerca) primero.
    expect(result.sequence[0].shipmentId).toBe('s2');
    // El último debería ser s1 (Apoquindo, lejos del eje recorrido).
    expect(result.sequence.map((x) => x.shipmentId)).toEqual([
      's2',
      's3',
      's1',
    ]);
  });

  it('asigna correctamente el shipmentId tras reordenar (regresión bug previo)', async () => {
    // Caso minimalista: 2 stops donde el segundo input es el más cercano.
    // La implementación previa devolvía [s1, s2] (orden de input),
    // la correcta devuelve [s2, s1] (orden optimizado).
    const input: OptimizationInput = {
      origin: { lat: -33.45, lng: -70.65 },
      stops: [
        { shipmentId: 's1-lejos', destination: { lat: -33.42, lng: -70.6 } },
        { shipmentId: 's2-cerca', destination: { lat: -33.451, lng: -70.651 } },
      ],
    };

    const result = await optimizer.optimize(input);

    expect(result.sequence[0].shipmentId).toBe('s2-cerca');
    expect(result.sequence[1].shipmentId).toBe('s1-lejos');
  });

  it('totalDistanceKm está en kilómetros reales (haversine), no en grados', async () => {
    // Dos puntos a ~1.1 km de distancia (0.01 grados de latitud ≈ 1.11 km).
    const input: OptimizationInput = {
      origin: { lat: -33.45, lng: -70.65 },
      stops: [
        { shipmentId: 'a', destination: { lat: -33.46, lng: -70.65 } }, // ~1.11 km al sur
      ],
    };

    const result = await optimizer.optimize(input);

    expect(result.totalDistanceKm).toBeGreaterThan(1.0);
    expect(result.totalDistanceKm).toBeLessThan(1.2);
  });

  it('calcula durationMin usando avgSpeedKmh + serviceTimePerStopMin', async () => {
    // ~1.11 km a 60 km/h = ~1.11 min de viaje + 10 min de servicio = ~11.11 min
    const input: OptimizationInput = {
      origin: { lat: -33.45, lng: -70.65 },
      stops: [{ shipmentId: 'a', destination: { lat: -33.46, lng: -70.65 } }],
      avgSpeedKmh: 60,
      serviceTimePerStopMin: 10,
    };

    const result = await optimizer.optimize(input);
    const stop = result.sequence[0];

    expect(stop.durationFromPrevMin).toBeGreaterThan(11);
    expect(stop.durationFromPrevMin).toBeLessThan(11.5);
  });

  it('2-opt mejora cuando la ruta NN inicial cruza segmentos', async () => {
    // Configuración "cross" clásica: 4 puntos donde NN puro genera cruces.
    // El 2-opt debe deshacer el cruce para reducir distancia total.
    const input: OptimizationInput = {
      origin: { lat: 0, lng: 0 },
      stops: [
        { shipmentId: 'A', destination: { lat: 0, lng: 1 } },
        { shipmentId: 'B', destination: { lat: 1, lng: 1 } },
        { shipmentId: 'C', destination: { lat: 1, lng: 0 } },
        { shipmentId: 'D', destination: { lat: 0.5, lng: 0.5 } },
      ],
    };

    const result = await optimizer.optimize(input);

    // Verifica que el resultado es válido y no se pasa de un trayecto claramente cruzado.
    // Worst case crisscross O→A→C→B→D ≈ 457km en esta config; cualquier ruta razonable < 420km.
    expect(result.totalDistanceKm).toBeLessThan(420);
    expect(result.sequence).toHaveLength(4);
  });

  it('orden incremental (1..N) y sin duplicados', async () => {
    const input: OptimizationInput = {
      origin: { lat: 0, lng: 0 },
      stops: Array.from({ length: 5 }, (_, i) => ({
        shipmentId: `s${i}`,
        destination: { lat: i * 0.01, lng: i * 0.01 },
      })),
    };

    const result = await optimizer.optimize(input);

    expect(result.sequence.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
    const ids = result.sequence.map((s) => s.shipmentId);
    expect(new Set(ids).size).toBe(5); // sin duplicados
  });

  it('caso degenerado: 0 stops', async () => {
    const input: OptimizationInput = {
      origin: { lat: -33.45, lng: -70.65 },
      stops: [],
    };

    const result = await optimizer.optimize(input);

    expect(result.sequence).toHaveLength(0);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.totalDurationMin).toBe(0);
  });

  it('caso degenerado: 1 stop', async () => {
    const input: OptimizationInput = {
      origin: { lat: -33.45, lng: -70.65 },
      stops: [
        { shipmentId: 'only', destination: { lat: -33.46, lng: -70.65 } },
      ],
    };

    const result = await optimizer.optimize(input);

    expect(result.sequence).toHaveLength(1);
    expect(result.sequence[0].shipmentId).toBe('only');
    expect(result.sequence[0].order).toBe(1);
  });

  it('providerName es "nn_2opt"', () => {
    expect(optimizer.providerName).toBe('nn_2opt');
  });
});
