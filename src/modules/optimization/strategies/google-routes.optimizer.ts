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
 * GoogleRoutesOptimizer — Sprint C.6 (implementación real).
 *
 * Llama a Google Routes API v2 (`computeRoutes`) con `optimizeWaypointOrder=true`
 * para resolver un TSP con tráfico en tiempo real.
 *
 * Reglas de negocio:
 *   OPT-GR-001 Requiere `GOOGLE_ROUTES_API_KEY`. Si falta, fallback a Haversine.
 *   OPT-GR-002 Si la API devuelve error/timeout/non-OK, fallback a Haversine y
 *              `fellBackToHaversine=true` (auditable en eventos).
 *   OPT-GR-003 Routes API admite hasta 25 intermediates por request. Si excede,
 *              fallback a Haversine.
 *   OPT-GR-004 El ÚLTIMO stop del input se trata como destination FIJA (Google
 *              no permite "destination=any"). El resto son intermediates que
 *              Google reordena según `optimizeWaypointOrder`. El caller puede
 *              ordenar `input.stops` para hintear el destino preferido.
 *
 * Endpoint:
 *   POST https://routes.googleapis.com/directions/v2:computeRoutes
 *   Headers:
 *     - X-Goog-Api-Key: <KEY>
 *     - X-Goog-FieldMask: routes.distanceMeters,routes.duration,
 *                         routes.legs.distanceMeters,routes.legs.duration,
 *                         routes.optimizedIntermediateWaypointIndex
 *
 * Body (resumido):
 *   {
 *     origin: { location: { latLng: { latitude, longitude } } },
 *     destination: { location: { latLng: { latitude, longitude } } },
 *     intermediates: [{ location: { latLng: { latitude, longitude } } }],
 *     travelMode: "DRIVE",
 *     routingPreference: "TRAFFIC_AWARE",
 *     optimizeWaypointOrder: true,
 *     languageCode: "es",
 *     units: "METRIC"
 *   }
 *
 * Response (resumido):
 *   {
 *     routes: [{
 *       distanceMeters: 18000,
 *       duration: "1800s",
 *       legs: [{ distanceMeters, duration }],
 *       optimizedIntermediateWaypointIndex: [1, 0]
 *     }]
 *   }
 *
 * `optimizedIntermediateWaypointIndex` es un array de índices ORIGINALES de
 * intermediates en el orden en que Google decidió visitarlos. p.ej. [2,0,1]
 * significa: ir primero al intermediate[2], luego al [0], luego al [1], y
 * finalmente al destination.
 */
@Injectable()
export class GoogleRoutesOptimizer implements IRouteOptimizer {
  private readonly logger = new Logger(GoogleRoutesOptimizer.name);
  readonly providerName = 'google_routes' as const;

  /** Google Routes API admite hasta 25 intermediates por request. */
  private static readonly MAX_INTERMEDIATES = 25;

  private static readonly ENDPOINT =
    'https://routes.googleapis.com/directions/v2:computeRoutes';

  private static readonly FIELD_MASK = [
    'routes.distanceMeters',
    'routes.duration',
    'routes.legs.distanceMeters',
    'routes.legs.duration',
    'routes.optimizedIntermediateWaypointIndex',
  ].join(',');

  constructor(
    private readonly config: ConfigService,
    private readonly haversine: HaversineOptimizer,
  ) {}

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const apiKey = this.config.get<string>('GOOGLE_ROUTES_API_KEY', '');
    if (!apiKey) {
      this.logger.warn(
        'OPT-GR-001: GOOGLE_ROUTES_API_KEY vacío — fallback a Haversine',
      );
      return this.fallback(input);
    }

    // Caso trivial: 0 stops.
    if (input.stops.length === 0) {
      return {
        provider: this.providerName,
        totalDistanceKm: 0,
        totalDurationMin: 0,
        sequence: [],
      };
    }

    // Caso trivial: 1 stop — no requiere llamar a Google.
    if (input.stops.length === 1) {
      return this.singleStop(input);
    }

    // Intermediates = todos los stops menos el último (que es destination).
    const intermediatesCount = input.stops.length - 1;
    if (intermediatesCount > GoogleRoutesOptimizer.MAX_INTERMEDIATES) {
      this.logger.warn(
        `OPT-GR-003: ${intermediatesCount} intermediates exceden el máximo de ` +
          `${GoogleRoutesOptimizer.MAX_INTERMEDIATES} de Routes API — fallback a Haversine`,
      );
      return this.fallback(input);
    }

    const timeoutMs = Number(
      this.config.get<number>('GOOGLE_ROUTES_TIMEOUT_MS', 15000),
    );
    const travelMode = this.config.get<string>(
      'GOOGLE_ROUTES_TRAVEL_MODE',
      'DRIVE',
    );
    const routingPreference = this.config.get<string>(
      'GOOGLE_ROUTES_PREFERENCE',
      'TRAFFIC_AWARE',
    );

    const destinationStop = input.stops[input.stops.length - 1];
    const intermediateStops = input.stops.slice(0, -1);

