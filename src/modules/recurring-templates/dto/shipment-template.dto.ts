import {
  IsString,
  Length,
  IsOptional,
  IsNumberString,
  IsInt,
  Min,
  IsUUID,
  IsObject,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CARGO_TYPES = [
  'general',
  'refrigerated',
  'hazardous',
  'fragile',
  'oversized',
  'passenger',
  'food',
  'documents',
  'medical',
] as const;

/**
 * Snapshot de un shipment dentro de la plantilla. Cuando dispara la generación
 * se crea un Shipment real con estos datos + trackingCode autogenerado.
 */
export class ShipmentTemplateDto {
  @ApiProperty({ example: '742 Evergreen Terrace' })
  @IsString()
  @Length(2, 255)
  originAddress!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  originLat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  originLng?: string;

  @ApiProperty({ example: 'Lincoln Elementary School' })
  @IsString()
  @Length(2, 255)
  destinationAddress!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  destinationLat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  destinationLng?: string;

  @ApiProperty({ example: 'Pickup Bart Simpson' })
  @IsString()
  @Length(2, 255)
  description!: string;

  @ApiProperty({ enum: CARGO_TYPES, example: 'passenger' })
  @IsIn(CARGO_TYPES as unknown as string[])
  cargoType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  weightKg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  volumeM3?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  pieces?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerCompanyId?: string;

  @ApiPropertyOptional({
    description:
      'Metadata libre tipada (passenger.fullName, freight.invoiceNumber, etc.)',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
