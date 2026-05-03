import { Injectable, Logger } from '@nestjs/common';
import type {
  GeocodeFeature,
  GeocodingProviderName,
  GeoPoint,
  IGeocodingProvider,
  SearchOptions,
} from '../geocoding.types';

/**
 * Sprint C — Mock provider de geocoding.
 *
 * Útil cuando:
 *   - No hay `MAPBOX_TOKEN` configurado (dev sin cuenta).
 *   - Tests unitarios / e2e que no deben llamar a Internet.
 *   - Demos / sandbox.
 *
 * Devuelve resultados determinísticos derivando coordenadas de un hash simple
 * de la query, manteniéndolas centradas en Santiago de Chile (rango plausible).
 */
@Injectable()
export class MockGeocodingProvider implements IGeocodingProvider {
  readonly providerName: GeocodingProviderName = 'mock';
  private readonly logger = new Logger(MockGeocodingProvider.name);

  // Centro Plaza de Armas, Santiago.
  private readonly anchor: GeoPoint = { lat: -33.4378, lng: -70.6504 };

  async search(query: string, opts?: SearchOptions): Promise<GeocodeFeature[]> {
    this.logger.debug(`mock.search("${query}")`);
    const limit = Math.min(opts?.limit ?? 3, 5);
    return Array.from({ length: limit }).map((_, i) =>
      this.fakeFeature(`${query} #${i + 1}`, i, opts?.country),
    );
  }

  async reverse(
    point: GeoPoint,
    opts?: SearchOptions,
  ): Promise<GeocodeFeature[]> {
    this.logger.debug(`mock.reverse(${point.lat},${point.lng})`);
    return [
      {
        placeId: `mock.${point.lat.toFixed(4)}_${point.lng.toFixed(4)}`,
        formatted: `Pin drop @ ${point.lat.toFixed(4)},${point.lng.toFixed(4)}`,
        coordinates: { lat: point.lat, lng: point.lng },
        confidence: 0.85,
        featureType: 'address',
        country: opts?.country ?? 'cl',
      },
    ];
  }

  // ─── Helpers ───────────────────────────────
  private fakeFeature(
    label: string,
    seed: number,
    country?: string,
  ): GeocodeFeature {
    const hash = this.hash(label) + seed;
    const dLat = (((hash % 1000) - 500) / 100000) * 5; // ±0.025°
    const dLng = ((((hash * 7) % 1000) - 500) / 100000) * 5;
    const lat = this.anchor.lat + dLat;
    const lng = this.anchor.lng + dLng;
    return {
      placeId: `mock.${this.hash(label).toString(16)}`,
      formatted: `${label}, Santiago, Chile`,
      coordinates: { lat, lng },
      confidence: Math.max(0.5, 0.95 - seed * 0.1),
      featureType: 'address',
      country: country ?? 'cl',
      region: 'Región Metropolitana',
      locality: 'Santiago',
    };
  }

  private hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}
