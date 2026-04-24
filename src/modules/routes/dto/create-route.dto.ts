import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumberString,
  IsInt,
  IsIn,
  ValidateNested,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';

export class WaypointDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  address!: string;

  @ApiProperty({ example: 25.7617 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: -80.1918 })
  @IsNumber()
  lng!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRouteDto {
  @ApiProperty({ example: 'Miami → Orlando', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ['draft', 'active', 'archived'],
    default: 'draft',
  })
  @IsIn(['draft', 'active', 'archived'])
  @IsOptional()
  status?: 'draft' | 'active' | 'archived';

  @ApiProperty({ example: '101 NE 1st St, Miami, FL', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  originAddress!: string;

  @ApiProperty({ example: '25.7617' })
  @IsNumberString()
  originLat!: string;

  @ApiProperty({ example: '-80.1918' })
  @IsNumberString()
  originLng!: string;

  @ApiProperty({ example: '500 N Orange Ave, Orlando, FL', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  destinationAddress!: string;

  @ApiProperty({ example: '28.5383' })
  @IsNumberString()
  destinationLat!: string;

  @ApiProperty({ example: '-81.3792' })
  @IsNumberString()
  destinationLng!: string;

  @ApiPropertyOptional({ example: '378.50' })
  @IsNumberString()
  @IsOptional()
  distanceKm?: string;

  @ApiPropertyOptional({ example: 240, description: 'Minutos' })
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedDurationMin?: number;

  @ApiPropertyOptional({ example: '850.00' })
  @IsNumberString()
  @IsOptional()
  basePrice?: string;

  @ApiPropertyOptional({ example: 'USD', maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ type: [WaypointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  @IsOptional()
  waypoints?: WaypointDto[];
}
