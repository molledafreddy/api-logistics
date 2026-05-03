import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  SAVED_ADDRESS_KINDS,
  SavedAddressKind,
} from './create-saved-address.dto';

export class QuerySavedAddressDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Búsqueda parcial por label o formatted (ILIKE).',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  q?: string;

  @ApiPropertyOptional({ enum: SAVED_ADDRESS_KINDS })
  @IsString()
  @IsIn(SAVED_ADDRESS_KINDS as unknown as string[])
  @IsOptional()
  kind?: SavedAddressKind;

  @ApiPropertyOptional({
    description: 'Filtrar por compañía (solo SUPER_ADMIN).',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
