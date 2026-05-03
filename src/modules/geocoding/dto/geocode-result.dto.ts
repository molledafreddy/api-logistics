import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sprint C — Schemas Swagger del response.
 *
 * Estos DTOs son **solo para documentación OpenAPI** (no se usan para
 * validación de input). El runtime devuelve los `GeocodeFeature` planos
 * tal como vienen de `GeocodingService`.
 */

export class GeoPointDto {
  @ApiProperty({ example: -33.4378, description: 'Latitud WGS84' })
  lat!: number;

  @ApiProperty({ example: -70.6504, description: 'Longitud WGS84' })
  lng!: number;
}

export class GeocodeFeatureDto {
  @ApiProperty({
    example: 'address.4791064066081284',
    description: 'ID estable del provider de geocoding.',
  })
  placeId!: string;

  @ApiProperty({
    example: 'Av. Providencia 1208, Providencia, Región Metropolitana, Chile',
    description: 'Dirección formateada lista para guardar en BD.',
  })
  formatted!: string;

  @ApiProperty({ type: GeoPointDto })
  coordinates!: GeoPointDto;

  @ApiProperty({
    example: 0.92,
    description: 'Score de confianza 0..1 reportado por el provider.',
  })
  confidence!: number;

  @ApiPropertyOptional({ example: 'address' })
  featureType?: string;

  @ApiPropertyOptional({ example: 'cl' })
  country?: string;

  @ApiPropertyOptional({ example: 'Región Metropolitana' })
  region?: string;

  @ApiPropertyOptional({ example: 'Providencia' })
  locality?: string;

  @ApiPropertyOptional({ example: '7500000' })
  postcode?: string;
}

export class GeocodeSearchResponseDto {
  @ApiProperty({ enum: ['mapbox', 'mock'], example: 'mock' })
  provider!: 'mapbox' | 'mock';

  @ApiProperty({ type: [GeocodeFeatureDto] })
  features!: GeocodeFeatureDto[];

  @ApiProperty({
    example: false,
    description: 'true si el resultado vino de cache Redis.',
  })
  cached!: boolean;
}

export class GeocodeValidateResponseDto {
  @ApiProperty({ example: true, description: 'true si se encontró match.' })
  valid!: boolean;

  @ApiPropertyOptional({ type: GeocodeFeatureDto })
  feature?: GeocodeFeatureDto;
}
