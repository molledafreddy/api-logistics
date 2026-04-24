import {
  IsOptional,
  IsString,
  Length,
  IsDateString,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SHIFTS = ['morning', 'afternoon', 'evening', 'night', 'custom'] as const;

/**
 * Edita campos descriptivos del run. Para asignar driver/truck usar
 * `PATCH /:id/assign-driver`; para reordenar usar `PATCH /:id/reorder`.
 */
export class UpdateDeliveryRunDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional({ example: '2026-04-24' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ enum: SHIFTS })
  @IsOptional()
  @IsIn(SHIFTS as unknown as string[])
  shift?: (typeof SHIFTS)[number];

  @ApiPropertyOptional({ example: '07:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;
}
