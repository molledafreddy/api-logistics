import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IRouteOptimizer,
  OptimizationInput,
  OptimizationResult,
  OptimizedStop,
} from '../optimization.types';
import { HaversineOptimizer } from './haversine.optimizer';

/**
 * MapboxOptimizationProvider — Sprint C.4
 *
 * Llama a Mapbox Optimization API v1 (`/optimized-trips/v1`) para resolver
 * un TSP con tráfico real. Devuelve la secuencia ordenada + distancias y
 * duraciones por tramo.
 *
 * Reglas de negocio:
 *   OPT-MB-001 Requiere `MAPBOX_TOKEN`. Si falta, fallback a Haversine.
 *   OPT-MB-002 Si la API devuelve error/timeout/non-OK, fallback a Haversine
 *              y `fellBackToHaversine=true` (auditable en eventos).
 *   OPT-MB-003 Mapbox Optimization v1 acepta máx. 12 coordenadas por request
 *              (origen + 11 stops). Si excede, fallback a Haversine.
 *   OPT-MB-004 `source=first` fija el origen (warehouse/truck), `roundtrip=false`
 *              y `destination=last` permite que la API elija el último stop.
 *
 * Endpoint:
 *   GET https://api.mapbox.com/optimized-trips/v1/{profile}/{coords}
 *       ?access_token=...&source=first&destination=last&roundtrip=false
 *       &annotations=distance,duration&geometries=geojson&overview=false
 *
 * Coords: `lng,lat;lng,lat;...` (primero el origen).
 *
 * Response (resumido):
 *   { code: "Ok",
 *     trips: [{ distance: meters, duration: seconds, ... }],
 *     waypoints: [{ waypoint_index, trips_index, location: [lng,lat], ... }] }
 *
 * `waypoints[i].waypoint_index` es la posición de la coord. de input `i`
 * dentro del trip optimizado. waypoint_index=0 corresponde al origen.
 */
@Injectable()
export class MapboxOptimizationProvider implements IRouteOptimizer {
  private readonly logger = new Logger(MapboxOptimizationProvider.name);
  readonly providerName = 'mapbox' as const;

  /** Mapbox Optimization v1 admite hasta 12 coords por request. */
  private static readonly MAX_COORDS = 12;

  constructor(
    private readonly config: ConfigService,
    private readonly haversine: HaversineOptimizer,
  ) {}

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const token = this.config.get<string>('MAPBOX_TOKEN', '');
    if (!token) {
      this.logger.warn('OPT-MB-001: MAPBOX_TOKEN vacío — fallback a Haversine');
      return this.fallback(input);
    }

    const totalCoords = input.stops.length + 1; // origin + stops
    if (totalCoords > MapboxOptimizationProvider.MAX_COORDS) {
      this.logger.warn(
        `OPT-MB-003: ${totalCoords} coords exceden el máximo de ` +
          `${MapboxOptimizationProvider.MAX_COORDS} de Mapbox Optimization v1 — fallback a Haversine`,
      );
      return this.fallback(input);
    }

    const profile = this.config.get<string>(
      'MAPBOX_OPTIMIZATION_PROFILE',
      'mapbox/driving-traffic',
    );
    const timeoutMs = Number(
      this.config.get<number>('MAPBOX_OPTIMIZATION_TIMEOUT_MS', 15000),
    );

    // Build coords: origin first, then stops, in input order
    const coords = [
      `${input.origin.lng},${input.origin.lat}`,
      ...input.stops.map((s) => `${s.destination.lng},${s.destination.lat}`),
    ].join(';');

