import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryRouteDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre, origen o destino' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['draft', 'active', 'archived'] })
  @IsIn(['draft', 'active', 'archived'])
  @IsOptional()
  status?: 'draft' | 'active' | 'archived';

  @ApiPropertyOptional({
    description: 'Filtrar por empresa (solo super_admin)',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ example: 'name' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
