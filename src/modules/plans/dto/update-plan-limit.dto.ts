import { PartialType } from '@nestjs/swagger';
import { CreatePlanLimitDto } from './create-plan-limit.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePlanLimitDto extends PartialType(CreatePlanLimitDto) {
  @ApiPropertyOptional({
    example: 'delivery',
    description: 'Vertical del límite',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  vertical?: string;

  @ApiPropertyOptional({
    example: 'max_drivers',
    description: 'Código identificador del límite',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Nuevo valor numérico del límite (>= 0)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;
}
