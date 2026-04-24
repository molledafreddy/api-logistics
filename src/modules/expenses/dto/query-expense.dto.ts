import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ExpenseStatus } from '../../../common/enums/expense-status.enum';

export class QueryExpenseDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ExpenseStatus })
  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;

  @ApiPropertyOptional()
  @IsIn([
    'fuel',
    'toll',
    'maintenance',
    'parking',
    'meal',
    'lodging',
    'repair',
    'other',
  ])
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
