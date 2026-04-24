import {
  IsString,
  Length,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUUID,
  Matches,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrencePattern } from '../../../common/enums/recurrence-pattern.enum';
import { ShipmentTemplateDto } from './shipment-template.dto';

export class CreateRecurringTemplateDto {
  @ApiProperty({ example: 'AM Lincoln Elementary', maxLength: 150 })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ enum: RecurrencePattern, example: RecurrencePattern.WEEKLY })
  @IsEnum(RecurrencePattern)
  pattern!: RecurrencePattern;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: 'ISO day numbers (1=mon..7=sun). Requerido si pattern=weekly.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];

  @ApiProperty({ example: '07:00', description: 'Hora HH:mm (24h)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time debe tener formato HH:mm (24h)',
  })
  time!: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-12-15' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Fechas a saltar (YYYY-MM-DD)',
    example: ['2026-07-04'],
  })
  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  exceptions?: string[];

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

  @ApiProperty({ type: [ShipmentTemplateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShipmentTemplateDto)
  shipmentTemplates!: ShipmentTemplateDto[];
}
