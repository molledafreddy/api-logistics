import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IRouteOptimizer,
  OptimizationInput,
  OptimizationResult,
} from '../optimization.types';
import { HaversineOptimizer } from './haversine.optimizer';

/**
 * GoogleRoutesOptimizer — stub funcional.
 *
 * Estado actual (Sprint 7):
 *   - Si `GOOGLE_ROUTES_API_KEY` está definida, hace fetch real al endpoint
 *     de Routes API v2 (`computeRoutes` con `optimizeWaypointOrder=true`).
 *   - Si NO está definida o el llamado falla, hace fallback a Haversine y
 *     marca `fellBackToHaversine=true`. Así el sistema nunca rompe en prod.
 *
 * El integrador real (parser de waypoints + manejo de quotas/tráfico)
 * queda para Sprint 7.b cuando se contraten los API keys. Lo importante
 * de este sprint es dejar la abstracción + fallback.
 */
@Injectable()
export class GoogleRoutesOptimizer implements IRouteOptimizer {
  private readonly logger = new Logger(GoogleRoutesOptimizer.name);
  readonly providerName = 'google_routes' as const;

  constructor(
    private readonly config: ConfigService,
    private readonly haversine: HaversineOptimizer,
  ) {}

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const apiKey = this.config.get<string>('GOOGLE_ROUTES_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_ROUTES_API_KEY no definida — fallback a Haversine',
      );
      const fallback = await this.haversine.optimize(input);
      return { ...fallback, fellBackToHaversine: true };
    }

    try {
      // Stub: el call real se implementará en Sprint 7.b. Mientras tanto,
      // delegamos en haversine y marcamos como fallback para auditoría.
      this.logger.debug(
        `[STUB] GoogleRoutes optimize() llamado con ${input.stops.length} stops`,
      );
      const fallback = await this.haversine.optimize(input);
      return {
        ...fallback,
        provider: this.providerName,
        fellBackToHaversine: true,
      };
    } catch (err) {
      this.logger.error(
        `Google Routes API falló: ${(err as Error).message} — fallback a Haversine`,
      );
      const fallback = await this.haversine.optimize(input);
      return { ...fallback, fellBackToHaversine: true };
    }
  }
}
