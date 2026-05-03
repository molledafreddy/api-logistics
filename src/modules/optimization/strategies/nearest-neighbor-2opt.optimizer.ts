import { Injectable } from '@nestjs/common';
import {
  IRouteOptimizer,
  OptimizationInput,
  OptimizationResult,
} from '../optimization.types';

/**
 * Optimizer: Nearest Neighbor + 2-opt
 * Sprint B — Optimizer Free
 */

@Injectable()
export class NearestNeighborTwoOptOptimizer implements IRouteOptimizer {
  readonly providerName: OptimizationResult['provider'] = 'nn_2opt';

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    // 1. Nearest Neighbor (NN) para obtener una ruta inicial
    let route = this.nearestNeighbor(input.stops.map((s) => s.destination));
    // 2. 2-opt para mejorar la ruta
    route = this.twoOpt(route);
    // Mapear a OptimizedStop[]
    const sequence = route.map((stop, idx) => ({
      shipmentId: input.stops[idx]?.shipmentId || '',
      order: idx + 1,
      distanceFromPrevKm: idx === 0 ? 0 : this.euclidean(route[idx - 1], stop),
      durationFromPrevMin: 0, // Puedes calcularlo si tienes velocidad promedio
    }));
    return {
      provider: this.providerName,
      totalDistanceKm: this.calculateTotalDistance(route),
      totalDurationMin: 0, // Puedes calcularlo si tienes velocidad promedio
      sequence,
    };
  }

  private nearestNeighbor(
    stops: { lat: number; lng: number }[],
  ): { lat: number; lng: number }[] {
    if (stops.length <= 2) return stops;
    const visited = new Set<number>();
    const route = [stops[0]];
    visited.add(0);
    let current = 0;
    while (route.length < stops.length) {
      let nearest = -1;
      let minDist = Infinity;
      for (let i = 1; i < stops.length; i++) {
        if (!visited.has(i)) {
          const dist = this.euclidean(stops[current], stops[i]);
          if (dist < minDist) {
            minDist = dist;
            nearest = i;
          }
        }
      }
      if (nearest === -1) break;
      route.push(stops[nearest]);
      visited.add(nearest);
      current = nearest;
    }
    return route;
  }

  private twoOpt(
    route: { lat: number; lng: number }[],
  ): { lat: number; lng: number }[] {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 1; i < route.length - 2; i++) {
        for (let k = i + 1; k < route.length - 1; k++) {
          const newRoute = this.twoOptSwap(route, i, k);
          if (
            this.calculateTotalDistance(newRoute) <
            this.calculateTotalDistance(route)
          ) {
            route = newRoute;
            improved = true;
          }
        }
      }
    }
    return route;
  }

  private twoOptSwap(
    route: { lat: number; lng: number }[],
    i: number,
    k: number,
  ) {
    return [
      ...route.slice(0, i),
      ...route.slice(i, k + 1).reverse(),
      ...route.slice(k + 1),
    ];
  }

  private euclidean(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ) {
    return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
  }

  private calculateTotalDistance(route: { lat: number; lng: number }[]) {
    let dist = 0;
    for (let i = 0; i < route.length - 1; i++) {
      dist += this.euclidean(route[i], route[i + 1]);
    }
    return dist;
  }
}
