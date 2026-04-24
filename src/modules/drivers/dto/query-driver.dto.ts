import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DriverStatus } from '../../../common/enums/driver-status.enum';

export class QueryDriverDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre, email o licencia' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;

  @ApiPropertyOptional({ description: 'Filtrar por camión asignado' })
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por empresa (solo super_admin)',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ example: 'lastName' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
