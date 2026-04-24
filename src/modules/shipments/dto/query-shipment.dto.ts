import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsIn,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum';

export class QueryShipmentDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Buscar por trackingCode, ref, descripción',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus)
  @IsOptional()
  status?: ShipmentStatus;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'urgent'] })
  @IsIn(['low', 'normal', 'high', 'urgent'])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  routeId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  customerCompanyId?: string;

  @ApiPropertyOptional({ description: 'Pickup desde (ISO date)' })
  @IsDateString()
  @IsOptional()
  pickupFrom?: string;

  @ApiPropertyOptional({ description: 'Pickup hasta (ISO date)' })
  @IsDateString()
  @IsOptional()
  pickupTo?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por empresa (solo super_admin)',
  })
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
