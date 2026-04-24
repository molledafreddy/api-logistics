import { HaversineOptimizer } from './haversine.optimizer';
import { OptimizationInput } from '../optimization.types';

describe('HaversineOptimizer', () => {
  let opt: HaversineOptimizer;

  beforeEach(() => {
    opt = new HaversineOptimizer();
  });

  describe('distanceKm()', () => {
    it('mismo punto → 0', () => {
      const d = HaversineOptimizer.distanceKm(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7128, lng: -74.006 },
      );
      expect(d).toBe(0);
    });

    it('NYC ↔ Boston ≈ 305 km (±5 %)', () => {
      const d = HaversineOptimizer.distanceKm(
        { lat: 40.7128, lng: -74.006 }, // NYC
        { lat: 42.3601, lng: -71.0589 }, // Boston
      );
      expect(d).toBeGreaterThan(290);
      expect(d).toBeLessThan(320);
    });

    it('1 grado latitud ≈ 111 km en el ecuador', () => {
      const d = HaversineOptimizer.distanceKm(
        { lat: 0, lng: 0 },
        { lat: 1, lng: 0 },
      );
      expect(d).toBeGreaterThan(110);
      expect(d).toBeLessThan(112);
    });
  });

  describe('optimize()', () => {
    it('rechaza? no, devuelve resultado vacío con stops=[]', async () => {
      const result = await opt.optimize({
        origin: { lat: 0, lng: 0 },
        stops: [],
      });
      expect(result.sequence).toEqual([]);
      expect(result.totalDistanceKm).toBe(0);
      expect(result.totalDurationMin).toBe(0);
      expect(result.provider).toBe('haversine');
    });

    it('un solo stop → secuencia de 1, distancia=segmento', async () => {
      const input: OptimizationInput = {
        origin: { lat: 0, lng: 0 },
        stops: [{ shipmentId: 's1', destination: { lat: 0, lng: 1 } }],
        avgSpeedKmh: 60,
        serviceTimePerStopMin: 0,
      };
      const r = await opt.optimize(input);
      expect(r.sequence).toHaveLength(1);
      expect(r.sequence[0].shipmentId).toBe('s1');
      expect(r.sequence[0].order).toBe(1);
      expect(r.totalDistanceKm).toBeGreaterThan(110);
      // Duración: ~111km/60kmh * 60min = ~111min
      expect(r.totalDurationMin).toBeGreaterThan(100);
    });

    it('nearest neighbor: 3 stops en línea, salta al más cercano primero', async () => {
      // Origen en (0,0). Stops: A(0,3), B(0,1), C(0,5).
      // Esperado: B (1°) → A (2°) → C (3°)
      const input: OptimizationInput = {
        origin: { lat: 0, lng: 0 },
        stops: [
          { shipmentId: 'A', destination: { lat: 0, lng: 3 } },
          { shipmentId: 'B', destination: { lat: 0, lng: 1 } },
          { shipmentId: 'C', destination: { lat: 0, lng: 5 } },
        ],
        avgSpeedKmh: 60,
        serviceTimePerStopMin: 0,
      };
      const r = await opt.optimize(input);
      expect(r.sequence.map((s) => s.shipmentId)).toEqual(['B', 'A', 'C']);
      expect(r.sequence[0].order).toBe(1);
      expect(r.sequence[2].order).toBe(3);
    });

    it('aplica serviceTimePerStopMin a cada parada', async () => {
      const input: OptimizationInput = {
        origin: { lat: 0, lng: 0 },
        stops: [
          { shipmentId: 'A', destination: { lat: 0, lng: 0 } }, // dist 0
          { shipmentId: 'B', destination: { lat: 0, lng: 0 } }, // dist 0
        ],
        avgSpeedKmh: 60,
        serviceTimePerStopMin: 10,
      };
      const r = await opt.optimize(input);
      // 2 stops × 10min servicio = 20min, distancia=0
      expect(r.totalDistanceKm).toBe(0);
      expect(r.totalDurationMin).toBe(20);
    });

    it('provider = "haversine"', async () => {
      const r = await opt.optimize({
        origin: { lat: 0, lng: 0 },
        stops: [{ shipmentId: 's', destination: { lat: 0, lng: 1 } }],
      });
      expect(r.provider).toBe('haversine');
    });
  });
});
