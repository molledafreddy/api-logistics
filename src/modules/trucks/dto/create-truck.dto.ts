import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  IsEnum,
  IsNumberString,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { TruckStatus } from '../../../common/enums/truck-status.enum';

export class CreateTruckDto {
  @ApiProperty({ example: 'ABC-1234', maxLength: 20 })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  plate!: string;

  @ApiPropertyOptional({ example: '1HGCM82633A004352', maxLength: 17 })
  @IsString()
  @MaxLength(17)
  @IsOptional()
  vin?: string;

  @ApiPropertyOptional({ example: 'Volvo', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  make?: string;

  @ApiPropertyOptional({ example: 'VNL 760', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 2022, minimum: 1950, maximum: 2100 })
  @IsInt()
  @Min(1950)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({ example: 'White', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    example: 'flatbed',
    enum: ['flatbed', 'reefer', 'dry-van', 'tanker', 'box', 'other'],
  })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    example: '20000.00',
    description: 'Capacity in kilograms',
  })
  @IsNumberString()
  @IsOptional()
  capacityKg?: string;

  @ApiPropertyOptional({
    example: '80.50',
    description: 'Capacity volume in m3',
  })
  @IsNumberString()
  @IsOptional()
  capacityVolumeM3?: string;

  @ApiPropertyOptional({
    enum: TruckStatus,
    default: TruckStatus.AVAILABLE,
    example: TruckStatus.AVAILABLE,
  })
  @IsEnum(TruckStatus)
  @IsOptional()
  status?: TruckStatus;

  @ApiPropertyOptional({
    description: 'Driver UUID currently assigned',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsUUID()
  currentDriverId?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  insuranceExpiresAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  registrationExpiresAt?: string;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsDateString()
  @IsOptional()
  lastMaintenanceAt?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsDateString()
  @IsOptional()
  nextMaintenanceAt?: string;

  @ApiPropertyOptional({ example: 125000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  odometerKm?: number;

  @ApiPropertyOptional({ example: 'Camión asignado a la ruta Norte' })
  @IsString()
  @IsOptional()
  notes?: string;
}
