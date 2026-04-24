import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AssignShipmentDto {
  @ApiPropertyOptional({ description: 'Truck UUID' })
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional({ description: 'Driver UUID' })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Route UUID' })
  @IsUUID()
  @IsOptional()
  routeId?: string;
}

export class CancelShipmentDto {
  @ApiProperty({
    description: 'Razón de cancelación',
    example: 'Cliente cambió de opinión',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}

export class UploadPodDto {
  @ApiProperty({
    description: 'URL del POD subido a S3',
    example: 'https://s3.amazonaws.com/pods/shipment-123.pdf',
  })
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  podUrl!: string;

  @ApiPropertyOptional({
    description: 'Nombre de quien firmó',
    example: 'John Receiver',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  podSignedBy?: string;
}
