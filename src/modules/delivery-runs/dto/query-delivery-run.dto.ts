import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryRunStatus } from '../../../common/enums/delivery-run-status.enum';

const SORTS = ['scheduledDate', 'createdAt', 'status', 'name'] as const;

export class QueryDeliveryRunDto {
  @ApiPropertyOptional({ example: '2026-04-23' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  truckId?: string;

  @ApiPropertyOptional({ enum: DeliveryRunStatus })
  @IsOptional()
  @IsEnum(DeliveryRunStatus)
  status?: DeliveryRunStatus;

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

  @ApiPropertyOptional({ enum: SORTS, default: 'scheduledDate' })
  @IsOptional()
  @IsIn(SORTS as unknown as string[])
  sortBy?: (typeof SORTS)[number];

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }
}
