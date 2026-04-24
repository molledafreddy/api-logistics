import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CompanyType } from '../../../common/enums/company-type.enum';
import { CompanyStatus } from '../../../common/enums/company-status.enum';

export class QueryCompanyDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: CompanyType })
  @IsEnum(CompanyType)
  @IsOptional()
  type?: CompanyType;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsEnum(CompanyStatus)
  @IsOptional()
  status?: CompanyStatus;

  @ApiPropertyOptional({ description: 'Ordenar por campo', example: 'name' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
