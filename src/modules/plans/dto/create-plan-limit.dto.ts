import { IsString, IsInt, IsNotEmpty, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlanLimitDto {
  @ApiProperty({
    example: 'trucking',
    description: 'Vertical del límite (trucking, delivery, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  vertical: string;

  @ApiProperty({
    example: 'max_trucks',
    description: 'Código identificador del límite',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 10, description: 'Valor numérico del límite (>= 0)' })
  @IsInt()
  @Min(0)
  value: number;
}
