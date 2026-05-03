import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Sprint C — DTOs del controller de geocoding.
 *
 * Todos los inputs llegan por **query string** (`@Query()`) para que las
 * llamadas sean cacheables y compartibles vía URL.
 */

export class GeocodingSearchQueryDto {
  @ApiProperty({
    description: 'Texto libre a buscar. Mínimo 3 caracteres.',
    example: 'Av. Providencia 1208, Santiago',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @Length(3, 200)
  q!: string;

  @ApiPropertyOptional({
    description:
      'Sesgo de proximidad como `lat,lng` (WGS84). Útil para favorecer ' +
      'resultados cerca de la ubicación actual del usuario.',
    example: '-33.4378,-70.6504',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, {
    message: 'proximity debe tener formato `lat,lng`',
  })
  proximity?: string;

  @ApiPropertyOptional({
    description: 'Máximo de candidatos a devolver (1-10).',
    default: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por país (ISO-3166-1 alpha-2). Default: GEOCODING_DEFAULT_COUNTRY.',
    example: 'cl',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  country?: string;

  @ApiPropertyOptional({
    description: 'Idioma preferido para los nombres formateados.',
    example: 'es',
  })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  language?: string;
}

export class GeocodingReverseQueryDto {
  @ApiProperty({ description: 'Latitud WGS84.', example: -33.4378 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ description: 'Longitud WGS84.', example: -70.6504 })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({
    description: 'Filtrar por país (ISO-3166-1 alpha-2).',
    example: 'cl',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  country?: string;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  language?: string;
}

export class GeocodingValidateQueryDto {
  @ApiProperty({
    description: 'Dirección a validar. Devuelve el mejor match o `null`.',
    example: 'Av. Apoquindo 4501, Las Condes, Chile',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @Length(3, 200)
  address!: string;
}
