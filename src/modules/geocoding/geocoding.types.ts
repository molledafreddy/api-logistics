/**
 * Sprint C — Geocoding utility (Modelo C).
 *
 * Tipos compartidos del módulo de geocoding. La interfaz `IGeocodingProvider`
 * abstrae al proveedor concreto (Mapbox, Google, Mock) para permitir A/B,
 * fallback y testing sin acoplar a un SDK específico.
 */

/** Identificador del provider activo. */
export type GeocodingProviderName = 'mapbox' | 'mock';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/**
 * Resultado normalizado y agnóstico del provider.
 *
 * Diseñado para alimentar directamente las columnas embebidas en
 * `shipments` (Modelo C: sin tabla central de addresses):
 *   - `formatted`        → `origin_address` / `destination_address`
 *   - `coordinates`      → `origin_lat/lng` / `destination_lat/lng`
 *   - `placeId`          → `origin_place_id` / `destination_place_id`
 *   - `confidence`       → `origin_confidence` / `destination_confidence`
 */
export interface GeocodeFeature {
  /** ID estable del provider (ej. Mapbox `address.4791064066081284`). */
  placeId: string;
  /** Dirección legible humana, lista para guardar en BD. */
  formatted: string;
  /** Punto geográfico WGS84. */
  coordinates: GeoPoint;
  /** Score 0..1 reportado por el provider para este match. */
  confidence: number;
  /** Tipo de feature (address, poi, neighborhood, place, region, country, …). */
  featureType?: string;
  /** ISO-3166-1 alpha-2. */
  country?: string;
  /** Región / provincia / estado. */
  region?: string;
  /** Ciudad / localidad. */
  locality?: string;
  /** Código postal. */
  postcode?: string;
  /** Bounding box opcional cuando aplica (places, regions). */
  bbox?: BoundingBox;
}

export interface SearchOptions {
  /** Sesgar resultados cerca de este punto. */
  proximity?: GeoPoint;
  /** Máximo de resultados (default 5, máx 10). */
  limit?: number;
  /** Filtrar por país (ISO-3166-1 alpha-2). */
  country?: string;
  /** Tipos a incluir; por defecto `address,poi,place`. */
  types?: string[];
  /** Idioma preferido para los nombres formateados. */
  language?: string;
}

/**
 * Contrato del provider. Cada implementación debe ser **stateless** y
 * **resiliente** (red flaky) — el `GeocodingService` aplica cache + retry.
 */
export interface IGeocodingProvider {
  readonly providerName: GeocodingProviderName;

  /** Autocomplete textual. Devuelve 0..N candidatos ordenados por relevancia. */
  search(query: string, opts?: SearchOptions): Promise<GeocodeFeature[]>;

  /** Drop-pin → dirección formateada. Devuelve 0..1 features. */
  reverse(point: GeoPoint, opts?: SearchOptions): Promise<GeocodeFeature[]>;
}

export const GEOCODING_PROVIDER_TOKEN = Symbol('IGeocodingProvider');
