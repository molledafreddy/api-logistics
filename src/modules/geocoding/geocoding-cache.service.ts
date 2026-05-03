import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import type {
  GeocodeFeature,
  SearchOptions,
  GeoPoint,
} from './geocoding.types';

/**
 * Sprint C — Cache de geocoding sobre Redis (cache-manager global de CommonModule).
 *
 * Estrategia:
 *   - Clave normalizada: hash sha1(`{kind}|{provider}|{lang}|{country}|{payload}`)
 *   - TTL configurable (`GEOCODING_CACHE_TTL_SEC`, default 24 h).
 *   - Falla silenciosa: si Redis está caído o `CACHE_MANAGER` no está
 *     registrado (ej. script openapi:generate sin Redis), devolvemos `null`
 *     y el caller consulta al provider (no rompemos el bootstrap).
 */
@Injectable()
export class GeocodingCacheService {
  private readonly logger = new Logger(GeocodingCacheService.name);
  private readonly ttlSec: number;

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private readonly cache: Cache | null,
    private readonly config: ConfigService,
  ) {
    this.ttlSec = this.config.get<number>('GEOCODING_CACHE_TTL_SEC', 86400);
    if (!this.cache) {
      this.logger.warn(
        'CACHE_MANAGER no disponible — geocoding sin cache (no-op).',
      );
    }
  }

  // ─── Public API ────────────────────────────

  async getSearch(
    provider: string,
    query: string,
    opts: SearchOptions | undefined,
  ): Promise<GeocodeFeature[] | null> {
    return this.read(this.searchKey(provider, query, opts));
  }

  async setSearch(
    provider: string,
    query: string,
    opts: SearchOptions | undefined,
    features: GeocodeFeature[],
  ): Promise<void> {
    await this.write(this.searchKey(provider, query, opts), features);
  }

  async getReverse(
    provider: string,
    point: GeoPoint,
    opts: SearchOptions | undefined,
  ): Promise<GeocodeFeature[] | null> {
    return this.read(this.reverseKey(provider, point, opts));
  }

  async setReverse(
    provider: string,
    point: GeoPoint,
    opts: SearchOptions | undefined,
    features: GeocodeFeature[],
  ): Promise<void> {
    await this.write(this.reverseKey(provider, point, opts), features);
  }

  // ─── Helpers ───────────────────────────────

  private searchKey(
    provider: string,
    query: string,
    opts: SearchOptions | undefined,
  ): string {
    const normalized = this.normalizeQuery(query);
    const payload = JSON.stringify({
      q: normalized,
      country: opts?.country ?? '',
      proximity: opts?.proximity
        ? `${opts.proximity.lat.toFixed(3)},${opts.proximity.lng.toFixed(3)}`
        : '',
      limit: opts?.limit ?? 5,
      types: (opts?.types ?? []).slice().sort().join(','),
      language: opts?.language ?? '',
    });
    return this.buildKey('search', provider, payload);
  }

  private reverseKey(
    provider: string,
    point: GeoPoint,
    opts: SearchOptions | undefined,
  ): string {
    const payload = JSON.stringify({
      // 5 decimales ≈ ~1.1 m, suficiente para deduplicar pin-drops.
      lat: point.lat.toFixed(5),
      lng: point.lng.toFixed(5),
      country: opts?.country ?? '',
      types: (opts?.types ?? []).slice().sort().join(','),
      language: opts?.language ?? '',
    });
    return this.buildKey('reverse', provider, payload);
  }

  private buildKey(kind: string, provider: string, payload: string): string {
    const hash = createHash('sha1').update(payload).digest('hex').slice(0, 16);
    return `geocoding:${kind}:${provider}:${hash}`;
  }

  private normalizeQuery(query: string): string {
    return (
      query
        .toLowerCase()
        .normalize('NFD')
        // Remueve diacríticos (tildes, virgulillas, etc.)
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private async read(key: string): Promise<GeocodeFeature[] | null> {
    if (!this.cache) return null;
    try {
      const value = await this.cache.get<GeocodeFeature[]>(key);
      return value ?? null;
    } catch (err) {
      this.logger.warn(
        `Cache read failed for ${key}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async write(key: string, features: GeocodeFeature[]): Promise<void> {
    if (!this.cache) return;
    try {
      // cache-manager v5+ usa ms; cache-manager v4 usa s. CommonModule fija
      // el default en ms (`5 * 60 * 1000`), así que aquí también ms.
      await this.cache.set(key, features, this.ttlSec * 1000);
    } catch (err) {
      this.logger.warn(
        `Cache write failed for ${key}: ${(err as Error).message}`,
      );
    }
  }
}
