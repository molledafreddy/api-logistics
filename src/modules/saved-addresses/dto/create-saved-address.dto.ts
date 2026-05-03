import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Length,
  IsIn,
  IsNumberString,
  Matches,
} from 'class-validator';

export const SAVED_ADDRESS_KINDS = [
  'depot',
  'customer',
  'dropoff',
  'pickup',
  'other',
] as const;
export type SavedAddressKind = (typeof SAVED_ADDRESS_KINDS)[number];

export class CreateSavedAddressDto {
  @ApiProperty({
    example: 'Depot Quilicura',
    description: 'Nombre corto del favorito (único por compañía).',
  })
  @IsString()
  @Length(1, 120)
  label!: string;

  @ApiPropertyOptional({
    enum: SAVED_ADDRESS_KINDS,
    default: 'other',
    description: 'Categoría libre para agrupar en UI.',
  })
  @IsString()
  @IsIn(SAVED_ADDRESS_KINDS as unknown as string[])
  @IsOptional()
  kind?: SavedAddressKind;

  @ApiProperty({
    example: 'Av. Providencia 1208, Providencia, Santiago, Chile',
  })
  @IsString()
  @Length(1, 500)
  formatted!: string;

  @ApiProperty({ example: -33.429138, description: 'Latitud WGS84' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: -70.621336, description: 'Longitud WGS84' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    example: 'address.4791064066081284',
    description: 'placeId del provider de geocoding.',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  placeId?: string;

  @ApiPropertyOptional({
    example: '0.85',
    description:
      'Score 0..1 reportado por el provider (string para precisión).',
  })
  @IsNumberString()
  @Matches(/^(0(\.\d{1,2})?|1(\.0{1,2})?)$/, {
    message: 'confidence debe ser un decimal entre 0 y 1 (máx 2 decimales).',
  })
  @IsOptional()
  confidence?: string;

  @ApiPropertyOptional({ example: 'cl' })
  @IsString()
  @IsOptional()
  @Length(1, 8)
  country?: string;

  @ApiPropertyOptional({ example: 'Región Metropolitana' })
  @IsString()
  @IsOptional()
  @Length(1, 120)
  region?: string;

  @ApiPropertyOptional({ example: 'Providencia' })
  @IsString()
  @IsOptional()
  @Length(1, 120)
  locality?: string;

  @ApiPropertyOptional({ example: '7500000' })
  @IsString()
  @IsOptional()
  @Length(1, 20)
  postcode?: string;

  @ApiPropertyOptional({
    example: 'Tocar timbre del segundo piso. Horario 9-18.',
  })
  @IsString()
  @IsOptional()
  @Length(1, 2000)
  notes?: string;
}
