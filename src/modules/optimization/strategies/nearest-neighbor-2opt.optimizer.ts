import { Injectable } from '@nestjs/common';
import {
  IRouteOptimizer,
  LatLng,
  OptimizationInput,
  OptimizationResult,
  OptimizedStop,
} from '../optimization.types';
import { HaversineOptimizer } from './haversine.optimizer';

/**
 * Optimizer: Nearest Neighbor + 2-opt (Sprint B — Optimizer Free)
 *
 * Algoritmo:
 *   1. NN para construir ruta inicial desde el origen (depot).
 *   2. 2-opt para mejorar localmente la ruta (intercambio de segmentos).
 *   3. Cálculo de distancias/duraciones con Haversine (great-circle).
 *
 * Diferencias vs implementación anterior:
 *   - Antes usaba distancia euclídea sobre (lat,lng), lo cual NO produce
 *     kilómetros (las coords geográficas no son cartesianas) y subestima
 *     distancias a latitudes altas. Ahora usa Haversine real → totalDistanceKm
 *     es métricamente correcto.
 *   - Antes mapeaba `shipmentId: input.stops[idx]` después de reordenar,
 *     lo que asignaba los IDs en orden ORIGINAL en lugar del orden optimizado
 *     (bug grave de correctness). Ahora trackeamos `originalIdx` por stop
 *     y mapeamos correctamente.
 *   - Calcula durationMin usando `avgSpeedKmh` + `serviceTimePerStopMin`
 *     en lugar de devolver 0 (que rompía los ETAs downstream).
 */
@Injectable()
export class NearestNeighborTwoOptOptimizer implements IRouteOptimizer {
  readonly providerName: OptimizationResult['provider'] = 'nn_2opt';

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const avgSpeedKmh = input.avgSpeedKmh ?? 35;
    const serviceMin = input.serviceTimePerStopMin ?? 5;

    if (input.stops.length === 0) {
      return {
        provider: this.providerName,
        totalDistanceKm: 0,
        totalDurationMin: 0,
        sequence: [],
      };
    }

    // Trabajamos sobre IndexedPoint para preservar el shipmentId original
    // tras los reordenamientos del NN y del 2-opt.
    type IndexedPoint = { point: LatLng; originalIdx: number };
    const indexed: IndexedPoint[] = input.stops.map((s, i) => ({
      point: s.destination,
      originalIdx: i,
    }));

    // 1) Nearest Neighbor desde el ORIGEN (no desde stop[0]).
    let route = this.nearestNeighbor(input.origin, indexed);

    // 2) 2-opt mejorando la métrica REAL (haversine) desde el origen.
    route = this.twoOpt(input.origin, route);

    // 3) Construir sequence respetando el orden optimizado y los IDs originales.
    const sequence: OptimizedStop[] = [];
    let totalKm = 0;
    let totalMin = 0;
    let cursor: LatLng = input.origin;

    for (let i = 0; i < route.length; i++) {
      const { point, originalIdx } = route[i];
      const dKm = HaversineOptimizer.distanceKm(cursor, point);
      const durMin = (dKm / avgSpeedKmh) * 60 + serviceMin;

      sequence.push({
        shipmentId: input.stops[originalIdx].shipmentId,
        order: i + 1,
        distanceFromPrevKm: round2(dKm),
        durationFromPrevMin: round2(durMin),
      });

      totalKm += dKm;
      totalMin += durMin;
      cursor = point;
    }

    return {
      provider: this.providerName,
      totalDistanceKm: round2(totalKm),
      totalDurationMin: round2(totalMin),
      sequence,
    };
  }

  // ─── Algoritmos internos ────────────────────────────────────────────────

  /**
   * Nearest Neighbor desde el origen. En cada paso, escoge el punto no visitado
   * más cercano (haversine) al punto actual.
   */
  private nearestNeighbor<T extends { point: LatLng }>(
    origin: LatLng,
    points: T[],
  ): T[] {
    if (points.length <= 1) return [...points];

    const remaining = [...points];
    const route: T[] = [];
    let cursor: LatLng = origin;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = HaversineOptimizer.distanceKm(cursor, remaining[i].point);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      route.push(next);
      cursor = next.point;
    }
    return route;
  }

  /**
   * 2-opt: mejora local que invierte segmentos de la ruta si reduce la
   * distancia total medida desde el origen. Itera hasta no encontrar mejora.
   */
  private twoOpt<T extends { point: LatLng }>(
    origin: LatLng,
    initial: T[],
  ): T[] {
    if (initial.length < 4) return initial; // 2-opt no aporta con <4 stops
    let route = [...initial];
    let bestDistance = this.totalDistanceFromOrigin(origin, route);
    let improved = true;

    while (improved) {
      improved = false;
      // Recorre todas las parejas (i,k) y prueba revertir el segmento [i..k].
      for (let i = 0; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const candidate = this.twoOptSwap(route, i, k);
          const candidateDistance = this.totalDistanceFromOrigin(
            origin,
            candidate,
          );
          if (candidateDistance + 1e-9 < bestDistance) {
            route = candidate;
            bestDistance = candidateDistance;
            improved = true;
          }
        }
      }
    }
    return route;
  }

  private twoOptSwap<T>(route: T[], i: number, k: number): T[] {
    return [
      ...route.slice(0, i),
      ...route.slice(i, k + 1).reverse(),
      ...route.slice(k + 1),
    ];
  }

  /** Distancia total desde el origen pasando por la ruta en orden, usando haversine. */
  private totalDistanceFromOrigin<T extends { point: LatLng }>(
    origin: LatLng,
    route: T[],
  ): number {
    let total = 0;
    let cursor: LatLng = origin;
    for (const { point } of route) {
      total += HaversineOptimizer.distanceKm(cursor, point);
      cursor = point;
    }
    return total;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