    const body = {
      origin: toWaypoint(input.origin),
      destination: toWaypoint(destinationStop.destination),
      intermediates: intermediateStops.map((s) => toWaypoint(s.destination)),
      travelMode,
      routingPreference,
      optimizeWaypointOrder: true,
      languageCode: 'es',
      units: 'METRIC',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(GoogleRoutesOptimizer.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': GoogleRoutesOptimizer.FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logger.error(
          `OPT-GR-002: Google Routes HTTP ${res.status} — ${errBody.slice(0, 200)} — fallback a Haversine`,
        );
        return this.fallback(input);
      }

      const data = (await res.json()) as GoogleRoutesResponse;

      if (!data.routes?.length) {
        this.logger.error(
          'OPT-GR-002: Google Routes sin rutas en la respuesta — fallback a Haversine',
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
        `OPT-GR-002: Google Routes call falló (${msg}) — fallback a Haversine`,
      );
      return this.fallback(input);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parse de la respuesta de Google Routes.
   *
   * - `routes[0].distanceMeters` / `duration` son totales del trip.
   * - `routes[0].legs[i]` es el tramo entre waypoints consecutivos.
   *   Para N stops hay N legs (origen → s1 → s2 → ... → sN).
   * - `optimizedIntermediateWaypointIndex` es el ORDEN reordenado de los
   *   intermediates que enviamos. p.ej. [2,0,1] significa que el primer
   *   intermediate visitado es `intermediates[2]`, luego `intermediates[0]`, etc.
   */
  private parseResponse(
    data: GoogleRoutesResponse,
    input: OptimizationInput,
  ): OptimizationResult {
    const route = data.routes[0];
    const destinationStop = input.stops[input.stops.length - 1];
    const intermediateStops = input.stops.slice(0, -1);

    // Si Google no devuelve optimizedIntermediateWaypointIndex
    // (caso edge: 0 o 1 intermediate), mantenemos el orden de envío.
    const optimizedIdx =
      route.optimizedIntermediateWaypointIndex ??
      intermediateStops.map((_, i) => i);

    // Validación defensiva: el array reordenado debe tener el mismo length.
    if (optimizedIdx.length !== intermediateStops.length) {
      this.logger.error(
        `OPT-GR-002: optimizedIntermediateWaypointIndex length=${optimizedIdx.length} ` +
          `!= intermediates length=${intermediateStops.length} — fallback a Haversine`,
      );
      // Fire-and-forget fallback (sync return path requires throw)
      throw new Error('invalid optimizedIntermediateWaypointIndex length');
    }

    const orderedStops = [
      ...optimizedIdx.map((idx) => intermediateStops[idx]),
      destinationStop,
    ];

    const legs = route.legs ?? [];
    const sequence: OptimizedStop[] = orderedStops.map((stop, i) => {
      // legs[i] = tramo desde el waypoint anterior hasta orderedStops[i].
      // legs[0] = origen → orderedStops[0].
      const leg = legs[i];
      const distanceKm = leg ? (leg.distanceMeters ?? 0) / 1000 : 0;
      const durationMin = leg ? parseDurationToMinutes(leg.duration) : 0;
      return {
        shipmentId: stop.shipmentId,
        order: i + 1,
        distanceFromPrevKm: round2(distanceKm),
        durationFromPrevMin: round2(durationMin),
      };
    });

    return {
      provider: this.providerName,
      totalDistanceKm: round2((route.distanceMeters ?? 0) / 1000),
      totalDurationMin: round2(parseDurationToMinutes(route.duration)),
      sequence,
    };
  }

  /** Cálculo directo para 1 stop sin llamar a Google. */
  private singleStop(input: OptimizationInput): OptimizationResult {
    const avgSpeedKmh = input.avgSpeedKmh ?? 35;
    const serviceMin = input.serviceTimePerStopMin ?? 5;
    const dKm = HaversineOptimizer.distanceKm(
      input.origin,
      input.stops[0].destination,
    );
    const durationMin = (dKm / avgSpeedKmh) * 60 + serviceMin;
    return {
      provider: this.providerName,
      totalDistanceKm: round2(dKm),
      totalDurationMin: round2(durationMin),
      sequence: [
        {
          shipmentId: input.stops[0].shipmentId,
          order: 1,
          distanceFromPrevKm: round2(dKm),
          durationFromPrevMin: round2(durationMin),
        },
      ],
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

// ─── Helpers ────────────────────────────────────────────────────

function toWaypoint(coord: { lat: number; lng: number }) {
  return {
    location: {
      latLng: {
        latitude: coord.lat,
        longitude: coord.lng,
      },
    },
  };
}

/** Convierte "123s" (formato Google duration) a minutos. */
function parseDurationToMinutes(duration?: string): number {
  if (!duration) return 0;
  const seconds = parseFloat(duration.replace(/s$/, ''));
  if (Number.isNaN(seconds)) return 0;
  return seconds / 60;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Google Routes API types (subset) ───────────────────────────

interface GoogleRoutesResponse {
  routes: GoogleRoute[];
}

interface GoogleRoute {
  distanceMeters?: number;
  duration?: string; // formato "1800s"
  legs?: GoogleLeg[];
  optimizedIntermediateWaypointIndex?: number[];
}

interface GoogleLeg {
  distanceMeters?: number;
  duration?: string;
}
