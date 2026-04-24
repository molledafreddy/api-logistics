import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumberString,
  IsDateString,
  IsInt,
  IsIn,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum';
import {
  CargoType,
  ALL_CARGO_TYPES,
} from '../../../common/enums/cargo-type.enum';

export class CreateShipmentDto {
  @ApiPropertyOptional({ description: 'Empresa cliente (opcional)' })
  @IsUUID()
  @IsOptional()
  customerCompanyId?: string;

  @ApiPropertyOptional({
    description:
      'Cuando el CLIENTE propone un envío a otra empresa carrier. ' +
      'Si se omite, el carrier es la empresa del usuario autenticado. ' +
      'Requiere que exista una relación ACCEPTED entre las dos empresas.',
  })
  @IsUUID()
  @IsOptional()
  proposedCarrierId?: string;

  @ApiPropertyOptional({ example: 'PO-12345', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional({ enum: ShipmentStatus, default: ShipmentStatus.DRAFT })
  @IsEnum(ShipmentStatus)
  @IsOptional()
  status?: ShipmentStatus;

  @ApiPropertyOptional({
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  })
  @IsIn(['low', 'normal', 'high', 'urgent'])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  routeId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  driverId?: string;

  // Origen
  @ApiProperty({ example: '101 NE 1st St, Miami, FL', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  originAddress!: string;

  @ApiPropertyOptional({ example: '25.7617' })
  @IsNumberString()
  @IsOptional()
  originLat?: string;

  @ApiPropertyOptional({ example: '-80.1918' })
  @IsNumberString()
  @IsOptional()
  originLng?: string;

  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  originContactName?: string;

  @ApiPropertyOptional({ example: '+1-555-111-2222', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  originContactPhone?: string;

  // Destino
  @ApiProperty({ example: '500 N Orange Ave, Orlando, FL', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  destinationAddress!: string;

  @ApiPropertyOptional({ example: '28.5383' })
  @IsNumberString()
  @IsOptional()
  destinationLat?: string;

  @ApiPropertyOptional({ example: '-81.3792' })
  @IsNumberString()
  @IsOptional()
  destinationLng?: string;

  @ApiPropertyOptional({ example: 'John Receiver', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  destinationContactName?: string;

  @ApiPropertyOptional({ example: '+1-555-333-4444', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  destinationContactPhone?: string;

  // Carga
  @ApiProperty({ example: 'Pallets de electrónica', maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description!: string;

  @ApiPropertyOptional({ example: '1500.00' })
  @IsNumberString()
  @IsOptional()
  weightKg?: string;

  @ApiPropertyOptional({ example: '12.50' })
  @IsNumberString()
  @IsOptional()
  volumeM3?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsInt()
  @Min(0)
  @IsOptional()
  pieces?: number;

  @ApiPropertyOptional({
    enum: CargoType,
    description:
      'Tipo de carga. Valores freight: general, refrigerated, hazardous, fragile, oversized, ' +
      'food, documents, medical. Vertical passenger: passenger.',
    default: CargoType.GENERAL,
  })
  @IsIn(ALL_CARGO_TYPES)
  @IsOptional()
  cargoType?: string;

  // Fechas
  @ApiPropertyOptional({ example: '2026-04-22T10:00:00Z' })
  @IsDateString()
  @IsOptional()
  pickupAt?: string;

  @ApiPropertyOptional({ example: '2026-04-23T18:00:00Z' })
  @IsDateString()
  @IsOptional()
  deliveryAt?: string;

  // Pricing
  @ApiPropertyOptional({ example: '1250.00' })
  @IsNumberString()
  @IsOptional()
  price?: string;

  @ApiPropertyOptional({ example: 'USD', maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
