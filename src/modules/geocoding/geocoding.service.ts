import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GEOCODING_PROVIDER_TOKEN,
  type GeocodeFeature,
  type GeoPoint,
  type IGeocodingProvider,
  type SearchOptions,
} from './geocoding.types';
import { GeocodingCacheService } from './geocoding-cache.service';

/**
 * Sprint C — GeocodingService.
 *
 * Orquesta:
 *   1. Cache Redis (24 h por defecto).
 *   2. Provider activo (`mapbox` o `mock`).
 *   3. Validación blanda de inputs (longitud query, rango lat/lng).
 *
 * Diseñado como **utility** (no CRUD): no persiste búsquedas. La persistencia
 * de la dirección elegida vive embebida en `shipments.origin_*` /
 * `shipments.destination_*` (Modelo C) o en `saved_addresses` (favoritos
 * opcionales en Sprint C.5).
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly defaultCountry: string;

  constructor(
    @Inject(GEOCODING_PROVIDER_TOKEN)
    private readonly provider: IGeocodingProvider,
    private readonly cache: GeocodingCacheService,
    private readonly config: ConfigService,
  ) {
    this.defaultCountry = this.config.get<string>(
      'GEOCODING_DEFAULT_COUNTRY',
      'cl',
    );
  }

  // ─── Public API ────────────────────────────

  /** Autocomplete textual con cache. */
  async search(
    query: string,
    opts: SearchOptions = {},
  ): Promise<{ features: GeocodeFeature[]; cached: boolean }> {
    const q = (query ?? '').trim();
    if (q.length < 3) {
      throw new BadRequestException(
        'GEO-001: el parámetro `q` debe tener al menos 3 caracteres.',
      );
    }
    const merged: SearchOptions = {
      ...opts,
      country: opts.country ?? this.defaultCountry,
    };
    const cached = await this.cache.getSearch(
      this.provider.providerName,
      q,
      merged,
    );
    if (cached) return { features: cached, cached: true };

    const features = await this.provider.search(q, merged);
    await this.cache.setSearch(this.provider.providerName, q, merged, features);
    return { features, cached: false };
  }

  /** Pin-drop → dirección formateada. */
  async reverse(
    point: GeoPoint,
    opts: SearchOptions = {},
  ): Promise<{ features: GeocodeFeature[]; cached: boolean }> {
    this.assertLatLng(point);
    const merged: SearchOptions = {
      ...opts,
      country: opts.country ?? this.defaultCountry,
    };
    const cached = await this.cache.getReverse(
      this.provider.providerName,
      point,
      merged,
    );
    if (cached) return { features: cached, cached: true };

    const features = await this.provider.reverse(point, merged);
    await this.cache.setReverse(
      this.provider.providerName,
      point,
      merged,
      features,
    );
    return { features, cached: false };
  }

  /**
   * Validate: forward search por la dirección dada y devuelve el primer match
   * con su confidence. Útil para confirmar/enriquecer una dirección que el
   * operador escribió a mano antes de guardarla en un shipment.
   *
   * GEO-002: si no hay matches devuelve `null` (no es error 4xx; el caller
   * decide si rechaza o la guarda igual con confidence=0).
   */
  async validate(address: string): Promise<GeocodeFeature | null> {
    const { features } = await this.search(address, { limit: 1 });
    return features[0] ?? null;
  }

  // ─── Helpers ───────────────────────────────

  private assertLatLng(point: GeoPoint): void {
    if (
      !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lng) ||
      point.lat < -90 ||
      point.lat > 90 ||
      point.lng < -180 ||
      point.lng > 180
    ) {
      throw new BadRequestException(
        'GEO-003: lat debe estar en [-90,90] y lng en [-180,180].',
      );
    }
  }
}
