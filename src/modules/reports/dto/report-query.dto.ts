import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsUUID,
  IsIn,
  IsEnum,
} from 'class-validator';

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Fecha desde (ISO)' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO)' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por empresa (solo super_admin)',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiProperty({
    enum: ReportFormat,
    default: ReportFormat.JSON,
    required: false,
  })
  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat = ReportFormat.JSON;
}

export class ShipmentReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por status' })
  @IsOptional()
  @IsIn([
    'draft',
    'quoted',
    'confirmed',
    'assigned',
    'picked_up',
    'in_transit',
    'at_stop',
    'delivered',
    'pod_uploaded',
    'completed',
    'cancelled',
    'incident',
  ])
  status?: string;
}
