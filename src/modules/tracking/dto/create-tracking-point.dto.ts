import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumberString,
  IsOptional,
  IsUUID,
  IsString,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CreateTrackingPointDto {
  @ApiPropertyOptional({ description: 'Shipment UUID' })
  @IsUUID()
  @IsOptional()
  shipmentId?: string;

  @ApiPropertyOptional({ description: 'Truck UUID' })
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional({ description: 'Driver UUID' })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiProperty({ example: '25.7617' })
  @IsNumberString()
  lat!: string;

  @ApiProperty({ example: '-80.1918' })
  @IsNumberString()
  lng!: string;

  @ApiPropertyOptional({ example: '85.50' })
  @IsNumberString()
  @IsOptional()
  speed?: string;

  @ApiPropertyOptional({ example: '180.00' })
  @IsNumberString()
  @IsOptional()
  heading?: string;

  @ApiPropertyOptional({ example: '12.50' })
  @IsNumberString()
  @IsOptional()
  altitude?: string;

  @ApiPropertyOptional({ example: '5.20' })
  @IsNumberString()
  @IsOptional()
  accuracy?: string;

  @ApiPropertyOptional({
    enum: ['pickup', 'delivery', 'stop', 'start', 'resume', 'incident', 'none'],
  })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  event?: string;

  @ApiPropertyOptional({ description: 'Timestamp de captura (default: now)' })
  @IsDateString()
  @IsOptional()
  capturedAt?: string;
}