    const url = new URL(
      `https://api.mapbox.com/optimized-trips/v1/${profile}/${coords}`,
    );
    url.searchParams.set('access_token', token);
    url.searchParams.set('source', 'first');
    url.searchParams.set('destination', 'last');
    url.searchParams.set('roundtrip', 'false');
    url.searchParams.set('annotations', 'distance,duration');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'false');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `OPT-MB-002: Mapbox HTTP ${res.status} — ${body.slice(0, 200)} — fallback a Haversine`,
        );
        return this.fallback(input);
      }

      const data = (await res.json()) as MapboxOptimizationResponse;

      if (
        data.code !== 'Ok' ||
        !data.trips?.length ||
        !data.waypoints?.length
      ) {
        this.logger.error(
          `OPT-MB-002: Mapbox response inválido (code=${data.code}) — fallback a Haversine`,
        );
        return this.fallback(input);
      }

      return this.parseResponse(data, input);
    } catch (err) {
      const msg =
        (err as Error)?.name === 'AbortError'
          ? `timeout ${timeoutMs}ms`
          : (err as Error).message;
      this.logger.error(
        `OPT-MB-002: Mapbox call falló (${msg}) — fallback a Haversine`,
      );
      return this.fallback(input);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Convierte la respuesta de Mapbox en `OptimizationResult`.
   *
   * `waypoints[i].waypoint_index` indica la posición del input-coord `i`
   * dentro del trip optimizado. Reordenamos los stops por waypoint_index
   * (saltando el origen, que siempre es 0 con `source=first`).
   *
   * Las distancias por tramo (`distanceFromPrevKm`/`durationFromPrevMin`)
   * se obtienen de `trips[0].legs[i]` (entre waypoints consecutivos del
   * trip optimizado), no de `annotations` (que es por step interno).
   */
  private parseResponse(
    data: MapboxOptimizationResponse,
    input: OptimizationInput,
  ): OptimizationResult {
    const trip = data.trips[0];

    // Map waypoint_index → input index
    // input[0] = origin, input[1..N] = stops[0..N-1]
    const tripPositionToInputIdx = new Map<number, number>();
    data.waypoints.forEach((wp, inputIdx) => {
      tripPositionToInputIdx.set(wp.waypoint_index, inputIdx);
    });

    const sequence: OptimizedStop[] = [];
    const legs = trip.legs ?? [];

    // Trip positions go 0..N. Position 0 is origin (source=first).
    // We emit OptimizedStop for positions 1..N, in trip order.
    let order = 1;
    for (let pos = 1; pos < data.waypoints.length; pos++) {
      const inputIdx = tripPositionToInputIdx.get(pos);
      if (inputIdx === undefined || inputIdx === 0) continue; // origin guard
      const stop = input.stops[inputIdx - 1]; // -1 because input.stops excludes origin
      if (!stop) continue;

      // legs[pos-1] = from trip-position (pos-1) to (pos)
      const leg = legs[pos - 1];
      const distanceKm = leg ? leg.distance / 1000 : 0;
      const durationMin = leg ? leg.duration / 60 : 0;

      sequence.push({
        shipmentId: stop.shipmentId,
        order: order++,
        distanceFromPrevKm: round2(distanceKm),
        durationFromPrevMin: round2(durationMin),
      });
    }

    return {
      provider: this.providerName,
      totalDistanceKm: round2(trip.distance / 1000),
      totalDurationMin: round2(trip.duration / 60),
      sequence,
    };
  }

  private async fallback(
    input: OptimizationInput,
  ): Promise<OptimizationResult> {
    const fallback = await this.haversine.optimize(input);
    return {
      ...fallback,
      provider: this.providerName,
      fellBackToHaversine: true,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Mapbox API types (subset) ─────────────────────────────
interface MapboxOptimizationResponse {
  code: string;
  trips: MapboxTrip[];
  waypoints: MapboxWaypoint[];
}

interface MapboxTrip {
  distance: number; // meters
  duration: number; // seconds
  legs?: MapboxLeg[];
}

interface MapboxLeg {
  distance: number; // meters
  duration: number; // seconds
}

interface MapboxWaypoint {
  waypoint_index: number;
  trips_index: number;
  location: [number, number]; // [lng, lat]
  name?: string;
}
