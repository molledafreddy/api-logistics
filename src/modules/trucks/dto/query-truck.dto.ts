import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TruckStatus } from '../../../common/enums/truck-status.enum';

export class QueryTruckDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Buscar por placa, marca o modelo' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: TruckStatus })
  @IsEnum(TruckStatus)
  @IsOptional()
  status?: TruckStatus;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de camión' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Filtrar por driver asignado' })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por empresa (solo super_admin)',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Ordenar por campo', example: 'plate' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
