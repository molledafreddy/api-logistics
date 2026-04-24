import {
  IsOptional,
  IsBooleanString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrencePattern } from '../../../common/enums/recurrence-pattern.enum';

const SORTS = ['createdAt', 'name', 'startDate', 'lastGeneratedAt'] as const;

export class QueryRecurringTemplateDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsBooleanString()
  active?: string;

  @ApiPropertyOptional({ enum: RecurrencePattern })
  @IsOptional()
  @IsEnum(RecurrencePattern)
  pattern?: RecurrencePattern;

  // Paginación
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: SORTS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTS as unknown as string[])
  sortBy?: (typeof SORTS)[number];

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
