import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GeocodeFeature,
  GeocodingProviderName,
  GeoPoint,
  IGeocodingProvider,
  SearchOptions,
} from '../geocoding.types';

/**
 * Sprint C — Mapbox Geocoding API v6 provider.
 *
 * Endpoints:
 *   - Forward (autocomplete): GET https://api.mapbox.com/search/geocode/v6/forward
 *   - Reverse (pin-drop):     GET https://api.mapbox.com/search/geocode/v6/reverse
 *
 * Docs: https://docs.mapbox.com/api/search/geocoding-v6/
 *
 * Diseño:
 *   - Stateless (todo viene en query params).
 *   - Timeout duro de 4 s para no estrangular requests del API.
 *   - 1 reintento en errores de red transientes (5xx, abort).
 *   - Si el token no está configurado, lanza ServiceUnavailableException —
 *     la `GeocodingService` debe haber elegido el provider 'mock' antes.
 */
@Injectable()
export class MapboxGeocodingProvider implements IGeocodingProvider {
  readonly providerName: GeocodingProviderName = 'mapbox';
  private readonly logger = new Logger(MapboxGeocodingProvider.name);

  private readonly token: string;
  private readonly defaultCountry: string;
  private readonly baseUrl = 'https://api.mapbox.com/search/geocode/v6';
  private readonly timeoutMs = 4000;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('MAPBOX_TOKEN', '');
    this.defaultCountry = this.config.get<string>(
      'GEOCODING_DEFAULT_COUNTRY',
      'cl',
    );
  }

  async search(query: string, opts?: SearchOptions): Promise<GeocodeFeature[]> {
    this.assertToken();
    const params = new URLSearchParams({
      q: query,
      access_token: this.token,
      limit: String(Math.min(opts?.limit ?? 5, 10)),
      country: opts?.country ?? this.defaultCountry,
      language: opts?.language ?? 'es',
    });
    if (opts?.proximity) {
      params.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`);
    }
    if (opts?.types?.length) {
      params.set('types', opts.types.join(','));
    }
    const url = `${this.baseUrl}/forward?${params.toString()}`;
    const json = await this.callJson(url);
    return this.mapFeatures(json);
  }

  async reverse(
    point: GeoPoint,
    opts?: SearchOptions,
  ): Promise<GeocodeFeature[]> {
    this.assertToken();
    const params = new URLSearchParams({
      longitude: String(point.lng),
      latitude: String(point.lat),
      access_token: this.token,
      limit: String(Math.min(opts?.limit ?? 1, 5)),
      language: opts?.language ?? 'es',
    });
    if (opts?.country) params.set('country', opts.country);
    if (opts?.types?.length) params.set('types', opts.types.join(','));
    const url = `${this.baseUrl}/reverse?${params.toString()}`;
    const json = await this.callJson(url);
    return this.mapFeatures(json);
  }

  // ─── Helpers ───────────────────────────────

  private assertToken(): void {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'MAPBOX_TOKEN no configurado. Setea GEOCODING_PROVIDER=mock o agrega el token.',
      );
    }
  }

  private async callJson(url: string): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.status >= 500) {
          throw new Error(`Mapbox HTTP ${res.status}`);
        }
        if (!res.ok) {
          // 4xx → no reintentar.
          const body = await safeText(res);
          throw new ServiceUnavailableException(
            `Mapbox ${res.status}: ${body}`,
          );
        }
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (err instanceof ServiceUnavailableException) throw err;
        this.logger.warn(
          `Mapbox attempt ${attempt + 1} failed: ${(err as Error).message}`,
        );
      }
    }
    throw new ServiceUnavailableException(
      `Mapbox unreachable after retries: ${(lastErr as Error)?.message ?? 'unknown'}`,
    );
  }

  /**
   * Mapbox v6 devuelve un GeoJSON FeatureCollection con shape:
   * {
   *   type: 'FeatureCollection',
   *   features: [{
   *     id, type:'Feature',
   *     geometry: { type:'Point', coordinates:[lng,lat] },
   *     properties: {
   *       mapbox_id, full_address, name, place_formatted,
   *       feature_type, match_code:{ confidence:'exact|high|medium|low|...' },
   *       context: { country:{country_code}, region:{name}, place:{name}, postcode:{name} }
   *     }
   *   }]
   * }
   */
  private mapFeatures(payload: unknown): GeocodeFeature[] {
    const fc = payload as {
      features?: Array<{
        id?: string;
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, unknown>;
      }>;
    };
    if (!fc?.features?.length) return [];
    return fc.features
      .map((f) => this.toFeature(f))
      .filter((x): x is GeocodeFeature => x !== null);
  }

  private toFeature(f: {
    id?: string;
    geometry?: { coordinates?: [number, number] };
    properties?: Record<string, unknown>;
  }): GeocodeFeature | null {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length !== 2) return null;
    const [lng, lat] = coords;
    const props = f.properties ?? {};
    const placeId = (props.mapbox_id as string) ?? f.id ?? '';
    if (!placeId) return null;

    const ctx =
      (props.context as Record<
        string,
        { name?: string; country_code?: string }
      >) ?? {};
    const matchCode = props.match_code as { confidence?: string } | undefined;

    return {
      placeId,
      formatted:
        (props.full_address as string) ??
        (props.place_formatted as string) ??
        (props.name as string) ??
        '',
      coordinates: { lat, lng },
      confidence: this.mapConfidence(matchCode?.confidence),
      featureType: (props.feature_type as string) ?? 'address',
      country: ctx.country?.country_code?.toLowerCase(),
      region: ctx.region?.name,
      locality: ctx.place?.name,
      postcode: ctx.postcode?.name,
    };
  }

  /** Mapbox usa labels (`exact|high|medium|low|inaccurate`); convertimos a 0..1. */
  private mapConfidence(label?: string): number {
    switch ((label ?? '').toLowerCase()) {
      case 'exact':
        return 1.0;
      case 'high':
        return 0.85;
      case 'medium':
        return 0.65;
      case 'low':
        return 0.4;
      case 'inaccurate':
        return 0.2;
      default:
        return 0.5;
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}
