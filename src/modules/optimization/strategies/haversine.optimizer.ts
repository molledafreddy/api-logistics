import { Injectable } from '@nestjs/common';
import {
  IRouteOptimizer,
  LatLng,
  OptimizationInput,
  OptimizationResult,
  OptimizedStop,
} from '../optimization.types';

/**
 * HaversineOptimizer — estrategia local sin dependencias externas.
 *
 * Aplica:
 *   1. Distancia haversine (greatcircle) entre coordenadas.
 *   2. Heurística "nearest neighbor" desde el origen.
 *   3. ETA = distancia / velocidad + tiempo de servicio por parada.
 *
 * NO hace 2-opt ni considera tráfico/horarios. Es un baseline barato y
 * suficiente para rutas cortas (<20 stops). Para rutas largas o con
 * ventanas horarias, el plan recomienda activar GoogleRoutesOptimizer.
 */
@Injectable()
export class HaversineOptimizer implements IRouteOptimizer {
  readonly providerName = 'haversine' as const;

  /** Radio terrestre en km. */
  private static readonly EARTH_R_KM = 6371;

  static distanceKm(a: LatLng, b: LatLng): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return HaversineOptimizer.EARTH_R_KM * c;
  }

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const avgSpeedKmh = input.avgSpeedKmh ?? 35;
    const serviceMin = input.serviceTimePerStopMin ?? 5;

    const remaining = [...input.stops];
    const ordered: OptimizedStop[] = [];
    let cursor: LatLng = input.origin;
    let totalKm = 0;
    let totalMin = 0;

    let order = 1;
    while (remaining.length > 0) {
      // Buscar el stop más cercano al cursor
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = HaversineOptimizer.distanceKm(
          cursor,
          remaining[i].destination,
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      const durationMin = (bestDist / avgSpeedKmh) * 60 + serviceMin;
      ordered.push({
        shipmentId: next.shipmentId,
        order,
        distanceFromPrevKm: round2(bestDist),
        durationFromPrevMin: round2(durationMin),
      });
      totalKm += bestDist;
      totalMin += durationMin;
      cursor = next.destination;
      order++;
    }

    return {
      provider: this.providerName,
      totalDistanceKm: round2(totalKm),
      totalDurationMin: round2(totalMin),
      sequence: ordered,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
