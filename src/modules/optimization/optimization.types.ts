/**
 * Tipos compartidos del módulo de optimización.
 * Sprint 7 — Optimización + ETAs.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OptimizationStop {
  shipmentId: string;
  destination: LatLng;
  /** Horario sugerido (puede usarse en futuras estrategias time-windowed). */
  desiredAt?: Date | null;
}

export interface OptimizationInput {
  origin: LatLng;
  stops: OptimizationStop[];
  /** Velocidad promedio asumida en km/h (default 35 ciudad). */
  avgSpeedKmh?: number;
  /** Tiempo de servicio por parada en minutos (descarga, entrega, etc.). */
  serviceTimePerStopMin?: number;
}

export interface OptimizedStop {
  shipmentId: string;
  /** Posición en la nueva secuencia (1-indexed). */
  order: number;
  distanceFromPrevKm: number;
  durationFromPrevMin: number;
}

export interface OptimizationResult {
  provider: 'haversine' | 'google_routes' | 'mapbox' | 'nn_2opt';
  totalDistanceKm: number;
  totalDurationMin: number;
  sequence: OptimizedStop[];
  /** Marca si el resultado proviene de un fallback (cuando el provider remoto falla). */
  fellBackToHaversine?: boolean;
}

export const OPTIMIZER_TOKEN = Symbol('IRouteOptimizer');

export interface IRouteOptimizer {
  readonly providerName: OptimizationResult['provider'];
  optimize(input: OptimizationInput): Promise<OptimizationResult>;
}
