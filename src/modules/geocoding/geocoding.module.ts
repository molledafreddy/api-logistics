import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { GeocodingCacheService } from './geocoding-cache.service';
import { MapboxGeocodingProvider } from './providers/mapbox.provider';
import { MockGeocodingProvider } from './providers/mock.provider';
import {
  GEOCODING_PROVIDER_TOKEN,
  type IGeocodingProvider,
} from './geocoding.types';

/**
 * GeocodingModule (Sprint C — Geocoding utility + direcciones embebidas).
 *
 * Expone:
 *   GET  /v1/geocoding/search?q=...&proximity=lat,lng&country=cl
 *   GET  /v1/geocoding/reverse?lat=...&lng=...
 *   GET  /v1/geocoding/validate?address=...
 *
 * El provider activo se decide por env:
 *   GEOCODING_PROVIDER=mapbox  → requiere MAPBOX_TOKEN
 *   GEOCODING_PROVIDER=mock    → fixtures determinísticos para dev/test
 *
 * El cache de respuestas vive en Redis (cache-manager registrado globalmente
 * en `CommonModule`); TTL = `GEOCODING_CACHE_TTL_SEC` (default 24 h).
 */
@Module({
  imports: [ConfigModule],
  controllers: [GeocodingController],
  providers: [
    MapboxGeocodingProvider,
    MockGeocodingProvider,
    GeocodingCacheService,
    GeocodingService,
    {
      provide: GEOCODING_PROVIDER_TOKEN,
      inject: [ConfigService, MapboxGeocodingProvider, MockGeocodingProvider],
      useFactory: (
        config: ConfigService,
        mapbox: MapboxGeocodingProvider,
        mock: MockGeocodingProvider,
      ): IGeocodingProvider => {
        const name = config.get<string>('GEOCODING_PROVIDER', 'mock');
        const token = config.get<string>('MAPBOX_TOKEN', '');
        // Si pidieron mapbox pero no hay token, degradamos a mock con warning
        // explícito en logs en lugar de crashear el bootstrap.
        if (name === 'mapbox' && token) return mapbox;
        if (name === 'mapbox') {
          console.warn(
            '[GeocodingModule] GEOCODING_PROVIDER=mapbox pero MAPBOX_TOKEN está vacío. Usando MockGeocodingProvider.',
          );
        }
        return mock;
      },
    },
  ],
  exports: [GeocodingService],
})
export class GeocodingModule {}
