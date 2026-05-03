import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

import { GeocodingService } from './geocoding.service';
import {
  GeocodingSearchQueryDto,
  GeocodingReverseQueryDto,
  GeocodingValidateQueryDto,
  GeocodeSearchResponseDto,
  GeocodeValidateResponseDto,
} from './dto';
import type { GeoPoint, SearchOptions } from './geocoding.types';

/**
 * Sprint C — Endpoints de geocoding (utility, no CRUD).
 *
 * Rate-limit dedicado vía `@Throttle` para no quemar la cuota Mapbox por
 * abuso o autocomplete agresivo del frontend.
 */
@ApiTags('Geocoding')
@ApiBearerAuth()
@Controller('geocoding')
export class GeocodingController {
  private readonly perMinute: number;

  constructor(
    private readonly geocoding: GeocodingService,
    private readonly config: ConfigService,
  ) {
    this.perMinute = this.config.get<number>(
      'GEOCODING_RATE_LIMIT_PER_MIN',
      60,
    );
  }

  // ─── 1. Autocomplete textual ───────────────

  @Get('search')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Autocomplete de direcciones (Sprint C)',
    description:
      'Devuelve hasta 10 candidatos cacheados (Redis 24 h) usando el provider ' +
      'configurado (`GEOCODING_PROVIDER`). Pensado para integrarse con un ' +
      'autocomplete dropdown en operador/admin — el destinatario nunca captura ' +
      'su propia dirección. Rate-limit por defecto: 60 req/min por IP.',
  })
  @ApiResponse({ status: 200, type: GeocodeSearchResponseDto })
  @ApiResponse({ status: 400, description: 'GEO-001: query < 3 chars' })
  @ApiResponse({
    status: 503,
    description: 'Provider externo no disponible',
  })
  async search(
    @Query() query: GeocodingSearchQueryDto,
  ): Promise<GeocodeSearchResponseDto> {
    const opts = this.buildSearchOptions(query);
    const { features, cached } = await this.geocoding.search(query.q, opts);
    return {
      provider: this.providerName(),
      features,
      cached,
    };
  }

  // ─── 2. Reverse (drop-pin → dirección) ─────

  @Get('reverse')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reverse geocoding — pin drop a dirección formateada',
    description:
      'Convierte un par (lat,lng) capturado en mapa a una dirección legible. ' +
      'Útil cuando el operador arrastra un pin para fijar el punto exacto de pickup/dropoff.',
  })
  @ApiResponse({ status: 200, type: GeocodeSearchResponseDto })
  @ApiResponse({
    status: 400,
    description: 'GEO-003: lat/lng fuera de rango',
  })
  async reverse(
    @Query() query: GeocodingReverseQueryDto,
  ): Promise<GeocodeSearchResponseDto> {
    const point: GeoPoint = { lat: query.lat, lng: query.lng };
    const opts: SearchOptions = {};
    if (query.country) opts.country = query.country;
    if (query.language) opts.language = query.language;
    const { features, cached } = await this.geocoding.reverse(point, opts);
    return {
      provider: this.providerName(),
      features,
      cached,
    };
  }

  // ─── 3. Validate (1 dirección → mejor match) ─

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Valida y enriquece una dirección dada',
    description:
      'Devuelve `{ valid:false }` si no hay matches o `{ valid:true, feature }` ' +
      'con el mejor candidato. No es destructivo — el caller decide si guarda ' +
      'la dirección original o la del provider.',
  })
  @ApiResponse({ status: 200, type: GeocodeValidateResponseDto })
  async validate(
    @Query() query: GeocodingValidateQueryDto,
  ): Promise<GeocodeValidateResponseDto> {
    const feature = await this.geocoding.validate(query.address);
    if (!feature) return { valid: false };
    return { valid: true, feature };
  }

  // ─── Helpers ───────────────────────────────

  private providerName(): 'mapbox' | 'mock' {
    return this.config.get<'mapbox' | 'mock'>('GEOCODING_PROVIDER', 'mock');
  }

  private buildSearchOptions(q: GeocodingSearchQueryDto): SearchOptions {
    const opts: SearchOptions = {};
    if (q.limit) opts.limit = q.limit;
    if (q.country) opts.country = q.country;
    if (q.language) opts.language = q.language;
    if (q.proximity) {
      const [latStr, lngStr] = q.proximity.split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        opts.proximity = { lat, lng };
      }
    }
    return opts;
  }
}
