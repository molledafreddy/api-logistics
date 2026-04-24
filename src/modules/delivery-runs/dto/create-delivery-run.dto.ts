import {
  IsOptional,
  IsString,
  Length,
  IsDateString,
  IsIn,
  IsUUID,
  IsArray,
  ArrayUnique,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SHIFTS = ['morning', 'afternoon', 'evening', 'night', 'custom'] as const;

export class CreateDeliveryRunDto {
  @ApiProperty({ example: 'AM Lincoln Elementary', maxLength: 150 })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({
    example: '2026-04-23',
    description: 'Fecha del run (YYYY-MM-DD)',
  })
  @IsDateString()
  scheduledDate!: string;

  @ApiPropertyOptional({ enum: SHIFTS, default: 'morning' })
  @IsOptional()
  @IsIn(SHIFTS as unknown as string[])
  shift?: (typeof SHIFTS)[number];

  @ApiPropertyOptional({
    example: '07:00',
    description: 'Hora de inicio HH:mm (24h)',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime debe tener formato HH:mm (24h)',
  })
  startTime?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  truckId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'IDs de shipments a incluir desde el inicio. Aplica DR-001: ningún shipment debe estar ya en otro run abierto.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  shipmentIds?: string[];
}
